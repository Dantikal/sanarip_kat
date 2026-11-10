from django.contrib.auth.hashers import make_password
from django.db import migrations

KINDS = [
    "Переписка с международными организациями (СНГ, ШОС, ОДКБ, СКПВ)",
    "Переписка с Военной прокуратурой КР",
    "Переписка с Генеральной прокуратурой КР",
    "Материалы по ЕАЭС",
    "Переписка с Судебными органами и адвокатурой КР",
    "Переписка с министерствами и ведомствами КР",
    "Переписка с АП и ЖК КР",
    "Переписка с Министерством обороны КР",
    "Переписка с МФ КР",
    "Переписка с МИД КР",
    "Переписка по пограничным вопросам с АП и АЖК КР",
    "Переписка с МЭиК КР",
    "Переписка с Национальным банком, общественными организациями, общественными фондами, частными банками",
    "Переписка с Государственным комитетом, агентством, инспекцией, фондом и уполномоченными представителями областей КР",
    "Переписка по ОУ",
]

# Demo accounts (password for all: 1234)
USERS = [
    ("chairman", "chairman", "Асанов Б.К.", "Председатель", "Руководство"),
    ("udo", "udo", "Жумабаева А.Т.", "Специалист УДО", "Управление делопроизводства (УДО)"),
    ("executor1", "executor", "Токтогулов Н.С.", "Начальник отдела", "Отдел кадров"),
    ("executor2", "executor", "Садыкова Д.М.", "Главный специалист", "Юридический отдел"),
    ("executor3", "executor", "Осмонов Э.Р.", "Ведущий специалист", "Финансовый отдел"),
]


def seed(apps, schema_editor):
    User = apps.get_model("auth", "User")
    Profile = apps.get_model("documents", "Profile")
    DocumentKind = apps.get_model("documents", "DocumentKind")

    for name in KINDS:
        DocumentKind.objects.get_or_create(name=name)

    for username, role, full_name, position, department in USERS:
        user, created = User.objects.get_or_create(
            username=username, defaults={"password": make_password("1234")}
        )
        Profile.objects.get_or_create(
            user=user,
            defaults={"role": role, "full_name": full_name, "position": position, "department": department},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0001_initial"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
