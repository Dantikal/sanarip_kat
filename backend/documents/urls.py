from django.urls import path

from . import views

urlpatterns = [
    path("auth/me/", views.me, name="me"),
    path("auth/login/", views.login_view, name="login"),
    path("auth/logout/", views.logout_view, name="logout"),
    path("users/", views.users, name="users"),
    path("references/", views.references, name="references"),
    path("menu/", views.menu, name="menu"),
    path("kinds/", views.kinds, name="kinds"),
    path("kinds/<int:pk>/", views.kind_detail, name="kind-detail"),
    path("documents/", views.documents, name="documents"),
    path("documents/<int:pk>/", views.document_detail, name="document-detail"),
    path("documents/<int:pk>/register/", views.document_register, name="document-register"),
    path("documents/<int:pk>/reject/", views.document_reject, name="document-reject"),
    path("documents/<int:pk>/close/", views.document_close, name="document-close"),
    path("documents/<int:pk>/rework/", views.document_rework, name="document-rework"),
    path("documents/<int:pk>/resubmit/", views.document_resubmit, name="document-resubmit"),
    path("documents/<int:pk>/archive/", views.document_archive, name="document-archive"),
    path("documents/<int:pk>/resolution/", views.document_resolution, name="document-resolution"),
    path("documents/<int:pk>/sign/", views.document_sign, name="document-sign"),
    path("documents/<int:pk>/favorite/", views.document_favorite, name="document-favorite"),
    path("attachments/<int:pk>/", views.attachment, name="attachment"),
    path("library/", views.library, name="library"),
    path("library/<int:pk>/", views.library_detail, name="library-detail"),
    path("library/<int:pk>/download/", views.library_download, name="library-download"),
]
