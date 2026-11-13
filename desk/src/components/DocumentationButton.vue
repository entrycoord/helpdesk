<template>
  <Tooltip v-if="helpUrl" :text="__('View documentation')">
    <a :href="helpUrl" target="_blank" rel="noopener noreferrer">
      <lucide-circle-question-mark
        class="h-4 w-4 text-ink-gray-6"
        :class="color"
      />
    </a>
  </Tooltip>
</template>

<script setup lang="ts">
import { useHelpUrl } from "@/composables/useHelpUrl";

// Points at the configured help URL and is not rendered without one.
defineProps<{
  color?: string;
}>();

const { helpUrl } = useHelpUrl();
</script>

<style scoped></style>
