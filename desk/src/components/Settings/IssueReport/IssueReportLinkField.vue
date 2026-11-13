<template>
  <Combobox
    class="group"
    trigger="button"
    :model-value="modelValue || null"
    :options="options"
    :loading="records.loading"
    :label="label"
    :placeholder="placeholder"
    :description="description"
    @update:model-value="
      (value) => emit('update:modelValue', value ? String(value) : '')
    "
  >
    <!-- Left unfilled without a value so the chevron falls through. It renders
         inside the trigger button, so it is a span rather than a nested button. -->
    <template v-if="modelValue" #suffix>
      <span
        role="button"
        tabindex="0"
        data-slot="clear"
        :aria-label="__('Clear')"
        class="hidden size-4 shrink-0 place-items-center rounded-1 text-ink-gray-5 group-hover:grid group-focus-within:grid hover:bg-surface-gray-3 hover:text-ink-gray-7 focus-visible:ring-2 focus-visible:ring-outline-gray-3"
        @click.stop="clear"
        @keydown.enter.stop.prevent="clear"
        @keydown.space.stop.prevent="clear"
        @pointerdown.stop
      >
        <span class="lucide-x size-3.5" />
      </span>
    </template>
  </Combobox>
</template>

<script setup lang="ts">
import { PRIORITY_DISPLAY_ORDER } from "@/stores/ticketPriority";
import { __ } from "@/translation";
import { Combobox, createResource } from "frappe-ui";
import { computed } from "vue";

type Option = { label: string; value: string };

const props = withDefaults(
  defineProps<{
    modelValue: string;
    doctype: string;
    label: string;
    placeholder?: string;
    description?: string;
    /** Record names are site vocabulary that ships with a translation. */
    translateNames?: boolean;
    filters?: Record<string, unknown>;
  }>(),
  { placeholder: "", description: "" }
);

const emit = defineEmits<{ "update:modelValue": [value: string] }>();

const records = createResource({
  url: "frappe.client.get_list",
  params: {
    doctype: props.doctype,
    fields: ["name"],
    filters: props.filters,
    limit_page_length: 200,
    order_by: "name asc",
  },
  auto: true,
  transform: (rows: { name: string }[]): Option[] =>
    rows
      .map((row) => ({
        label: props.translateNames ? __(row.name) : row.name,
        value: row.name,
      }))
      // Low to Urgent for priorities; other doctypes have no ranked names
      .sort(
        (a, b) =>
          (PRIORITY_DISPLAY_ORDER[a.value] ?? 99) -
          (PRIORITY_DISPLAY_ORDER[b.value] ?? 99)
      ),
});

// The trigger prints the label of a listed option, so a value saved outside the
// list (e.g. a record disabled since) needs a row of its own.
const options = computed<Option[]>(() => {
  const rows: Option[] = records.data || [];
  if (props.modelValue && !rows.some((row) => row.value === props.modelValue)) {
    return [{ label: props.modelValue, value: props.modelValue }, ...rows];
  }
  return rows;
});

function clear() {
  emit("update:modelValue", "");
}
</script>
