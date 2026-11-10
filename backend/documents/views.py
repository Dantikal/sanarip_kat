import json
import os
from datetime import date
from functools import wraps

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q
from django.http import FileResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_http_methods

from .models import Acknowledgement, Approver, Attachment, Document, DocumentKind, LibraryItem, Profile

ALLOWED_EXT = {".pdf", ".doc", ".docx"}

ORGANIZATIONS = [
    "Исполнительный комитет СНГ",
    "Секретариат ШОС",
    "Секретариат ОДКБ",
    "СКПВ государств — участников СНГ",
    "Военная прокуратура КР",
    "Генеральная прокуратура КР",
    "Министерство обороны КР",
    "Министерство иностранных дел КР",
    "Министерство финансов КР",
    "Министерство экономики и коммерции КР",
    "Администрация Президента КР",
    "Жогорку Кенеш КР",
    "Национальный банк КР",
    "Верховный суд КР",
    "Адвокатура КР",
]

MAILINGS = [
    "Все министерства и ведомства КР",
    "Полномочные представители в областях",
    "Международные организации",
]


def j(data, status=200):
    return JsonResponse(data, status=status, json_dumps_params={"ensure_ascii": False}, safe=False)


def err(message, status=400, **extra):
    return j({"error": message, **extra}, status)


def api_login_required(view):
    @wraps(view)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return err("Требуется вход в систему", 401)
        return view(request, *args, **kwargs)

    return wrapper


def is_admin(user):
    profile = getattr(user, "profile", None)
    return bool(profile and profile.is_admin)


def role_of(user):
    profile = getattr(user, "profile", None)
    return profile.role if profile else Profile.EXECUTOR


def user_json(user):
    if user is None:
        return None
    p = getattr(user, "profile", None)
    return {
        "id": user.id,
        "full_name": p.full_name if p else user.get_username(),
        "position": p.position if p else "",
        "department": p.department if p else "",
        "role": p.role if p else Profile.EXECUTOR,
        "is_admin": bool(p and p.is_admin),
    }


def body(request):
    try:
        return json.loads(request.body or b"{}")
    except ValueError:
        return {}


# ---------- auth ----------

@ensure_csrf_cookie
def me(request):
    return j({"user": user_json(request.user) if request.user.is_authenticated else None})


@require_http_methods(["POST"])
def login_view(request):
    data = body(request)
    user = authenticate(request, username=data.get("username", ""), password=data.get("password", ""))
    if user is None:
        return err("Неверный логин или пароль", 400, code="badLogin")
    login(request, user)
    return j({"user": user_json(user)})


@require_http_methods(["POST"])
def logout_view(request):
    logout(request)
    return j({"ok": True})


@api_login_required
def users(request):
    q = request.GET.get("q", "").strip().casefold()
    role = request.GET.get("role")
    qs = User.objects.filter(is_active=True, profile__isnull=False).select_related("profile")
    if role:
        qs = qs.filter(profile__role=role)
    if request.GET.get("admin") == "1":
        qs = qs.filter(profile__is_admin=True)
    result = []
    for u in qs:
        p = u.profile
        hay = f"{p.full_name} {p.department} {p.position}".casefold()
        if not q or q in hay:
            result.append(user_json(u))
    result.sort(key=lambda x: x["full_name"])
    return j(result[:30])


@api_login_required
def references(request):
    return j({"organizations": ORGANIZATIONS, "mailings": MAILINGS})


# ---------- menu & sections ----------

def visible_documents(user):
    if role_of(user) in (Profile.UDO, Profile.CHAIRMAN):
        return Document.objects.all()
    return Document.objects.filter(
        Q(created_by=user)
        | Q(approvers__user=user)
        | Q(executors=user, status__in=EXECUTED)
    ).distinct()


def signer_documents(user):
    """Документы, где пользователь выбран при регистрации первым («За подписью»)."""
    return Document.objects.filter(approvers__user=user, approvers__order=1)


# статусы, в которых исполнители видят документ
EXECUTED = [Document.SIGNED, Document.CLOSED, Document.ARCHIVED]

