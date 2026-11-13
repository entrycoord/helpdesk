<template>
  <SidebarBanner
    banner="ticket_field_permission"
    :title="__('Ticket fields update')"
    :description="__('Some fields are now hidden from customers')"
    :dialog-title="__('Ticket fields have changed')"
    :is-sidebar-collapsed="isSidebarCollapsed"
  >
    <p>
      <span class="font-medium text-ink-gray-8">{{ __("What changed:") }}</span>
      {{
        __(
          "Customers now see only the ticket fields meant for them. All other fields are visible to agents only."
        )
      }}
    </p>
    <p>
      {{
        __(
          "Once a ticket is raised, customers can only close it, rate it, or edit fields marked 'Editable after creation' in HD Ticket Template."
        )
      }}
    </p>
    <p>
      <span class="font-medium text-ink-gray-8">{{ __("Check this:") }}</span>
      {{
        __(
          "If you created custom agent roles, raise their permission level to 8 in Role Permission Manager so they can see agent-only fields."
        )
      }}
      <template v-if="helpUrl">
        <a :href="helpUrl" target="_blank" class="underline">{{
          __("See how")
        }}</a
        >.
      </template>
    </p>
  </SidebarBanner>
</template>

<script setup lang="ts">
import { __ } from "@/translation";
import SidebarBanner from "./SidebarBanner.vue";
import { useHelpUrl } from "@/composables/useHelpUrl";

defineProps<{ isSidebarCollapsed: boolean }>();

const { helpUrl } = useHelpUrl();
</script>
