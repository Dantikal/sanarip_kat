from django.conf import settings
from django.db import models


class Profile(models.Model):
    CHAIRMAN = "chairman"
    UDO = "udo"
    EXECUTOR = "executor"
    ROLES = [
        (CHAIRMAN, "Председатель"),
        (UDO, "УДО"),
        (EXECUTOR, "Исполнитель"),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    role = models.CharField(max_length=20, choices=ROLES, default=EXECUTOR)
    full_name = models.CharField("ФИО", max_length=200)
    position = models.CharField("Должность", max_length=200, blank=True)
    department = models.CharField("Отдел", max_length=200, blank=True)
    is_admin = models.BooleanField(
        "Администратор (может подписывать)", default=False,
        help_text="Только администраторы выбираются подписывающими при регистрации и видят раздел «На подпись».",
    )

    def __str__(self):
        return f"{self.full_name} ({self.get_role_display()})"


class DocumentKind(models.Model):
    OUTGOING = "outgoing"
    CATEGORIES = [(OUTGOING, "Исходящие")]

    name = models.CharField(max_length=300)
    category = models.CharField(max_length=20, choices=CATEGORIES, default=OUTGOING)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


class Document(models.Model):
    PENDING = "pending"
    REGISTERED = "registered"
    ON_SIGNING = "on_signing"
    SIGNED = "signed"
    CLOSED = "closed"
    REJECTED = "rejected"
    REWORK = "rework"
    ARCHIVED = "archived"
    STATUSES = [
        (PENDING, "Ожидает регистрации"),
        (REGISTERED, "Зарегистрирован"),
        (ON_SIGNING, "На подписи"),
        (SIGNED, "Подписан"),
        (CLOSED, "Закрыт"),
        (REJECTED, "Отказан"),
        (REWORK, "На доработке"),
        (ARCHIVED, "В архиве"),
    ]

    VIEWS = [("normal", "Обычный"), ("info", "Для сведения"), ("answer", "Требуется ответ")]
    URGENCY = [("normal", "Обычный"), ("urgent", "Срочный"), ("very_urgent", "Очень срочный")]

    number = models.CharField(max_length=30, blank=True)
    kind = models.ForeignKey(DocumentKind, on_delete=models.PROTECT, related_name="documents")
    subject = models.CharField(max_length=500)
    tags = models.CharField(max_length=500, blank=True)
    content = models.TextField()
    on_control = models.BooleanField(default=False)
    view = models.CharField(max_length=20, choices=VIEWS, default="normal")
    languages = models.JSONField(default=list)
    urgency = models.CharField(max_length=20, choices=URGENCY, default="normal")
    recipients = models.JSONField(default=list)

    status = models.CharField(max_length=20, choices=STATUSES, default=PENDING)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="created_documents")
    created_at = models.DateTimeField(auto_now_add=True)

    executors = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="executing_documents")
    sent_to_sign_at = models.DateTimeField(null=True, blank=True)
    signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="signed_documents"
    )
    signed_at = models.DateTimeField(null=True, blank=True)
    # регистрация / отказ / закрытие — действия УДО
    registered_at = models.DateTimeField(null=True, blank=True)
    registered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="registered_documents"
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="rejected_documents"
    )
    reject_reason = models.TextField(blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="closed_documents"
    )
    returned_at = models.DateTimeField(null=True, blank=True)
    returned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="returned_documents"
    )
    return_comment = models.TextField(blank=True)
    resubmitted_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="archived_documents"
    )
    favorited_by = models.ManyToManyField(settings.AUTH_USER_MODEL, blank=True, related_name="favorite_documents")

    # резолюция: оформляет УДО, подписывает пользователь «За подписью», выбранный при регистрации
    RESOLUTION_TYPES = [("execution", "На исполнение"), ("info", "Для сведения")]
    resolution_text = models.TextField(blank=True)
    resolution_type = models.CharField(max_length=20, choices=RESOLUTION_TYPES, default="execution")
    resolution_deadline = models.DateField(null=True, blank=True)
    resolution_prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="prepared_resolutions"
    )
    lead_executor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="lead_documents"
    )

    @property
    def signer(self):
        first = self.approvers.select_related("user__profile").first()
        return first.user if first else None

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.number} {self.subject}"


class Approver(models.Model):
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="approvers")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ["order"]


class Acknowledgement(models.Model):
    """Исполнитель ознакомился с подписанной резолюцией."""

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="acknowledgements")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [("document", "user")]


class Attachment(models.Model):
    KINDS = [("official", "Официальный документ"), ("appendix", "Приложение"), ("internal", "Внутреннее приложение")]

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="attachments")
    kind = models.CharField(max_length=20, choices=KINDS)
    file = models.FileField(upload_to="attachments/%Y/%m/")
    name = models.CharField(max_length=300)


class LibraryItem(models.Model):
    """Шаблоны и бланки в разделе «Зарегистрировать». Добавляет УДО, скачивают все."""

    TEMPLATES = "templates"
    BLANKS = "blanks"
    CATEGORIES = [(TEMPLATES, "Шаблоны"), (BLANKS, "Бланки")]

    category = models.CharField(max_length=20, choices=CATEGORIES)
    name = models.CharField(max_length=300)
    text = models.TextField(blank=True)
    file = models.FileField(upload_to="library/%Y/%m/", blank=True)
    file_name = models.CharField(max_length=300, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
