import { __ } from "./translation";

/**
 * Translation anchors: names that live in the database (list columns, default
 * views, statuses, priorities, ticket types) and are translated at display
 * time with `__()`. Nothing calls this; the literals only exist so the
 * catalog extraction finds the msgids and a site can translate them.
 * Add the name here when a new default record is shipped.
 */
export function translationAnchors(): string[] {
  return [
    // default list columns (helpdesk/helpdesk/doctype/hd_ticket/hd_ticket.py, setup/default_views.py)
    __("ID"),
    __("Subject"),
    __("Status"),
    __("First response"),
    __("Resolution"),
    __("Resolution By"),
    __("Assigned To"),
    __("Customer"),
    __("Priority"),
    __("Type"),
    __("Team"),
    __("Contact"),
    __("Rating"),
    __("Created"),
    __("Created On"),
    __("Modified By"),
    __("Name"),
    __("Last Modified"),
    __("Feedback (Option)"),
    __("Feedback (Extra)"),
    __("Ticket Type"),
    __("Ticket Split From"),
    __("Template"),
    __("SLA"),
    __("SLA Status"),
    __("Email Account"),
    __("Merged With"),
    __("First Response Due"),
    __("Resolution Due"),
    __("Fulfilled"),
    __("Paused"),
    // default public views
    __("SLA Alerts"),
    __("Recently Assigned Tickets"),
    __("Pending Tickets"),
    __("My Feedback"),
    // ticket statuses
    __("Open"),
    __("In Progress"),
    __("Stuck"),
    __("Awaiting Feedback"),
    __("Awaiting Response"),
    __("Replied"),
    __("Resolved"),
    __("Closed"),
    // ticket priorities
    __("Low"),
    __("Medium"),
    __("High"),
    __("Urgent"),
    // ticket types
    __("Bug"),
    __("Request"),
    __("Question"),
    __("Development"),
    __("Incident"),
    __("Unspecified"),
    // SLA rows
    __("First Response"),
    __("Expected First Response"),
    __("Expected Resolution"),
    // call log statuses
    __("Completed"),
    __("Initiated"),
    __("Declined"),
    __("Failed"),
    __("Queued"),
    __("Canceled"),
    __("Ringing"),
    __("Missed Call"),
    __("In Progress"),
    // Exotel call statuses (translated at display time)
    __("Calling..."),
    __("Ringing..."),
    __("In progress"),
    __("No answer"),
    __("Call ended"),
    __("Incoming call"),
    // compact durations built dynamically in formatDuration()
    __("{0}d"),
    __("{0}h"),
    __("{0}m"),
    // week days
    __("Monday"),
    __("Tuesday"),
    __("Wednesday"),
    __("Thursday"),
    __("Friday"),
    __("Saturday"),
    __("Sunday"),
    // dialogs and empty states
    __("Discard"),
    __("Discard?"),
    __("No tickets found"),
    __(
      "Dashboard charts will appear here once you start receiving or creating tickets."
    ),
    __(
      "Based on the selected filters no tickets found. Try adjusting the date range or filters applied."
    ),
  ];
}