# разделы УДО: id раздела → статусы документов в нём.
# «Ждет регистрацию» — и новые документы, и зарегистрированные, по которым ещё не оформлена резолюция.
UDO_SECTIONS = {
    "ozhidanie-registracii": [Document.PENDING, Document.REGISTERED],
    "na-rezolyuciyu": [Document.REGISTERED],
    "zhdet-zakrytiya": [Document.SIGNED],
    "otkazannye": [Document.REJECTED],
    "na-dorabotke": [Document.REWORK],
    "gotovo-k-arhivirovaniyu": [Document.CLOSED],
}


def section_documents(user, section):
    role = role_of(user)
    if section == "svodyashchiy":
        return Document.objects.filter(executors=user, status=Document.SIGNED)
    if section == "na-dorabotke" and role != Profile.UDO:
        return Document.objects.filter(created_by=user, status=Document.REWORK)
    if section in UDO_SECTIONS:
        if role == Profile.UDO:
            return Document.objects.filter(status__in=UDO_SECTIONS[section])
        return Document.objects.none()
    if section == "arhiv":
        return visible_documents(user).filter(status=Document.ARCHIVED)
    if section == "na-podpis":
        if not is_admin(user):
            return Document.objects.none()
        return signer_documents(user).filter(status__in=[Document.ON_SIGNING, Document.SIGNED])
    if section == "ya-podpisal":
        return Document.objects.filter(signed_by=user)
    if section == "ya-podgotovil":
        return Document.objects.filter(resolution_prepared_by=user)
    if section == "ya-oznakomilsya":
        return Document.objects.filter(acknowledgements__user=user)
    if section in ("ya-sozdal", "moi-dokumenty"):
        return Document.objects.filter(created_by=user)
    if section == "izbrannye":
        return visible_documents(user).filter(favorited_by=user)
    if section in ("ishodyashchiy", "vse"):
        return visible_documents(user)
    return Document.objects.none()


@api_login_required
def menu(request):
    user = request.user
    role = role_of(user)

    if role == Profile.UDO:
        count = lambda section: Document.objects.filter(status__in=UDO_SECTIONS[section]).count()
        # passive — раздел для просмотра, его число не идёт в колокольчик
        waiting = [
            {"id": "oznakomitsya", "title": "Ознакомиться", "count": 0},
            {"id": "ozhidanie-registracii", "title": "Ждет регистрацию", "count": count("ozhidanie-registracii")},
            {"id": "zhdet-zakrytiya", "title": "Ждет закрытия", "count": count("zhdet-zakrytiya")},
            {"id": "otkazannye", "title": "Отказанные", "count": count("otkazannye"), "passive": True},
            {"id": "na-dorabotke", "title": "На доработке", "count": count("na-dorabotke"), "passive": True},
            {"id": "gotovo-k-arhivirovaniyu", "title": "Готово к архивированию",
             "count": count("gotovo-k-arhivirovaniyu")},
        ]
    else:
        waiting = [
            {"id": "svodyashchiy", "title": "Вы сводящий",
             "count": Document.objects.filter(executors=user, status=Document.SIGNED)
                      .exclude(acknowledgements__user=user).count()},
            {"id": "oznakomitsya", "title": "Ознакомиться", "count": 0},
        ]
        rework = Document.objects.filter(created_by=user, status=Document.REWORK).count()
        if rework:
            waiting.append({"id": "na-dorabotke", "title": "На доработке", "count": rework})
    if is_admin(user):
        waiting.append({"id": "na-podpis", "title": "На подпись",
                        "count": signer_documents(user).filter(status=Document.ON_SIGNING).count()})

    data = {
        "waiting": {"title": "Ожидается Ваше действие", "items": waiting},
        "important": {
            "title": "Важное",
            "items": [
                {"id": "izbrannye", "title": "Избранные",
                 "count": visible_documents(user).filter(favorited_by=user).count()},
                {"id": "na-kontrole", "title": "У вас на контроле", "count": 0},
                {"id": "soispolnitel", "title": "Вы соисполнитель", "count": 0},
                {"id": "moi-dokumenty", "title": "Мои документы", "count": 0},
                {"id": "vhodyashchie-otvety", "title": "Входящие ответы", "count": 0},
                {"id": "vnutrennie-otvety", "title": "Внутренние ответы", "count": 0},
                {"id": "chernovik", "title": "Черновик", "count": 0},
            ],
        },
        "my_documents": {
            "items": [
                {"id": "ya-sozdal", "title": "Я создал"},
                {"id": "ya-podpisal", "title": "Я подписал"},
                {"id": "ya-podgotovil", "title": "Я подготовил"},
                {"id": "ya-oznakomilsya", "title": "Я ознакомился"},
                {"id": "ya-otvechal", "title": "Я отвечал"},
            ],
            "types_title": "Виды документов",
            "types": [
                {"id": "vse", "title": "Все"},
                {"id": "vnutrenniy", "title": "Внутренний"},
                {"id": "vhodyashchiy", "title": "Входящий"},
                {"id": "ishodyashchiy", "title": "Исходящий"},
                {"id": "obrashcheniya", "title": "Обращения граждан"},
            ],
        },
    }
    return j(data)


