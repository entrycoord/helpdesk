# Copyright (c) 2026, Frappe Technologies and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model import no_value_fields
from frappe.model.document import Document
from frappe.utils import now_datetime

from helpdesk.utils import extract_mentions, is_admin, is_maintainer

# the only fields an update may change; the rest is fixed at insert
EDITABLE_FIELDS = ("content", "edited_at")


class HDMaintainerNote(Document):
    def validate(self):
        if self.is_new():
            self.validate_author()
        else:
            self.validate_update()
        if self.is_new() or self.has_value_changed("content"):
            self.validate_mentions()

    def validate_author(self):
        if not can_access_ticket(self.ticket):
            frappe.throw(
                _("You are not permitted to add a maintainer note"),
                frappe.PermissionError,
            )

    def validate_update(self):
        if frappe.session.user != self.owner and not is_admin():
            frappe.throw(
                _("Only the author can edit a maintainer note"), frappe.PermissionError
            )
        before = self.get_doc_before_save()
        if not before:
            return
        fixed = [
            df.fieldname
            for df in self.meta.fields
            if df.fieldtype not in no_value_fields
            and df.fieldname not in EDITABLE_FIELDS
        ] + ["owner", "creation"]
        for fieldname in fixed:
            if self.get(fieldname) != before.get(fieldname):
                frappe.throw(
                    _("Only the content of a maintainer note can be changed"),
                    frappe.ValidationError,
                )
        if self.has_value_changed("content"):
            self.edited_at = now_datetime()

    def validate_mentions(self):
        for mention in extract_mentions(self.content):
            if not mention.email or not is_maintainer(mention.email):
                frappe.throw(
                    _("Only maintainers can be mentioned in a maintainer note"),
                    frappe.ValidationError,
                )

    def on_trash(self):
        # ignore_permissions: a system path, e.g. deleting the ticket
        if (
            not self.flags.ignore_permissions
            and frappe.session.user != self.owner
            and not is_admin()
        ):
            frappe.throw(
                _("Only the author can delete a maintainer note"),
                frappe.PermissionError,
            )
        for name in frappe.get_all(
            "File",
            filters={
                "attached_to_doctype": self.doctype,
                "attached_to_name": self.name,
            },
            pluck="name",
        ):
            frappe.delete_doc("File", name, ignore_permissions=True)
        # Notification Log.source_name links here and would block the delete
        frappe.db.delete(
            "Notification Log",
            {"source_doctype": self.doctype, "source_name": self.name},
        )


def can_access_ticket(ticket: str | None, user: str | None = None) -> bool:
    """A maintainer who may read the ticket."""
    user = user or frappe.session.user
    if not ticket or not is_maintainer(user):
        return False
    return bool(frappe.has_permission("HD Ticket", "read", doc=ticket, user=user))


def has_permission(doc, ptype: str = "read", user: str | None = None, **kwargs) -> bool:
    user = user or frappe.session.user
    if not doc.ticket:
        return is_maintainer(user)
    return can_access_ticket(doc.ticket, user)


def permission_query(user: str | None = None, **kwargs) -> str:
    """Second line behind DocPerm: list and report views stay empty for everyone else."""
    from helpdesk.helpdesk.doctype.hd_ticket.hd_ticket import (
        permission_query as ticket_query,
    )

    user = user or frappe.session.user
    if not is_maintainer(user):
        return "1=0"
    # a maintainer on a restricted team lists only notes of tickets they can read
    ticket_condition = ticket_query(user)
    if not ticket_condition:
        return ""
    return (
        "`tabHD Maintainer Note`.ticket in "
        "(select `tabHD Ticket`.name from `tabHD Ticket` where "
        + ticket_condition
        + ")"
    )
