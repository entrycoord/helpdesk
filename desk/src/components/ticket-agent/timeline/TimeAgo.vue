<template>
  <Tooltip :text="dateFormat(timestamp)">
    <span class="whitespace-nowrap leading-6 text-ink-gray-5" v-bind="$attrs">{{
      timeAgo(timestamp)
    }}</span>
  </Tooltip>
</template>
<script setup lang="ts">
import { Tooltip } from "frappe-ui";
import { dateFormat, timeAgo } from "@/utils";
defineProps<{ timestamp?: string }>();
defineOptions({ inheritAttrs: false });
</script>
