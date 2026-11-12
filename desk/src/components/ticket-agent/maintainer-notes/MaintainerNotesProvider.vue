<template>
  <slot />
</template>

<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { provide } from "vue";
import { MaintainerNotesKey, useMaintainerNotes } from "./useMaintainerNotes";

// Renderless: wrap everything of one ticket that shows notes (the timeline tab
// and the composer) and key it by ticket, so each ticket gets one instance.
// Anyone but a maintainer gets none: no request, no socket listener.
const props = defineProps<{ ticketId: string }>();

const authStore = useAuthStore();
provide(
  MaintainerNotesKey,
  authStore.isMaintainer ? useMaintainerNotes(props.ticketId) : null
);
</script>
