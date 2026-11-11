"""Maintainer notes: a per-ticket layer only maintainers can read.

Personas are a maintainer (agent + maintainer role), client staff (a plain
agent) and an end customer with a portal contact.
"""

import json
from unittest.mock import patch

import frappe
from frappe.api.v1 import read_doc
from frappe.core.doctype.file.utils import find_file_by_url
from frappe.tests.utils import FrappeTestCase, change_settings

from helpdesk.api.maintainer_note import (
    REALTIME_EVENT,
    add_note,
    delete_note,
    edit_note,
    get_maintainers,
    get_notes,
)
from helpdesk.consts import MAINTAINER_ROLE
from helpdesk.helpdesk.doctype.hd_maintainer_note.hd_maintainer_note import (
    permission_query,
)
from helpdesk.helpdesk.doctype.hd_ticket.api import get_one, merge_ticket, split_ticket
from helpdesk.test_utils import create_agent, create_contact, make_team, make_ticket
from helpdesk.utils import get_doc_room

NOTE = "HD Maintainer Note"
MAINT = "mnote-maint1@example.com"
MAINT2 = "mnote-maint2@example.com"
MAINT_RESTRICTED = "mnote-maint3@example.com"
STAFF = "mnote-staff1@example.com"
CUSTOMER = "mnote-customer1@example.com"
ROLE_ONLY = "mnote-roleonly@example.com"


def mention(email: str) -> str:
    return (
        f'<span class="mention" data-type="mention" data-id="{email}" '
        f'data-label="{email}">@{email}</span>'
    )


def visible_notes(ticket: str) -> list[str]:
    """What list and report views show the session user."""
    try:
        return frappe.get_list(NOTE, filters={"ticket": ticket}, pluck="name")
    except frappe.PermissionError:
        return []


