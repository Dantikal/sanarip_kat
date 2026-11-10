from django.contrib import admin

from .models import Approver, Attachment, Document, DocumentKind, LibraryItem, Profile


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("full_name", "user", "role", "is_admin", "position", "department")
    list_filter = ("role", "is_admin")
    list_editable = ("is_admin",)


@admin.register(DocumentKind)
class DocumentKindAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "created_by")


class ApproverInline(admin.TabularInline):
    model = Approver
    extra = 0


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("number", "subject", "kind", "status", "created_by", "created_at")
    list_filter = ("status", "kind")
    inlines = [ApproverInline, AttachmentInline]


@admin.register(LibraryItem)
class LibraryItemAdmin(admin.ModelAdmin):
    list_display = ("name", "category", "file_name", "created_by", "created_at")
    list_filter = ("category",)