# ---------- document kinds ----------

def kind_json(k):
    return {"id": k.id, "name": k.name, "category": k.category}


@api_login_required
@require_http_methods(["GET", "POST"])
def kinds(request):
    if request.method == "POST":
        if role_of(request.user) != Profile.UDO:
            return err("Добавлять виды документов может только УДО", 403, code="forbidden")
        name = (body(request).get("name") or "").strip()
        if not name:
            return err("Введите название", code="nameRequired")
        k = DocumentKind.objects.create(name=name[:300], created_by=request.user)
        return j(kind_json(k), 201)
    return j([kind_json(k) for k in DocumentKind.objects.all()])


@api_login_required
@require_http_methods(["DELETE"])
def kind_detail(request, pk):
    if role_of(request.user) != Profile.UDO:
        return err("Удалять виды документов может только УДО", 403, code="forbidden")
    k = DocumentKind.objects.filter(pk=pk).first()
    if k is None:
        return err("Не найдено", 404)
    if k.documents.exists():
        return err("По этому виду уже есть документы", code="kindInUse")
    k.delete()
    return j({"ok": True})


# ---------- documents ----------

def doc_list_json(d):
    return {
        "id": d.id,
        "number": d.number,
        "subject": d.subject,
        "kind": d.kind.name,
        "status": d.status,
        "urgency": d.urgency,
        "created_at": d.created_at.isoformat(),
        "created_by": user_json(d.created_by),
    }


def iso(dt):
    return dt.isoformat() if dt else None


