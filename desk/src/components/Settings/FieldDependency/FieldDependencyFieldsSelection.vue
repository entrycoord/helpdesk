<template>
  <div class="flex gap-3 w-full justify-between flex-1">
    <div class="flex-1 flex flex-col gap-1.5">
      <span class="block text-xs text-ink-gray-5"
        >{{ __("Parent field") }}
        <span class="text-ink-red-6 select-none">*</span>
      </span>
      <Combobox
        v-model="state.selectedParentField"
        :options="displayParentFields"
        :disabled="!isNew"
        :open-on-focus="true"
        class="w-full"
      />
    </div>
    <div class="flex-1 flex flex-col gap-1.5">
      <span class="block text-xs text-ink-gray-5"
        >{{ __("Child field") }}
        <span class="text-ink-red-6 select-none">*</span>
      </span>
      <Combobox
        v-model="state.selectedChildField"
        :options="displayChildFields"
        :disabled="!state.selectedParentField || !isNew"
        :open-on-focus="true"
        class="w-full"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { FieldCriteriaState } from "@/types";
import { Combobox } from "frappe-ui";
import { computed } from "vue";
import { fieldLabel } from "./fieldDependency";

const state = defineModel<FieldCriteriaState>();

const props = defineProps<{
  isNew: boolean;
  parentFields: any[];
}>();
const displayFields = (fields: any[]) =>
  fields.map((field) => ({
    ...field,
    label: fieldLabel(field.value, field.label),
  }));
const displayParentFields = computed(() => displayFields(props.parentFields));
const displayChildFields = computed(() =>
  displayFields(state.value.childFields)
);
</script>

<style scoped></style>
