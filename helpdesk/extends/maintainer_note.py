"""HD Ticket lifecycle for maintainer notes."""

import frappe


def on_ticket_trash(doc, method: str | None = None):
    """Delete the ticket's notes. Frappe runs on_trash before its link check,
    so the check then finds nothing."""
    for name in frappe.get_all(
        "HD Maintainer Note", filters={"ticket": doc.name}, pluck="name"
    ):
        # ignore_permissions: notes of every author go with the ticket
        frappe.delete_doc("HD Maintainer Note", name, ignore_permissions=True)
