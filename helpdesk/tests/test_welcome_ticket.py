from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from helpdesk.api.onboarding import get_first_ticket
from helpdesk.consts import (
    LEGACY_WELCOME_TICKET_SUBJECTS,
    WELCOME_TICKET_SUBJECT,
    WELCOME_TICKET_SUBJECTS,
)
from helpdesk.setup import welcome_ticket
from helpdesk.test_utils import make_ticket

TICKET_MODULE = "helpdesk.helpdesk.doctype.hd_ticket.hd_ticket"
VENDOR_WORDS = ("frappe", "docs.", "http://", "https://")


class TestWelcomeTicket(FrappeTestCase):
    def setUp(self) -> None:
        frappe.set_user("Administrator")

    def test_both_the_old_and_the_new_subject_are_welcome_subjects(self) -> None:
        self.assertEqual(LEGACY_WELCOME_TICKET_SUBJECTS, ("Welcome to Helpdesk",))
        self.assertIn(WELCOME_TICKET_SUBJECT, WELCOME_TICKET_SUBJECTS)
        for subject in LEGACY_WELCOME_TICKET_SUBJECTS:
            self.assertIn(subject, WELCOME_TICKET_SUBJECTS)
        self.assertNotIn("frappe", WELCOME_TICKET_SUBJECT.lower())

    def test_text_has_no_vendor_name_or_link(self) -> None:
        text = welcome_ticket.CONTENT.lower()
        for word in VENDOR_WORDS:
            with self.subTest(word=word):
                self.assertNotIn(word, text)
        # no vendor image or video either, they are not shipped
        self.assertNotIn("/assets/helpdesk/desk/", text)

    def test_created_ticket_uses_the_subject_constant(self) -> None:
        with patch.object(frappe.db, "count", return_value=0):
            welcome_ticket.create_ticket()
        name = frappe.db.get_value(
            "HD Ticket", {"subject": WELCOME_TICKET_SUBJECT}, "name"
        )
        self.assertTrue(name)
        description = frappe.db.get_value("HD Ticket", name, "description").lower()
        self.assertNotIn("frappe", description)

    def test_first_ticket_skips_every_welcome_ticket(self) -> None:
        frappe.db.delete("HD Ticket")
        for subject in WELCOME_TICKET_SUBJECTS:
            make_ticket(subject=subject)
        self.assertIsNone(get_first_ticket())

        real = make_ticket(subject="A real customer question")
        self.assertEqual(get_first_ticket(), real.name)

    def test_no_ticket_created_event_for_any_welcome_ticket(self) -> None:
        def created_events(subject: str) -> list[str]:
            with patch(f"{TICKET_MODULE}.capture_event") as capture_event:
                make_ticket(subject=subject)
            return [
                call.args[0]
                for call in capture_event.call_args_list
                if call.args[0].startswith("ticket_created")
            ]

        # control: an ordinary ticket is reported
        self.assertIn("ticket_created", created_events("An ordinary subject"))
        for subject in WELCOME_TICKET_SUBJECTS:
            with self.subTest(subject=subject):
                self.assertEqual(created_events(subject), [])
