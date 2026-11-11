import frappe

from helpdesk.consts import MAINTAINER_ROLE


def create_maintainer_role():
    """Desk role for the maintainers; it only unlocks maintainer notes."""
    if frappe.db.exists("Role", MAINTAINER_ROLE):
        return
    frappe.get_doc(
        {"doctype": "Role", "role_name": MAINTAINER_ROLE, "desk_access": 1}
    ).insert(ignore_permissions=True)