def doc_detail_json(d, user):
    role = role_of(user)
    signer = d.signer
    acks = {a.user_id: a.at for a in d.acknowledgements.all()}
    executors = []
    for u in d.executors.select_related("profile").order_by("profile__department", "profile__full_name"):
        e = user_json(u)
        e["acknowledged_at"] = iso(acks.get(u.id))
        e["is_lead"] = u.id == d.lead_executor_id
        executors.append(e)

    if d.registered_at:
        timeline = [
            {"event": "submitted", "at": iso(d.created_at), "user": user_json(d.created_by)},
            {"event": "registered", "at": iso(d.registered_at), "user": user_json(d.registered_by)},
        ]
    elif d.status in (Document.PENDING, Document.REJECTED, Document.REWORK) or d.returned_at:
        timeline = [{"event": "submitted", "at": iso(d.created_at), "user": user_json(d.created_by)}]
    else:  # документы, созданные до появления этапа регистрации, или зарегистрированные самим УДО
        timeline = [{"event": "registered", "at": iso(d.created_at), "user": user_json(d.created_by)}]
    if d.returned_at:
        # последний возврат на доработку и повторная отправка вставляются перед регистрацией
        extra = [{"event": "returned", "at": iso(d.returned_at), "user": user_json(d.returned_by),
                  "note": d.return_comment}]
        if d.resubmitted_at:
            extra.append({"event": "resubmitted", "at": iso(d.resubmitted_at), "user": user_json(d.created_by)})
        timeline[1:1] = extra
    if d.rejected_at:
        timeline.append({"event": "rejected", "at": iso(d.rejected_at), "user": user_json(d.rejected_by),
                         "note": d.reject_reason})
    if d.sent_to_sign_at:
        timeline.append({"event": "resolution", "at": iso(d.sent_to_sign_at), "user": user_json(d.resolution_prepared_by)})
    if d.signed_at:
        timeline.append({"event": "signed", "at": iso(d.signed_at), "user": user_json(d.signed_by)})
    for a in d.acknowledgements.select_related("user__profile").order_by("at"):
        timeline.append({"event": "acknowledged", "at": iso(a.at), "user": user_json(a.user)})
    if d.closed_at:
        timeline.append({"event": "closed", "at": iso(d.closed_at), "user": user_json(d.closed_by)})
    if d.archived_at:
        timeline.append({"event": "archived", "at": iso(d.archived_at), "user": user_json(d.archived_by)})

    data = doc_list_json(d)
    data.update({
        "tags": d.tags,
        "content": d.content,
        "on_control": d.on_control,
        "view": d.view,
        "languages": d.languages,
        "recipients": d.recipients,
        "approvers": [user_json(a.user) for a in d.approvers.select_related("user__profile")],
        "signer": user_json(signer),
        "executors": executors,
        "attachments": [
            {"id": a.id, "kind": a.kind, "name": a.name, "url": f"/api/attachments/{a.id}/"}
            for a in d.attachments.all()
        ],
        "is_favorite": d.favorited_by.filter(pk=user.pk).exists(),
        "resolution": None if d.status in (Document.PENDING, Document.REGISTERED, Document.REJECTED,
                                           Document.REWORK) else {
            "text": d.resolution_text,
            "type": d.resolution_type,
            "deadline": d.resolution_deadline.isoformat() if d.resolution_deadline else None,
            "prepared_by": user_json(d.resolution_prepared_by),
            "author": user_json(signer),
            "lead": user_json(d.lead_executor),
            "created_at": iso(d.sent_to_sign_at),
        },
        "timeline": timeline,
        "sent_to_sign_at": iso(d.sent_to_sign_at),
        "signed_at": iso(d.signed_at),
        "signed_by": user_json(d.signed_by),
        "registered_at": iso(d.registered_at),
        "registered_by": user_json(d.registered_by),
        "rejected_at": iso(d.rejected_at),
        "rejected_by": user_json(d.rejected_by),
        "reject_reason": d.reject_reason,
        "closed_at": iso(d.closed_at),
        "closed_by": user_json(d.closed_by),
        "returned_at": iso(d.returned_at),
        "returned_by": user_json(d.returned_by),
        "return_comment": d.return_comment,
        "archived_at": iso(d.archived_at),
        "archived_by": user_json(d.archived_by),
        "can": {
            "rework": role == Profile.UDO and d.status == Document.PENDING,
            "resubmit": d.created_by_id == user.id and d.status == Document.REWORK,
            "archive": role == Profile.UDO and d.status == Document.CLOSED,
            "register": role == Profile.UDO and d.status == Document.PENDING,
            "reject": role == Profile.UDO and d.status == Document.PENDING,
            "close": role == Profile.UDO and d.status == Document.SIGNED,
            "resolve": role == Profile.UDO and d.status == Document.REGISTERED,
            "sign": signer is not None and signer.id == user.id and is_admin(user)
                    and d.status == Document.ON_SIGNING,
        },
    })
    return data


def get_visible(user, pk):
    return visible_documents(user).filter(pk=pk).first()


@api_login_required
@require_http_methods(["GET", "POST"])
def documents(request):
    if request.method == "GET":
        section = request.GET.get("section", "vse")
        qs = section_documents(request.user, section).select_related("kind", "created_by__profile")
        return j([doc_list_json(d) for d in qs])
    return register_document(request)


def assign_number(d):
    return f"ИСХ-{d.id:04d}"


