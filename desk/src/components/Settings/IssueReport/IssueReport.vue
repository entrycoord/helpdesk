<template>
  <SettingsLayoutBase
    :description="
      __(
        'Let anyone with Desk access report a problem from the sidebar. Reports arrive as tickets.'
      )
    "
  >
    <template #title>
      <div class="flex items-center gap-2">
        <h1 class="text-md-semibold text-ink-gray-8">
          {{ __("Issue reporting") }}
        </h1>
        <UnsavedBadge :show="isDirty" />
      </div>
    </template>
    <template #header-actions>
      <Transition name="fade">
        <div v-if="isDirty">
          <Button
            :label="__('Save')"
            variant="solid"
            :loading="saveResource.loading"
            @click="save"
          />
        </div>
      </Transition>
    </template>
    <template #content>
      <div
        v-if="!loaded"
        class="flex items-center justify-center absolute inset-x-0 top-5.5 bottom-0"
      >
        <LoadingIndicator class="w-4" />
      </div>
      <div v-else class="flex flex-col gap-6">
        <div class="flex items-center justify-between">
          <div class="flex flex-col gap-1">
            <span class="text-base-medium text-ink-gray-8">{{
              __("Enable issue reporting")
            }}</span>
            <span class="text-p-sm text-ink-gray-6">{{
              __("Show a button in the sidebar that opens the report form.")
            }}</span>
          </div>
          <Switch v-model="form.enabled" />
        </div>

        <FormControl
          v-model="form.buttonLabel"
          type="text"
          :label="__('Button label')"
          :placeholder="__('Report an issue')"
        />

        <div class="flex flex-col gap-3">
          <FormLabel :label="__('Show the button in')" />
          <div class="grid grid-cols-2 gap-4">
            <Checkbox
              v-model="form.inDesk"
              size="sm"
              :label="__('Desk and ERP')"
            />
            <Checkbox v-model="form.inCrm" size="sm" :label="__('CRM')" />
          </div>
        </div>

        <hr />

        <div>
          <div class="text-base-semibold text-ink-gray-9">
            {{ __("Report form and ticket defaults") }}
          </div>
          <p class="mt-1 text-p-sm text-ink-gray-6">
            {{
              __(
                "Every report becomes a ticket. Empty team, type and priority fall back to the helpdesk defaults."
              )
            }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div class="col-span-2">
            <IssueReportLinkField
              v-model="form.template"
              doctype="HD Ticket Template"
              :label="__('Form template')"
              :placeholder="__('Not set')"
              :description="
                __(
                  'Leave empty to ask for subject, description and attachments only; templates are managed in Desk under HD Ticket Template, not in this app.'
                )
              "
            />
          </div>
          <IssueReportLinkField
            v-model="form.team"
            doctype="HD Team"
            :label="__('Team')"
            :placeholder="__('Not set')"
          />
          <IssueReportLinkField
            v-model="form.ticketType"
            doctype="HD Ticket Type"
            :filters="{ disabled: 0 }"
            translate-names
            :label="__('Ticket type')"
            :placeholder="__('Not set')"
          />
          <IssueReportLinkField
            v-model="form.priority"
            doctype="HD Ticket Priority"
            :filters="{ disabled: 0 }"
            translate-names
            :label="__('Priority')"
            :placeholder="__('Not set')"
          />
        </div>
      </div>
    </template>
  </SettingsLayoutBase>
</template>

<script setup lang="ts">
import SettingsLayoutBase from "@/components/layouts/SettingsLayoutBase.vue";
import UnsavedBadge from "@/components/UnsavedBadge.vue";
import { __ } from "@/translation";
import {
  Button,
  Checkbox,
  createResource,
  FormControl,
  FormLabel,
  LoadingIndicator,
  Switch,
  toast,
} from "frappe-ui";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { disableSettingModalOutsideClick } from "../settingsModal";
import IssueReportLinkField from "./IssueReportLinkField.vue";

interface IssueReportForm {
  enabled: boolean;
  buttonLabel: string;
  inDesk: boolean;
  inCrm: boolean;
  template: string;
  team: string;
  ticketType: string;
  priority: string;
}

const emptyForm = (): IssueReportForm => ({
  enabled: false,
  buttonLabel: "",
  inDesk: true,
  inCrm: true,
  template: "",
  team: "",
  ticketType: "",
  priority: "",
});

const form = ref<IssueReportForm>(emptyForm());
const initial = ref<string | null>(null);
const loaded = computed(() => initial.value !== null);

const toForm = (data: Record<string, any>): IssueReportForm => ({
  enabled: Boolean(data.issue_report_enabled),
  buttonLabel: data.issue_report_button_label || "",
  inDesk: Boolean(data.issue_report_in_desk),
  inCrm: Boolean(data.issue_report_in_crm),
  template: data.issue_report_template || "",
  team: data.issue_report_team || "",
  ticketType: data.issue_report_ticket_type || "",
  priority: data.issue_report_priority || "",
});

function applyData(data: Record<string, any>) {
  form.value = toForm(data);
  initial.value = JSON.stringify(form.value);
}

createResource({
  url: "frappe.client.get",
  params: { doctype: "HD Settings", name: "HD Settings" },
  auto: true,
  onSuccess: applyData,
});

const saveResource = createResource({
  url: "frappe.client.set_value",
  makeParams: () => ({
    doctype: "HD Settings",
    name: "HD Settings",
    fieldname: {
      issue_report_enabled: form.value.enabled ? 1 : 0,
      issue_report_button_label: form.value.buttonLabel.trim(),
      issue_report_in_desk: form.value.inDesk ? 1 : 0,
      issue_report_in_crm: form.value.inCrm ? 1 : 0,
      issue_report_template: form.value.template,
      issue_report_team: form.value.team,
      issue_report_ticket_type: form.value.ticketType,
      issue_report_priority: form.value.priority,
    },
  }),
  onSuccess(data: Record<string, any>) {
    applyData(data);
    toast.success(__("Settings updated"));
  },
});

const isDirty = computed(
  () => loaded.value && JSON.stringify(form.value) !== initial.value
);

// Blocks outside clicks and warns on tab change while changes are unsaved.
watch(isDirty, (dirty) => (disableSettingModalOutsideClick.value = dirty));
onBeforeUnmount(() => (disableSettingModalOutsideClick.value = false));

function save() {
  saveResource.submit();
}
</script>
