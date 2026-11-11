"""Maintainer notes: a per-ticket layer that only maintainers can read.

Every endpoint checks that the session user is a maintainer who can read the
ticket. Realtime events go to each maintainer's user room and carry ids only,
never the ticket's document room, which every agent on the ticket joins.
"""

from urllib.parse import quote

import frappe
from bs4 import BeautifulSoup
from frappe import _
from frappe.desk.doctype.notification_log.notification_log import (
    enqueue_create_notification,
)
from frappe.utils import get_fullname

from helpdesk.consts import MAINTAINER_ROLE
from helpdesk.helpdesk.doctype.hd_maintainer_note.hd_maintainer_note import (
    can_access_ticket,
)
from helpdesk.utils import extract_mentions, is_admin, is_maintainer

NOTE_DOCTYPE = "HD Maintainer Note"
REALTIME_EVENT = "helpdesk:maintainer-note-update"
NOTE_FIELDS = [
    "name",
    "ticket",
    "content",
    "owner",
    "creation",
    "modified",
    "edited_at",
]


@frappe.whitelist()
def get_notes(ticket: str) -> list[dict]:
    check_access(ticket)
    notes = frappe.get_list(
        NOTE_DOCTYPE,
        filters={"ticket": ticket},
        fields=NOTE_FIELDS,
        order_by="creation asc",
    )
    return serialize(notes)


@frappe.whitelist()
def add_note(ticket: str, content: str, attachments: list[dict] | None = None) -> dict:
    check_access(ticket)
    note = frappe.get_doc(
        {"doctype": NOTE_DOCTYPE, "ticket": ticket, "content": content}
    ).insert()
    urls = attachment_urls(attachments) + embedded_urls(note.content)
    claim_files(note.name, ticket, urls)
    notify_mentions(note, mentioned_users(note.content))
    publish(ticket, note.name, "add")
    return get_note(note.name)


@frappe.whitelist()
def edit_note(name: str, content: str) -> dict:
    check_access(frappe.db.get_value(NOTE_DOCTYPE, name, "ticket"))
    note = frappe.get_doc(NOTE_DOCTYPE, name)
    mentioned_before = mentioned_users(note.content)
    note.content = content
    note.save()
    claim_files(note.name, note.ticket, embedded_urls(note.content))
    notify_mentions(note, mentioned_users(note.content) - mentioned_before)
    publish(note.ticket, note.name, "edit")
    return get_note(note.name)


@frappe.whitelist()
def delete_note(name: str) -> None:
    ticket = frappe.db.get_value(NOTE_DOCTYPE, name, "ticket")
    check_access(ticket)
    frappe.delete_doc(NOTE_DOCTYPE, name)
    publish(ticket, name, "delete")


@frappe.whitelist()
def get_maintainers() -> list[dict]:
    """Mention suggestions for the note editor."""
    if not is_maintainer():
        frappe.throw(
            _("You are not permitted to access maintainer notes"),
            frappe.PermissionError,
        )
    users = maintainer_users()
    return sorted(
        ({"name": u.name, "full_name": u.full_name, "image": u.image} for u in users),
        key=lambda u: (u["full_name"] or u["name"]).lower(),
    )


def check_access(ticket: str | None) -> None:
    # a missing note or ticket fails the same way, so ids leak nothing
    if not ticket or not frappe.db.exists("HD Ticket", ticket):
        allowed = False
    else:
        allowed = can_access_ticket(ticket)
    if not allowed:
        frappe.throw(
            _("You are not permitted to access maintainer notes"),
            frappe.PermissionError,
        )


def get_note(name: str) -> dict:
    note = frappe.db.get_value(NOTE_DOCTYPE, name, NOTE_FIELDS, as_dict=True)
    return serialize([note])[0]


def serialize(notes: list[dict]) -> list[dict]:
    if not notes:
        return []
    owners = {n.owner for n in notes}
    users = {
        u.name: u
        for u in frappe.get_all(
            "User",
            filters={"name": ["in", list(owners)]},
            fields=["name", "full_name", "user_image"],
        )
    }
    files = frappe.get_all(
        "File",
        filters={
            "attached_to_doctype": NOTE_DOCTYPE,
            "attached_to_name": ["in", [n.name for n in notes]],
        },
        fields=["name", "file_name", "file_url", "is_private", "attached_to_name"],
        order_by="creation asc",
    )
    session_user = frappe.session.user
    result = []
    for note in notes:
        user = users.get(note.owner) or frappe._dict(name=note.owner)
        result.append(
            {
                **{field: note.get(field) for field in NOTE_FIELDS},
                "user": {
                    "name": user.name,
                    "full_name": user.full_name or user.name,
                    "image": user.user_image,
                },
                "attachments": [
                    {
                        "name": f.name,
                        "file_name": f.file_name,
                        "file_url": f.file_url,
                        "is_private": f.is_private,
                    }
                    for f in files
                    if f.attached_to_name == note.name
                ],
                "can_edit": note.owner == session_user or is_admin(session_user),
            }
        )
    return result


