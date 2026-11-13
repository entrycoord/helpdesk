import frappe
from frappe.desk.form.assign_to import add as add_assign

from helpdesk.consts import WELCOME_TICKET_SUBJECT

AUTHOR_EMAIl = "john@example.com"
AUTHOR_NAME = "John Doe"
CONTENT = """
<div style="font-family: 'Segoe UI', sans-serif; font-size: 15px; line-height: 1.8; color: #374151; max-width: 560px; margin: 0 auto;">
Hey {{ first_name }} 👋,
<br><br>
This is a sample ticket we created to show you how the support desk works. You can delete it any time.
<br><br>
<b>Ticket activity.</b> When you reply to a ticket, your response shows up directly below in the activity thread, so you can keep track of everything that happened on a ticket in one place.
<br><br>
<b>Reply.</b> When it's time to follow up with a customer, click <b>Reply</b>. Your message is sent to their inbox and the conversation continues in the same thread.
<br><br>
<b>Comment.</b> To discuss a ticket with your team, use the <b>Comment</b> feature. Comments are visible only to your colleagues, never to the customer.
<br><br>
<b>Ticket sidebar.</b> In the ticket sidebar you can assign the ticket to yourself or a teammate, set the priority and the ticket type, and update the status.
<br><br>
<b>Ticket header.</b> The header shows the first response and resolution timers, and the source of the ticket, for example email or the customer portal.
<br><br>
What you can do next:<br>
<ul style="padding-left: 20px; margin: 0;">
  <li>Connect your support email to start receiving real tickets.</li>
  <li>Invite your team and auto-assign tickets using assignment rules.</li>
  <li>Set up SLAs to manage response times for your agents.</li>
  <li>Add a Knowledge Base for self-serve support.</li>
</ul>
<br>
Feel free to click around and explore.
</div>
"""


def create_welcome_ticket():
    create_contact()
    create_ticket()


def create_ticket():
    if frappe.db.count("HD Ticket"):
        return

    # Render template with the current user's information
    user_doc = frappe.get_doc("User", frappe.session.user)
    if (user_doc.name or "").strip().lower() == "administrator":
        first_name = "there"
    else:
        first_name = (user_doc.first_name or "").strip() or "there"
    rendered_content = frappe.render_template(  # nosemgrep
        CONTENT,
        {
            "first_name": first_name,
        },
        safe_render=True,
    )

    d = frappe.new_doc("HD Ticket")
    d.subject = WELCOME_TICKET_SUBJECT
    d.description = rendered_content
    d.raised_by = AUTHOR_EMAIl
    d.contact = AUTHOR_NAME
    d.via_customer_portal = True
    d.insert()
    add_assign(
        {
            "doctype": "HD Ticket",
            "name": d.name,
            "assign_to": ["Administrator"],
        }
    )


def create_contact():
    frappe.get_doc(
        {
            "doctype": "Contact",
            "first_name": AUTHOR_NAME,
            "email_ids": [{"email_id": AUTHOR_EMAIl, "is_primary": 1}],
        }
    ).insert()