def register_document(request):
    p = request.POST
    missing = []

    kind = DocumentKind.objects.filter(pk=p.get("kind")).first()
    if kind is None:
        return err("Не выбран вид документа", code="kindRequired")

    subject = p.get("subject", "").strip()
    content = p.get("content", "").strip()
    try:
        languages = [x for x in json.loads(p.get("languages", "[]")) if x in ("state", "official", "foreign")]
        recipients = [
            {"type": r.get("type"), "name": str(r.get("name", "")).strip()[:300]}
            for r in json.loads(p.get("recipients", "[]"))
            if r.get("type") in ("org", "person", "mailing") and str(r.get("name", "")).strip()
        ]
        approver_ids = [int(x) for x in json.loads(p.get("approvers", "[]"))]
    except (ValueError, TypeError, AttributeError):
        return err("Неверные данные формы")

    approver_users = list(User.objects.filter(pk__in=approver_ids, profile__isnull=False))
    by_id = {u.id: u for u in approver_users}
    approver_users = [by_id[i] for i in dict.fromkeys(approver_ids) if i in by_id]

    official = request.FILES.get("official")
    if not official:
        missing.append("official")
    if not subject:
        missing.append("subject")
    if not content:
        missing.append("content")
    if not languages:
        missing.append("languages")
    if not recipients:
        missing.append("recipients")
    if not approver_users:
        missing.append("approvers")
    elif not is_admin(approver_users[0]):
        return err("Подписывающим можно выбрать только администратора", code="signerNotAdmin")
    if missing:
        return err("Заполните обязательные поля", code="missing", fields=missing)

    files = [("official", official)]
    files += [("appendix", f) for f in request.FILES.getlist("appendix")]
    files += [("internal", f) for f in request.FILES.getlist("internal")]
    for _, f in files:
        if os.path.splitext(f.name)[1].lower() not in ALLOWED_EXT:
            return err("Недопустимый формат файла", code="badFile", file=f.name)

    view = p.get("view") if p.get("view") in dict(Document.VIEWS) else "normal"
    urgency = p.get("urgency") if p.get("urgency") in dict(Document.URGENCY) else "normal"

    by_udo = role_of(request.user) == Profile.UDO
    with transaction.atomic():
        d = Document.objects.create(
            kind=kind,
            subject=subject[:500],
            tags=p.get("tags", "").strip()[:500],
            content=content,
            on_control=p.get("on_control") == "true",
            view=view,
            languages=languages,
            urgency=urgency,
            recipients=recipients,
            created_by=request.user,
            # УДО регистрирует свои документы сразу, остальные ждут регистрации в УДО
            status=Document.REGISTERED if by_udo else Document.PENDING,
        )
        if by_udo:
            d.number = assign_number(d)
            d.save(update_fields=["number"])
        for i, u in enumerate(approver_users, start=1):
            Approver.objects.create(document=d, user=u, order=i)
        for kind_name, f in files:
            Attachment.objects.create(document=d, kind=kind_name, file=f, name=f.name[:300])

    return j(doc_detail_json(d, request.user), 201)


@api_login_required
def document_detail(request, pk):
    d = get_visible(request.user, pk)
    if d is None:
        return err("Документ не найден", 404)
    if d.status in EXECUTED and d.executors.filter(pk=request.user.pk).exists():
        Acknowledgement.objects.get_or_create(document=d, user=request.user)
    return j(doc_detail_json(d, request.user))


def udo_action(view):
    """Действие УДО над документом в определённом статусе."""
    @wraps(view)
    def wrapper(request, pk):
        d = get_visible(request.user, pk)
        if d is None:
            return err("Документ не найден", 404)
        if role_of(request.user) != Profile.UDO:
            return err("Действие недоступно", 403, code="forbidden")
        return view(request, d)

    return api_login_required(require_http_methods(["POST"])(wrapper))


@udo_action
def document_register(request, d):
    """УДО регистрирует документ: присваивает номер и отправляет «На резолюцию»."""
    with transaction.atomic():
        d = Document.objects.select_for_update().get(pk=d.pk)
        if d.status != Document.PENDING:
            return err("Действие недоступно", 403, code="forbidden")
        d.status = Document.REGISTERED
        d.number = assign_number(d)
        d.registered_at = timezone.now()
        d.registered_by = request.user
        d.save(update_fields=["status", "number", "registered_at", "registered_by"])
    return j(doc_detail_json(d, request.user))


@udo_action
def document_reject(request, d):
    """УДО отказывает в регистрации с указанием причины."""
    reason = str(body(request).get("reason", "")).strip()
    if not reason:
        return err("Укажите причину отказа", code="reasonRequired")
    with transaction.atomic():
        d = Document.objects.select_for_update().get(pk=d.pk)
        if d.status != Document.PENDING:
            return err("Действие недоступно", 403, code="forbidden")
        d.status = Document.REJECTED
        d.reject_reason = reason[:2000]
        d.rejected_at = timezone.now()
        d.rejected_by = request.user
        d.save(update_fields=["status", "reject_reason", "rejected_at", "rejected_by"])
    return j(doc_detail_json(d, request.user))


