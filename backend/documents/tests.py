import json
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings

from .models import Document, DocumentKind

TMP_MEDIA = tempfile.mkdtemp()


@override_settings(MEDIA_ROOT=TMP_MEDIA)
class WorkflowTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(TMP_MEDIA, ignore_errors=True)

    def login(self, username):
        self.client.logout()
        r = self.client.post("/api/auth/login/", {"username": username, "password": "1234"}, content_type="application/json")
        self.assertEqual(r.status_code, 200)
        return r.json()["user"]

    def section(self, name):
        return [d["id"] for d in self.client.get(f"/api/documents/?section={name}").json()]

    def register(self, signer="chairman", **overrides):
        signer_id = next(u["id"] for u in self.client.get("/api/users/").json()
                         if u["full_name"] == self.NAMES[signer])
        data = {
            "kind": DocumentKind.objects.first().id,
            "subject": "Тема",
            "content": "Содержание",
            "languages": json.dumps(["state"]),
            "recipients": json.dumps([{"type": "org", "name": "Секретариат ОДКБ"}]),
            "approvers": json.dumps([signer_id]),
            "official": SimpleUploadedFile("doc.pdf", b"%PDF-1.4"),
        }
        data.update(overrides)
        return self.client.post("/api/documents/", data)

    NAMES = {
        "chairman": "Асанов Б.К.", "udo": "Жумабаева А.Т.",
        "executor1": "Токтогулов Н.С.", "executor2": "Садыкова Д.М.", "executor3": "Осмонов Э.Р.",
        "deputy": "Бейшеналиев К.А.",
    }

    def uid(self, username):
        return next(u["id"] for u in self.client.get("/api/users/").json() if u["full_name"] == self.NAMES[username])

    def test_requires_login(self):
        self.assertEqual(self.client.get("/api/menu/").status_code, 401)

    def test_only_udo_adds_kinds(self):
        self.login("executor1")
        r = self.client.post("/api/kinds/", {"name": "Новый"}, content_type="application/json")
        self.assertEqual(r.status_code, 403)
        self.login("udo")
        r = self.client.post("/api/kinds/", {"name": "Новый"}, content_type="application/json")
        self.assertEqual(r.status_code, 201)

    def test_missing_fields(self):
        self.login("executor1")
        r = self.register(subject="", content="", official="")
        self.assertEqual(r.status_code, 400)
        self.assertIn("subject", r.json()["fields"])
        self.assertIn("official", r.json()["fields"])

    def test_bad_file_extension(self):
        self.login("executor1")
        r = self.register(official=SimpleUploadedFile("x.exe", b"MZ"))
        self.assertEqual(r.json()["code"], "badFile")

    def test_full_workflow(self):
        # подписывающим можно выбрать только администратора
        self.login("executor1")
        r = self.register(signer="executor3")
        self.assertEqual(r.json()["code"], "signerNotAdmin")
        admins = [u["full_name"] for u in self.client.get("/api/users/?admin=1").json()]
        self.assertEqual(sorted(admins), ["Асанов Б.К.", "Бейшеналиев К.А."])

        # executor1 регистрирует документ, подписывающим выбирает заместителя (админ, не председатель)
        doc = self.register(signer="deputy").json()
        self.assertEqual(doc["status"], Document.PENDING)
        self.assertEqual(doc["number"], "")
        self.assertEqual(doc["signer"]["full_name"], "Бейшеналиев К.А.")
        self.assertIn(doc["id"], self.section("ya-sozdal"))
        self.assertEqual(self.section("ozhidanie-registracii"), [])

        # УДО: документ в «Ожидание регистрации» → регистрирует → «На резолюцию»
        self.login("udo")
        self.assertIn(doc["id"], self.section("ozhidanie-registracii"))
        self.assertNotIn(doc["id"], self.section("na-rezolyuciyu"))
        self.assertTrue(self.client.get(f"/api/documents/{doc['id']}/").json()["can"]["register"])
        r = self.client.post(f"/api/documents/{doc['id']}/register/").json()
        self.assertEqual(r["status"], Document.REGISTERED)
        self.assertEqual(r["number"], f"ИСХ-{doc['id']:04d}")
        self.assertEqual(self.client.post(f"/api/documents/{doc['id']}/register/").status_code, 403)
        # до оформления резолюции остаётся в «Ждет регистрацию»
        self.assertIn(doc["id"], self.section("ozhidanie-registracii"))
        self.assertIn(doc["id"], self.section("na-rezolyuciyu"))
        url = f"/api/documents/{doc['id']}/resolution/"
        r = self.client.post(url, {"executor_ids": []}, content_type="application/json")
        self.assertEqual(r.json()["code"], "executorsRequired")
        ex2 = self.uid("executor2")
        ex1 = self.uid("executor1")
        r = self.client.post(url, {"executor_ids": [ex2, ex1], "text": "Исполнить", "type": "info",
                                   "deadline": "2026-12-01"}, content_type="application/json")
        d = r.json()
        self.assertEqual(d["status"], Document.ON_SIGNING)
        self.assertEqual(d["resolution"]["lead"]["full_name"], "Садыкова Д.М.")
        self.assertEqual(d["resolution"]["author"]["full_name"], "Бейшеналиев К.А.")
        self.assertNotIn(doc["id"], self.section("na-rezolyuciyu"))
        self.assertNotIn(doc["id"], self.section("ozhidanie-registracii"))

        # до подписи исполнитель документ не видит
        self.login("executor2")
        self.assertNotIn(doc["id"], self.section("svodyashchiy"))
        self.assertEqual(self.client.get(f"/api/documents/{doc['id']}/").status_code, 404)

        # председатель не может подписать — подписывает выбранный заместитель
        self.login("chairman")
        self.assertEqual(self.client.post(f"/api/documents/{doc['id']}/sign/").status_code, 403)
        self.assertNotIn(doc["id"], self.section("na-podpis"))
        self.login("deputy")
        menu = self.client.get("/api/menu/").json()
        na_podpis = next(i for i in menu["waiting"]["items"] if i["id"] == "na-podpis")
        self.assertEqual(na_podpis["count"], 1)
        self.assertTrue(self.client.get(f"/api/documents/{doc['id']}/").json()["can"]["sign"])
        r = self.client.post(f"/api/documents/{doc['id']}/sign/")
        self.assertEqual(r.json()["status"], Document.SIGNED)

        # после подписи — у исполнителей в «Вы сводящий», открытие = ознакомление
        self.login("executor2")
        self.assertIn(doc["id"], self.section("svodyashchiy"))
        count = lambda: next(i for i in self.client.get("/api/menu/").json()["waiting"]["items"]
                             if i["id"] == "svodyashchiy")["count"]
        self.assertEqual(count(), 1)
        d = self.client.get(f"/api/documents/{doc['id']}/").json()
        self.assertEqual(count(), 0)
        me = next(e for e in d["executors"] if e["full_name"] == "Садыкова Д.М.")
        self.assertTrue(me["is_lead"])
        self.assertIsNotNone(me["acknowledged_at"])
        self.assertEqual([e["event"] for e in d["timeline"]],
                         ["submitted", "registered", "resolution", "signed", "acknowledged"])
        self.assertEqual(self.client.post(f"/api/documents/{doc['id']}/close/").status_code, 403)

        # раздел «На подпись» есть только у админов
        self.login("udo")
        menu_ids = [i["id"] for i in self.client.get("/api/menu/").json()["waiting"]["items"]]
        self.assertNotIn("na-podpis", menu_ids)
        self.assertEqual(self.section("na-podpis"), [])
        self.assertEqual(self.client.get(f"/api/documents/{doc['id']}/").json()["status"], Document.SIGNED)

        # подписанный документ ждёт закрытия в УДО
        self.assertIn(doc["id"], self.section("zhdet-zakrytiya"))
        r = self.client.post(f"/api/documents/{doc['id']}/close/").json()
        self.assertEqual(r["status"], Document.CLOSED)
        self.assertEqual(r["timeline"][-1]["event"], "closed")
        self.assertNotIn(doc["id"], self.section("zhdet-zakrytiya"))

        # закрытый документ готов к архивированию
        self.assertIn(doc["id"], self.section("gotovo-k-arhivirovaniyu"))
        r = self.client.post(f"/api/documents/{doc['id']}/archive/").json()
        self.assertEqual(r["status"], Document.ARCHIVED)
        self.assertEqual(r["timeline"][-1]["event"], "archived")
        self.assertNotIn(doc["id"], self.section("gotovo-k-arhivirovaniyu"))
        self.assertIn(doc["id"], self.section("arhiv"))

        # исполнитель по-прежнему видит документ, в т.ч. в архиве
        self.login("executor2")
        self.assertEqual(self.client.get(f"/api/documents/{doc['id']}/").status_code, 200)
        self.assertIn(doc["id"], self.section("arhiv"))

    def test_udo_menu_sections(self):
        self.login("udo")
        ids = [i["id"] for i in self.client.get("/api/menu/").json()["waiting"]["items"]]
        self.assertEqual(ids, ["oznakomitsya", "ozhidanie-registracii", "zhdet-zakrytiya", "otkazannye",
                               "na-dorabotke", "gotovo-k-arhivirovaniyu"])

    def test_rework_and_resubmit(self):
        self.login("executor1")
        doc = self.register().json()
        self.login("udo")
        url = f"/api/documents/{doc['id']}/rework/"
        self.assertEqual(self.client.post(url, {"comment": ""}, content_type="application/json").json()["code"],
                         "commentRequired")
        r = self.client.post(url, {"comment": "Приложите скан с подписью"}, content_type="application/json").json()
        self.assertEqual(r["status"], Document.REWORK)
        self.assertIn(doc["id"], self.section("na-dorabotke"))
        self.assertNotIn(doc["id"], self.section("ozhidanie-registracii"))

        # автор видит раздел «На доработке» и отправляет повторно с новым файлом
        self.login("executor2")
        self.assertEqual(self.client.post(f"/api/documents/{doc['id']}/resubmit/").status_code, 404)
        self.login("executor1")
        menu = {i["id"]: i for i in self.client.get("/api/menu/").json()["waiting"]["items"]}
        self.assertEqual(menu["na-dorabotke"]["count"], 1)
        d = self.client.get(f"/api/documents/{doc['id']}/").json()
        self.assertTrue(d["can"]["resubmit"])
        self.assertEqual(d["return_comment"], "Приложите скан с подписью")
        r = self.client.post(f"/api/documents/{doc['id']}/resubmit/",
                             {"official": SimpleUploadedFile("new.pdf", b"%PDF-1.4")}).json()
        self.assertEqual(r["status"], Document.PENDING)
        self.assertEqual([a["name"] for a in r["attachments"] if a["kind"] == "official"], ["new.pdf"])
        self.assertEqual([e["event"] for e in r["timeline"]], ["submitted", "returned", "resubmitted"])
        self.assertNotIn("na-dorabotke", [i["id"] for i in self.client.get("/api/menu/").json()["waiting"]["items"]])

        self.login("udo")
        self.assertIn(doc["id"], self.section("ozhidanie-registracii"))
        r = self.client.post(f"/api/documents/{doc['id']}/register/").json()
        self.assertEqual([e["event"] for e in r["timeline"]], ["submitted", "returned", "resubmitted", "registered"])
        # зарегистрированный, но без резолюции — всё ещё в «Ждет регистрацию»
        self.assertIn(doc["id"], self.section("ozhidanie-registracii"))

    def test_udo_rejects(self):
        self.login("executor1")
        doc = self.register().json()
        self.assertEqual(self.client.post(f"/api/documents/{doc['id']}/reject/", {"reason": "x"},
                                          content_type="application/json").status_code, 403)
        self.login("udo")
        url = f"/api/documents/{doc['id']}/reject/"
        r = self.client.post(url, {"reason": "  "}, content_type="application/json")
        self.assertEqual(r.json()["code"], "reasonRequired")
        r = self.client.post(url, {"reason": "Нет подписи на скане"}, content_type="application/json").json()
        self.assertEqual(r["status"], Document.REJECTED)
        self.assertEqual(r["reject_reason"], "Нет подписи на скане")
        self.assertIsNone(r["resolution"])
        self.assertIn(doc["id"], self.section("otkazannye"))
        self.assertNotIn(doc["id"], self.section("ozhidanie-registracii"))
        self.assertEqual(self.client.post(f"/api/documents/{doc['id']}/register/").status_code, 403)
        menu = {i["id"]: i for i in self.client.get("/api/menu/").json()["waiting"]["items"]}
        self.assertEqual(menu["otkazannye"]["count"], 1)
        self.assertEqual(menu["ozhidanie-registracii"]["count"], 0)

        # автор видит отказ и причину
        self.login("executor1")
        d = self.client.get(f"/api/documents/{doc['id']}/").json()
        self.assertEqual(d["status"], Document.REJECTED)
        self.assertEqual([e["event"] for e in d["timeline"]], ["submitted", "rejected"])
        self.assertEqual(self.section("otkazannye"), [])

    def test_udo_document_registered_immediately(self):
        self.login("udo")
        doc = self.register().json()
        self.assertEqual(doc["status"], Document.REGISTERED)
        self.assertEqual(doc["number"], f"ИСХ-{doc['id']:04d}")

    def test_favorite_and_download(self):
        self.login("executor1")
        doc = self.register().json()
        self.assertFalse(doc["is_favorite"])
        r = self.client.post(f"/api/documents/{doc['id']}/favorite/")
        self.assertTrue(r.json()["is_favorite"])
        self.assertIn(doc["id"], self.section("izbrannye"))
        self.login("udo")
        self.assertNotIn(doc["id"], self.section("izbrannye"))
        url = doc["attachments"][0]["url"]
        self.assertIn("inline", self.client.get(url)["Content-Disposition"])
        self.assertIn("attachment", self.client.get(url + "?download=1")["Content-Disposition"])

    def test_executor_cannot_see_foreign_document(self):
        self.login("executor1")
        doc = self.register().json()
        self.login("executor2")
        self.assertEqual(self.client.get(f"/api/documents/{doc['id']}/").status_code, 404)
        att = doc["attachments"][0]["url"]
        self.assertEqual(self.client.get(att).status_code, 404)


