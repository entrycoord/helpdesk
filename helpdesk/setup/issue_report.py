import frappe

# Check fields of HD Settings that default to 1 on the "Issue reporting" tab.
# A Single DocType does not store a default until the field is written, so
# without a row every read (get_doc, get_single_value, the Settings page)
# returns 0 instead of the declared default.
CHECK_DEFAULTS_ON = (
    "issue_report_in_desk",
    "issue_report_in_crm",
    "issue_report_grant_customer_role",
)


def seed_issue_report_defaults():
    for fieldname in CHECK_DEFAULTS_ON:
        # frappe.db.exists() cannot be used here: tabSingles has no name column
        has_row = frappe.db.sql(
            "select 1 from tabSingles where doctype = %s and field = %s",
            ("HD Settings", fieldname),
        )
        if not has_row:
            frappe.db.set_single_value("HD Settings", fieldname, 1)