def attachment_urls(attachments: list[dict] | str | None) -> list[str]:
    if isinstance(attachments, str):
        attachments = frappe.parse_json(attachments)
    urls = []
    for attachment in attachments or []:
        url = attachment.get("file_url")
        if not url and attachment.get("name"):
            url = frappe.db.get_value("File", attachment.get("name"), "file_url")
        if url:
            urls.append(url)
    return urls


def embedded_urls(content: str | None) -> list[str]:
    soup = BeautifulSoup(content or "", "html.parser")
    return [
        tag["src"] for tag in soup.find_all(["img", "video"]) if tag.has_attr("src")
    ]


def claim_files(note: str, ticket: str, urls: list[str]) -> None:
    """Move the session user's uploads onto the note.

    Same rule as `HDTicket.claim_comment_files`: the editor uploads against
    the ticket, which client staff and the customer can read, and any one
    readable File row serves the url (frappe's `find_file_by_url`). So no row
    of these files may stay on the ticket.
    """
    if not urls:
        return
    user = frappe.session.user
    on_ticket = frappe.get_all(
        "File",
        filters={
            "file_url": ["in", urls],
            "attached_to_doctype": "HD Ticket",
            "attached_to_name": ticket,
            "owner": user,
        },
        fields=["name", "file_url"],
    )
    # an upload that was never attached anywhere moves as well
    loose = frappe.get_all(
        "File",
        filters={
            "file_url": ["in", urls],
            "owner": user,
            "is_folder": 0,
            "attached_to_doctype": ["is", "not set"],
        },
        fields=["name", "file_url"],
    )
    for file in on_ticket + loose:
        frappe.db.set_value(
            "File",
            file.name,
            {"attached_to_doctype": NOTE_DOCTYPE, "attached_to_name": note},
        )
    drop_attachment_comments(ticket, {f.file_url for f in on_ticket})
    # own uploads only: a row on the note makes its url servable to maintainers
    owned = frappe.get_all(
        "File",
        filters={"file_url": ["in", urls], "owner": user, "is_folder": 0},
        pluck="file_url",
    )
    for url in set(owned):
        attach_file(note, url)


def attach_file(note: str, file_url: str) -> None:
    if frappe.db.exists(
        "File",
        {
            "file_url": file_url,
            "attached_to_doctype": NOTE_DOCTYPE,
            "attached_to_name": note,
        },
    ):
        return
    file = frappe.new_doc("File")
    file.attached_to_doctype = NOTE_DOCTYPE
    file.attached_to_name = note
    file.file_url = file_url
    file.save(ignore_permissions=True)


def drop_attachment_comments(ticket: str, urls: set[str]) -> None:
    """The upload left an "Attachment" comment with the file name on the
    ticket's timeline, where client staff read it."""
    for url in urls:
        quoted = quote(frappe.safe_encode(url), safe="/:")
        frappe.db.delete(
            "Comment",
            {
                "reference_doctype": "HD Ticket",
                "reference_name": ticket,
                "comment_type": "Attachment",
                "content": ["like", f"%{quoted}%"],
            },
        )


def mentioned_users(content: str | None) -> set[str]:
    return {m.email for m in extract_mentions(content) if m.email}


def notify_mentions(note, users: set[str]) -> None:
    """One Mention notification per mentioned maintainer, in core Notification
    Log like comment mentions. Only maintainers can be mentioned (the
    controller rejects anyone else), so the email may quote the note."""
    users = {u for u in users if u != frappe.session.user and is_maintainer(u)}
    if not users:
        return
    enqueue_create_notification(
        list(users),
        {
            "type": "Mention",
            "document_type": "HD Ticket",
            "document_name": note.ticket,
            "source_doctype": NOTE_DOCTYPE,
            "source_name": note.name,
            "subject": _(
                "{0} mentioned you in a maintainer note on ticket #{1}"
            ).format(get_fullname(frappe.session.user), note.ticket),
            "from_user": frappe.session.user,
            "email_content": note.content,
            "app": "helpdesk",
        },
    )


def maintainer_users() -> list[dict]:
    """Enabled users holding the maintainer role who are also active agents."""
    HasRole = frappe.qb.DocType("Has Role")
    User = frappe.qb.DocType("User")
    rows = (
        frappe.qb.from_(HasRole)
        .join(User)
        .on(User.name == HasRole.parent)
        .select(User.name, User.full_name, User.user_image.as_("image"))
        .where(HasRole.parenttype == "User")
        .where(HasRole.role == MAINTAINER_ROLE)
        .where(User.enabled == 1)
        .distinct()
        .run(as_dict=True)
    )
    return [row for row in rows if is_maintainer(row.name)]


def publish(ticket: str, note: str, action: str) -> None:
    """Ids only; each client refetches through `get_notes`, which checks access."""
    payload = {"ticket": ticket, "note": note, "action": action}
    users = {u.name for u in maintainer_users()} | {"Administrator"}
    for user in sorted(users):
        if not can_access_ticket(ticket, user):
            continue
        frappe.publish_realtime(REALTIME_EVENT, payload, user=user, after_commit=True)