class TestMaintainerNote(FrappeTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        for email in (MAINT, MAINT2, MAINT_RESTRICTED):
            create_agent(email)
            frappe.get_doc("User", email).add_roles(MAINTAINER_ROLE)
        create_agent(STAFF)
        create_contact("Mnote Customer", CUSTOMER)
        # a role handed out by mistake to someone who is not an agent
        create_contact("Mnote Role Only", ROLE_ONLY)
        frappe.get_doc("User", ROLE_ONLY).add_roles(MAINTAINER_ROLE)

        maintainers = make_team("Mnote Maintainers", [MAINT, MAINT2])
        frappe.db.set_value("HD Team", maintainers.name, "ignore_restrictions", 1)
        make_team("Mnote Restricted", [MAINT_RESTRICTED])
        cls.staff_team = make_team("Mnote Staff", [STAFF]).name

    def setUp(self):
        frappe.set_user("Administrator")
        frappe.db.set_single_value("HD Settings", "restrict_tickets_by_agent_group", 0)
        self.ticket = make_ticket(raised_by=CUSTOMER).name

    def tearDown(self):
        frappe.set_user("Administrator")

    def add(self, content: str = "<p>maintainer only</p>", user: str = MAINT, **kw):
        with self.set_user(user):
            return add_note(self.ticket, content, **kw)

    def upload(self, user: str = MAINT) -> frappe._dict:
        """A private file uploaded against the ticket, as the editor does."""
        with self.set_user(user):
            # unique content: frappe shares one file_url between equal uploads
            token = frappe.generate_hash(length=8)
            file = frappe.get_doc(
                {
                    "doctype": "File",
                    "file_name": f"mnote-{token}.txt",
                    "content": f"maintainer secret {token}".encode(),
                    "is_private": 1,
                    "attached_to_doctype": "HD Ticket",
                    "attached_to_name": self.ticket,
                }
            ).insert(ignore_permissions=True)
        return frappe._dict(name=file.name, file_url=file.file_url)

    # the editor uploads unattached, so the ticket never hears about the file
    def test_unattached_upload_lands_only_on_the_note(self):
        with self.set_user(MAINT):
            token = frappe.generate_hash(length=8)
            file = frappe.get_doc(
                {
                    "doctype": "File",
                    "file_name": f"mnote-{token}.txt",
                    "content": f"maintainer secret {token}".encode(),
                    "is_private": 1,
                }
            ).insert()
            note = add_note(
                self.ticket, "<p>see file</p>", attachments=[file.as_dict()]
            )
        attached = frappe.db.get_value(
            "File", file.name, ["attached_to_doctype", "attached_to_name"], as_dict=True
        )
        self.assertEqual(attached.attached_to_doctype, NOTE)
        self.assertEqual(attached.attached_to_name, note["name"])
        self.assertFalse(
            frappe.db.exists(
                "File",
                {"attached_to_doctype": "HD Ticket", "attached_to_name": self.ticket},
            )
        )
        self.assertFalse(
            frappe.db.exists(
                "Comment",
                {
                    "reference_doctype": "HD Ticket",
                    "reference_name": self.ticket,
                    "comment_type": "Attachment",
                },
            )
        )
        with self.set_user(STAFF):
            self.assertFalse(frappe.has_permission("File", doc=file.name))

    def assert_locked_out(self, user: str, note: str):
        with self.set_user(user):
            with self.assertRaises(frappe.PermissionError):
                get_notes(self.ticket)
            with self.assertRaises(frappe.PermissionError):
                add_note(self.ticket, "<p>sneaky</p>")
            with self.assertRaises(frappe.PermissionError):
                edit_note(note, "<p>sneaky</p>")
            with self.assertRaises(frappe.PermissionError):
                delete_note(note)
            with self.assertRaises(frappe.PermissionError):
                get_maintainers()
            self.assertEqual(visible_notes(self.ticket), [])
            self.assertEqual(permission_query(user), "1=0")
            self.assertFalse(frappe.has_permission(NOTE, "read", doc=note, user=user))
            # GET /api/resource/HD Maintainer Note/<name>
            with self.assertRaises(frappe.PermissionError):
                read_doc(NOTE, note)
        self.assertTrue(frappe.db.exists(NOTE, note))

    # 1
    def test_maintainer_adds_lists_edits_and_deletes_own_notes(self):
        first = self.add("<p>first</p>")
        second = self.add("<p>second</p>", user=MAINT2)
        self.assertEqual(first["ticket"], self.ticket)
        self.assertEqual(first["user"]["name"], MAINT)
        self.assertTrue(first["can_edit"])
        self.assertIsNone(first["edited_at"])
        self.assertEqual(first["attachments"], [])

        with self.set_user(MAINT):
            notes = get_notes(self.ticket)
            self.assertEqual(
                [n["name"] for n in notes], [first["name"], second["name"]]
            )
            self.assertEqual([n["can_edit"] for n in notes], [True, False])
            self.assertEqual(permission_query(MAINT), "")
            self.assertEqual(
                set(visible_notes(self.ticket)), {first["name"], second["name"]}
            )

            edited = edit_note(first["name"], "<p>first, edited</p>")
            self.assertIn("first, edited", edited["content"])
            self.assertIsNotNone(edited["edited_at"])
            self.assertEqual(edited["creation"], first["creation"])

            with self.assertRaises(frappe.PermissionError):
                edit_note(second["name"], "<p>not mine</p>")
            with self.assertRaises(frappe.PermissionError):
                delete_note(second["name"])

            delete_note(first["name"])
            self.assertEqual(
                [n["name"] for n in get_notes(self.ticket)], [second["name"]]
            )
        self.assertFalse(frappe.db.exists(NOTE, first["name"]))
        self.assertIn("second", frappe.db.get_value(NOTE, second["name"], "content"))

    def test_only_content_changes_after_insert(self):
        note = self.add()
        other = make_ticket(raised_by=CUSTOMER).name
        with self.set_user(MAINT):
            doc = frappe.get_doc(NOTE, note["name"])
            doc.ticket = other
            with self.assertRaises(frappe.ValidationError):
                doc.save()
        self.assertEqual(frappe.db.get_value(NOTE, note["name"], "ticket"), self.ticket)

    def test_administrator_may_delete_any_note(self):
        note = self.add()
        self.assertTrue(get_notes(self.ticket)[0]["can_edit"])
        delete_note(note["name"])
        self.assertFalse(frappe.db.exists(NOTE, note["name"]))

    def test_maintainers_for_mentions(self):
        with self.set_user(MAINT):
            names = [m["name"] for m in get_maintainers()]
        self.assertTrue({MAINT, MAINT2, MAINT_RESTRICTED} <= set(names))
        self.assertNotIn(STAFF, names)
        self.assertNotIn(ROLE_ONLY, names)
        self.assertEqual(set(get_maintainers()[0]), {"name", "full_name", "image"})

    # 2
    def test_client_staff_cannot_reach_notes(self):
        note = self.add()
        self.assert_locked_out(STAFF, note["name"])

    # 3
    def test_customer_cannot_reach_notes(self):
        note = self.add("<p>mnote-secret-words</p>")
        self.assert_locked_out(CUSTOMER, note["name"])
        with self.set_user(CUSTOMER):
            payload = json.dumps(get_one(self.ticket), default=str)
        self.assertNotIn("mnote-secret-words", payload)
        self.assertNotIn(note["name"], payload)

    def test_maintainer_role_without_agent_grants_nothing(self):
        """DocPerm lets the role read, the hooks still hold the line."""
        note = self.add()
        self.assert_locked_out(ROLE_ONLY, note["name"])

    # 4
    def test_maintainer_without_ticket_access_cannot_read_its_notes(self):
        self.enterContext(
            change_settings(
                "HD Settings",
                restrict_tickets_by_agent_group=1,
                do_not_restrict_tickets_without_an_agent_group=0,
            )
        )
        frappe.db.set_value("HD Ticket", self.ticket, "agent_group", self.staff_team)
        note = self.add()
        with self.set_user(MAINT_RESTRICTED):
            self.assertFalse(frappe.has_permission("HD Ticket", doc=self.ticket))
            with self.assertRaises(frappe.PermissionError):
                get_notes(self.ticket)
            with self.assertRaises(frappe.PermissionError):
                add_note(self.ticket, "<p>blind</p>")
            self.assertFalse(frappe.has_permission(NOTE, "read", doc=note["name"]))
            with self.assertRaises(frappe.PermissionError):
                read_doc(NOTE, note["name"])
            # list and report views are narrowed to readable tickets as well
            self.assertNotIn(note["name"], frappe.get_list(NOTE, pluck="name"))
        with self.set_user(MAINT):
            self.assertEqual(len(get_notes(self.ticket)), 1)
            self.assertIn(note["name"], frappe.get_list(NOTE, pluck="name"))

    # 5
    def test_mentioning_client_staff_is_rejected(self):
        with self.set_user(MAINT):
            with self.assertRaises(frappe.ValidationError) as raised:
                add_note(self.ticket, f"<p>hey {mention(STAFF)}</p>")
            self.assertNotIsInstance(raised.exception, frappe.PermissionError)
            self.assertEqual(get_notes(self.ticket), [])
            note = add_note(self.ticket, "<p>plain</p>")
            with self.assertRaises(frappe.ValidationError):
                edit_note(note["name"], f"<p>now {mention(STAFF)}</p>")
        self.assertNotIn(STAFF, frappe.db.get_value(NOTE, note["name"], "content"))

    def test_mentioning_a_maintainer_notifies_only_them(self):
        note = self.add(f"<p>look {mention(MAINT2)}</p>")
        rows = frappe.get_all(
            "Notification Log",
            filters={"source_doctype": NOTE, "source_name": note["name"]},
            fields=["for_user", "type", "document_type", "document_name", "app"],
        )
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].for_user, MAINT2)
        self.assertEqual(rows[0].type, "Mention")
        self.assertEqual(rows[0].document_type, "HD Ticket")
        self.assertEqual(rows[0].document_name, self.ticket)
        self.assertEqual(rows[0].app, "helpdesk")

        # an edit notifies only newly mentioned maintainers
        with self.set_user(MAINT):
            edit_note(
                note["name"],
                f"<p>look {mention(MAINT2)} {mention(MAINT_RESTRICTED)}</p>",
            )
        self.assertEqual(
            sorted(
                frappe.get_all(
                    "Notification Log",
                    filters={"source_doctype": NOTE, "source_name": note["name"]},
                    pluck="for_user",
                )
            ),
            sorted([MAINT2, MAINT_RESTRICTED]),
        )
        with self.set_user(STAFF):
            self.assertEqual(
                frappe.get_list(
                    "Notification Log", filters={"source_name": note["name"]}
                ),
                [],
            )

    # 6
    def test_attachment_moves_onto_the_note(self):
        file = self.upload()
        self.assertTrue(
            frappe.db.exists(
                "Comment",
                {
                    "reference_doctype": "HD Ticket",
                    "reference_name": self.ticket,
                    "comment_type": "Attachment",
                },
            )
        )
        note = self.add("<p>see file</p>", attachments=[file])

        self.assertEqual(
            [(a["name"], a["file_url"]) for a in note["attachments"]],
            [(file.name, file.file_url)],
        )
        self.assertEqual(note["attachments"][0]["is_private"], 1)
        rows = frappe.get_all(
            "File",
            filters={"file_url": file.file_url},
            fields=["attached_to_doctype", "attached_to_name"],
        )
        self.assertEqual(
            {(r.attached_to_doctype, r.attached_to_name) for r in rows},
            {(NOTE, note["name"])},
        )
        self.assertFalse(
            frappe.db.exists(
                "Comment",
                {
                    "reference_doctype": "HD Ticket",
                    "reference_name": self.ticket,
                    "comment_type": "Attachment",
                },
            ),
            "the upload's attachment comment would show the file name to staff",
        )

        for user in (STAFF, CUSTOMER):
            with self.set_user(user):
                self.assertIsNone(find_file_by_url(file.file_url), user)
                self.assertFalse(frappe.has_permission("File", "read", doc=file.name))
        with self.set_user(MAINT2):
            self.assertIsNotNone(find_file_by_url(file.file_url))

    def test_someone_elses_file_stays_where_it_is(self):
        file = self.upload(user=MAINT2)
        note = self.add("<p>borrowed</p>", attachments=[file])
        self.assertEqual(note["attachments"], [])
        self.assertEqual(
            frappe.db.get_value("File", file.name, "attached_to_doctype"), "HD Ticket"
        )

    def test_deleting_a_note_deletes_its_files(self):
        file = self.upload()
        note = self.add("<p>with file</p>", attachments=[file])
        with self.set_user(MAINT):
            delete_note(note["name"])
        self.assertFalse(frappe.db.exists("File", {"file_url": file.file_url}))

    # 7
    def test_realtime_goes_to_maintainer_rooms_only(self):
        with patch("frappe.publish_realtime") as publish:
            note = self.add(f"<p>hi {mention(MAINT2)}</p>")
            with self.set_user(MAINT):
                edit_note(note["name"], "<p>edited</p>")
                delete_note(note["name"])

        ticket_room = get_doc_room("HD Ticket", self.ticket)
        note_events = []
        for call in publish.call_args_list:
            kwargs = call.kwargs
            event = call.args[0] if call.args else kwargs.get("event")
            self.assertNotEqual(kwargs.get("room"), ticket_room, event)
            self.assertFalse(
                kwargs.get("doctype") == "HD Ticket"
                and kwargs.get("docname") == self.ticket,
                event,
            )
            self.assertNotIn(STAFF, (kwargs.get("user"), kwargs.get("room")), event)
            if event == REALTIME_EVENT:
                self.assertTrue(kwargs.get("user"))
                self.assertIsNone(kwargs.get("room"))
                self.assertTrue(kwargs.get("after_commit"))
                message = call.args[1] if len(call.args) > 1 else kwargs["message"]
                self.assertEqual(set(message), {"ticket", "note", "action"})
                self.assertEqual(message["ticket"], self.ticket)
                note_events.append((message["action"], kwargs["user"]))

        for action in ("add", "edit", "delete"):
            users = {user for a, user in note_events if a == action}
            self.assertTrue({MAINT, MAINT2} <= users, action)
            self.assertNotIn(STAFF, users)
            self.assertNotIn(CUSTOMER, users)

    # 8
    def test_deleting_the_ticket_deletes_its_notes(self):
        file = self.upload()
        first = self.add(f"<p>one {mention(MAINT2)}</p>", attachments=[file])
        second = self.add("<p>two</p>", user=MAINT2)
        frappe.delete_doc("HD Ticket", self.ticket)
        self.assertFalse(frappe.db.exists("HD Ticket", self.ticket))
        for note in (first, second):
            self.assertFalse(frappe.db.exists(NOTE, note["name"]))
        self.assertFalse(frappe.db.exists("File", {"file_url": file.file_url}))
        self.assertFalse(
            frappe.db.exists("Notification Log", {"source_name": first["name"]})
        )

    def test_merge_moves_notes_to_the_target(self):
        note = self.add()
        target = make_ticket(raised_by=CUSTOMER).name
        before = frappe.db.get_value(NOTE, note["name"], ["creation", "modified"])
        merge_ticket(source=self.ticket, target=target)
        self.assertEqual(frappe.db.get_value(NOTE, note["name"], "ticket"), target)
        self.assertEqual(
            frappe.db.get_value(NOTE, note["name"], ["creation", "modified"]), before
        )
        with self.set_user(MAINT):
            self.assertEqual(get_notes(self.ticket), [])
            self.assertEqual([n["name"] for n in get_notes(target)], [note["name"]])

    def test_split_leaves_notes_on_the_source(self):
        ticket = frappe.get_doc("HD Ticket", self.ticket)
        ticket.reply_via_agent(message="Reply to split off")
        communication = frappe.get_all(
            "Communication",
            filters={"reference_doctype": "HD Ticket", "reference_name": self.ticket},
            pluck="name",
        )[0]
        note = self.add()
        new_ticket = split_ticket("Split off", communication)
        self.assertNotEqual(new_ticket, self.ticket)
        self.assertEqual(frappe.db.get_value(NOTE, note["name"], "ticket"), self.ticket)