@udo_action
def document_close(request, d):
    """УДО закрывает документ после подписания резолюции."""
    with transaction.atomic():
        d = Document.objects.select_for_update().get(pk=d.pk)
        if d.status != Document.SIGNED:
            return err("Действие недоступно", 403, code="forbidden")
        d.status = Document.CLOSED
        d.closed_at = timezone.now()
        d.closed_by = request.user
        d.save(update_fields=["status", "closed_at", "closed_by"])
    return j(doc_detail_json(d, request.user))


@udo_action
def document_rework(request, d):
    """УДО возвращает документ автору на доработку с комментарием."""
    comment = str(body(request).get("comment", "")).strip()
    if not comment:
        return err("Укажите, что нужно доработать", code="commentRequired")
    with transaction.atomic():
        d = Document.objects.select_for_update().get(pk=d.pk)
        if d.status != Document.PENDING:
            return err("Действие недоступно", 403, code="forbidden")
        d.status = Document.REWORK
        d.return_comment = comment[:2000]
        d.returned_at = timezone.now()
        d.returned_by = request.user
        d.resubmitted_at = None
        d.save(update_fields=["status", "return_comment", "returned_at", "returned_by", "resubmitted_at"])
    return j(doc_detail_json(d, request.user))


@udo_action
def document_archive(request, d):
    """УДО отправляет закрытый документ в архив."""
    with transaction.atomic():
        d = Document.objects.select_for_update().get(pk=d.pk)
        if d.status != Document.CLOSED:
            return err("Действие недоступно", 403, code="forbidden")
        d.status = Document.ARCHIVED
        d.archived_at = timezone.now()
        d.archived_by = request.user
        d.save(update_fields=["status", "archived_at", "archived_by"])
    return j(doc_detail_json(d, request.user))


@api_login_required
@require_http_methods(["POST"])
def document_resubmit(request, pk):
    """Автор после доработки снова отправляет документ на регистрацию (можно заменить официальный файл)."""
    d = Document.objects.filter(pk=pk, created_by=request.user).first()
    if d is None:
        return err("Документ не найден", 404)
    official = request.FILES.get("official")
    if official and os.path.splitext(official.name)[1].lower() not in ALLOWED_EXT:
        return err("Недопустимый формат файла", code="badFile", file=official.name)
    with transaction.atomic():
        d = Document.objects.select_for_update().get(pk=d.pk)
        if d.status != Document.REWORK:
            return err("Действие недоступно", 403, code="forbidden")
        if official:
            for a in d.attachments.filter(kind="official"):
                a.file.delete(save=False)
                a.delete()
            Attachment.objects.create(document=d, kind="official", file=official, name=official.name[:300])
        d.status = Document.PENDING
        d.resubmitted_at = timezone.now()
        d.save(update_fields=["status", "resubmitted_at"])
    return j(doc_detail_json(d, request.user))


@api_login_required
@require_http_methods(["POST"])
def document_resolution(request, pk):
    """УДО оформляет резолюцию (исполнители, текст) и отправляет её на подпись."""
    d = get_visible(request.user, pk)
    if d is None:
        return err("Документ не найден", 404)
    if role_of(request.user) != Profile.UDO or d.status != Document.REGISTERED:
        return err("Действие недоступно", 403, code="forbidden")
    if d.signer is None:
        return err("У документа нет подписывающего", code="noSigner")

    data = body(request)
    ids = data.get("executor_ids", [])
    if not isinstance(ids, list):
        return err("Неверные данные")
    by_id = {u.id: u for u in User.objects.filter(pk__in=ids, profile__role=Profile.EXECUTOR)}
    executors = [by_id[i] for i in dict.fromkeys(ids) if i in by_id]
    if not executors:
        return err("Выберите исполнителей", code="executorsRequired")

    rtype = data.get("type") if data.get("type") in dict(Document.RESOLUTION_TYPES) else "execution"
    deadline = None
    if data.get("deadline"):
        try:
            deadline = date.fromisoformat(data["deadline"])
        except (TypeError, ValueError):
            return err("Неверная дата", code="badDate")

    with transaction.atomic():
        d.resolution_text = str(data.get("text", "")).strip()
        d.resolution_type = rtype
        d.resolution_deadline = deadline
        d.resolution_prepared_by = request.user
        d.lead_executor = executors[0]
        d.status = Document.ON_SIGNING
        d.sent_to_sign_at = timezone.now()
        d.save()
        d.executors.set(executors)
    return j(doc_detail_json(d, request.user))