@override_settings(MEDIA_ROOT=TMP_MEDIA)
class LibraryTests(TestCase):
    def login(self, username):
        self.client.logout()
        self.client.post("/api/auth/login/", {"username": username, "password": "1234"}, content_type="application/json")

    def test_only_udo_adds_and_everyone_downloads(self):
        self.login("executor1")
        r = self.client.post("/api/library/", {"category": "templates", "name": "Шаблон", "text": "x"})
        self.assertEqual(r.status_code, 403)

        self.login("udo")
        r = self.client.post("/api/library/", {"category": "blanks", "name": "Бланк"})
        self.assertEqual(r.json()["code"], "textOrFile")
        r = self.client.post("/api/library/", {
            "category": "blanks", "name": "Бланк письма",
            "file": SimpleUploadedFile("blank.docx", b"PK\x03\x04"),
        })
        self.assertEqual(r.status_code, 201)
        item = r.json()

        self.login("executor1")
        items = self.client.get("/api/library/?category=blanks").json()
        self.assertEqual([i["id"] for i in items], [item["id"]])
        self.assertEqual(self.client.get("/api/library/?category=templates").json(), [])
        r = self.client.get(item["download_url"])
        self.assertEqual(r.status_code, 200)
        self.assertIn("attachment", r["Content-Disposition"])
        self.assertEqual(self.client.delete(f"/api/library/{item['id']}/").status_code, 403)
