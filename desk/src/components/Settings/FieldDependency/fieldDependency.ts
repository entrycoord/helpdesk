import { call, createListResource } from "frappe-ui";
import { __ } from "@/translation";
import { computed, reactive } from "vue";

export const fieldDependenciesList = createListResource({
  doctype: "HD Form Script",
  filters: { is_standard: 1, name: ["like", "%Field Dependency%"] },
  fields: ["name", "enabled", "owner"],
  cache: ["FD", "List"],
  orderBy: "modified desc",
  start: 0,
  pageLength: 999,
});

export const hiddenChildFields = computed(() => {
  let _fields = [];
  fieldDependenciesList.data?.forEach((item) => {
    let [_, parent, child] = item.name.split("-");
    if (parent && child) {
      _fields.push(child);
      _fields.push(parent);
    }
  });
  return _fields;
});

const optionsMap = reactive({});

export function clearFieldOptionsCache(): void {
  Object.keys(optionsMap).forEach((key) => delete optionsMap[key]);
}

export async function getFieldOptions(field: any): Promise<string[]> {
  if (optionsMap[field.value]) {
    return optionsMap[field.value];
  }

  if (field.type === "Select") {
    optionsMap[field.value] = field.options.split("\n");
    return optionsMap[field.value];
  } else if (field.type === "Link") {
    let options = await call("frappe.client.get_list", {
      doctype: field.options,
      fields: ["name"],
      limit_page_length: 999,
    });
    optionsMap[field.value] = options.map((o) => o.name);
    return optionsMap[field.value];
  }
}

// Only the shipped metadata vocabulary is translated. A custom field or value
// may happen to match a dictionary entry; it must keep its own name.
const builtinFieldLabels: Record<string, string> = {
  status: "Status",
  priority: "Priority",
  ticket_type: "Ticket Type",
  agent_group: "Team",
  ticket_split_from: "Ticket Split From",
  template: "Template",
  sla: "SLA",
  agreement_status: "SLA Status",
  contact: "Contact",
  customer: "Customer",
  email_account: "Email Account",
  feedback: "Feedback (Option)",
  merged_with: "Merged With",
};
const builtinValues: Record<string, string[]> = {
  priority: ["Low", "Medium", "High", "Urgent"],
  ticket_type: ["Question", "Bug", "Incident", "Unspecified"],
  status: ["Open", "Replied", "Resolved", "Closed"],
  agreement_status: [
    "First Response Due",
    "Resolution Due",
    "Failed",
    "Fulfilled",
    "Paused",
  ],
};

export function fieldLabel(field: string, label: string): string {
  return builtinFieldLabels[field] === label ? __(label) : label;
}

export function fieldValueLabel(field: string, value: string): string {
  return builtinValues[field]?.includes(value) ? __(value) : value;
}

export function matchesFieldValue(
  field: string,
  value: string,
  query: string
): boolean {
  const needle = query.toLowerCase();
  return (
    value.toLowerCase().includes(needle) ||
    fieldValueLabel(field, value).toLowerCase().includes(needle)
  );
}