@api_login_required
@require_http_methods(["POST"])
def document_sign(request, pk):
    d = get_visible(request.user, pk)
    if d is None:
        return err("Документ не найден", 404)
    signer = d.signer
    if (d.status != Document.ON_SIGNING or signer is None or signer.id != request.user.id
            or not is_admin(request.user)):
        return err("Действие недоступно", 403, code="forbidden")
    d.status = Document.SIGNED
    d.signed_by = request.user
    d.signed_at = timezone.now()
    d.save(update_fields=["status", "signed_by", "signed_at"])
    return j(doc_detail_json(d, request.user))


@api_login_required
def attachment(request, pk):
    a = Attachment.objects.filter(pk=pk).select_related("document").first()
    if a is None or get_visible(request.user, a.document_id) is None:
        return err("Файл не найден", 404)
    download = request.GET.get("download") == "1"
    return FileResponse(a.file.open("rb"), as_attachment=download, filename=a.name)


@api_login_required
@require_http_methods(["POST"])
def document_favorite(request, pk):
    d = get_visible(request.user, pk)
    if d is None:
        return err("Документ не найден", 404)
    if d.favorited_by.filter(pk=request.user.pk).exists():
        d.favorited_by.remove(request.user)
    else:
        d.favorited_by.add(request.user)
    return j({"is_favorite": d.favorited_by.filter(pk=request.user.pk).exists()})


# ---------- шаблоны и бланки ----------

def library_json(item):
    return {
        "id": item.id,
        "category": item.category,
        "name": item.name,
        "text": item.text,
        "file_name": item.file_name,
        "download_url": f"/api/library/{item.id}/download/" if item.file else None,
        "created_at": item.created_at.isoformat(),
        "created_by": user_json(item.created_by),
    }


@api_login_required
@require_http_methods(["GET", "POST"])
def library(request):
    if request.method == "GET":
        category = request.GET.get("category")
        qs = LibraryItem.objects.select_related("created_by__profile")
        if category:
            qs = qs.filter(category=category)
        return j([library_json(i) for i in qs])

    if role_of(request.user) != Profile.UDO:
        return err("Добавлять шаблоны и бланки может только УДО", 403, code="forbidden")
    category = request.POST.get("category")
    if category not in dict(LibraryItem.CATEGORIES):
        return err("Неверный раздел")
    name = request.POST.get("name", "").strip()
    text = request.POST.get("text", "").strip()
    f = request.FILES.get("file")
    if not name:
        return err("Введите название", code="nameRequired")
    if not text and not f:
        return err("Добавьте текст или файл", code="textOrFile")
    if f and os.path.splitext(f.name)[1].lower() not in ALLOWED_EXT:
        return err("Недопустимый формат файла", code="badFile", file=f.name)
    item = LibraryItem.objects.create(
        category=category,
        name=name[:300],
        text=text,
        file=f or "",
        file_name=f.name[:300] if f else "",
        created_by=request.user,
    )
    return j(library_json(item), 201)


@api_login_required
@require_http_methods(["DELETE"])
def library_detail(request, pk):
    if role_of(request.user) != Profile.UDO:
        return err("Удалять может только УДО", 403, code="forbidden")
    item = LibraryItem.objects.filter(pk=pk).first()
    if item is None:
        return err("Не найдено", 404)
    if item.file:
        item.file.delete(save=False)
    item.delete()
    return j({"ok": True})


@api_login_required
def library_download(request, pk):
    item = LibraryItem.objects.filter(pk=pk).first()
    if item is None or not item.file:
        return err("Файл не найден", 404)
    return FileResponse(item.file.open("rb"), as_attachment=True, filename=item.file_name)
