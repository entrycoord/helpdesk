<template>
  <Button :label="__(label)" @click="handleDiscard" />
</template>

<script setup lang="ts">
import { __ } from "@/translation";
import { globalStore } from "@/stores/globalStore";
const { $dialog } = globalStore();
const emit = defineEmits<{
  (event: "discard"): void;
}>();

const {
  label = "Discard",
  hideDialog = false,
  title = "Discard?",
  message = "Are you sure you want to discard this?",
} = defineProps<{
  label?: string;
  hideDialog?: boolean;
  title?: string;
  message?: string;
}>();

function handleDiscard() {
  if (hideDialog) {
    emit("discard");
    return;
  }
  $dialog({
    title: __(title),
    message: __(message),
    onConfirm: ({ hideDialog }: { hideDialog: Function }) => {
      hideDialog();
    },
    actions: [
      {
        label: __("Delete"),
        theme: "red",
        iconLeft: "lucide-trash-2",
        variant: "solid",
        onClick({ close }: { close: () => void }) {
          emit("discard");
          close();
        },
      },
    ],
  });
}
</script>
