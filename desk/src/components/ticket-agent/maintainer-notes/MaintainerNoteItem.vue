<template>
  <CommentItem
    :comment="activity"
    :editable="editing"
    @save="save"
    @discard="editing = false"
  >
    <!-- same header as a comment row, plus the edited marker -->
    <template #header>
      <div class="flex h-10 items-center justify-between gap-2">
        <span class="truncate text-base font-medium leading-6 text-ink-gray-6">
          {{ activity.author?.fullname }}
        </span>
        <div class="flex items-center gap-2">
          <Tooltip v-if="editedAt" :text="editedAt.format(TOOLTIP_DATE_FORMAT)">
            <span class="whitespace-nowrap text-sm leading-6 text-ink-gray-5">
              {{ __("(edited)") }}
            </span>
          </Tooltip>
          <Tooltip :text="postedAt.format(TOOLTIP_DATE_FORMAT)">
            <span class="whitespace-nowrap text-sm leading-6 text-ink-gray-5">
              {{ postedAt.fromNow() }}
            </span>
          </Tooltip>
          <!-- -me-1.5 matches the tighter edge the framework gives a header with actions -->
          <div v-if="options.length && !editing" class="-me-1.5">
            <Dropdown
              align="end"
              :options="options"
              @update:open="(open) => open && (isConfirmingDelete = false)"
            >
              <Button
                icon="lucide-more-horizontal"
                class="text-ink-gray-5"
                variant="ghost"
              />
            </Dropdown>
          </div>
        </div>
      </div>
    </template>
  </CommentItem>
</template>

<script setup lang="ts">
import { useAuthStore } from "@/stores/auth";
import { __ } from "@/translation";
import { ConfirmDelete, isContentEmpty } from "@/utils";
import {
  CommentItem,
  type CommentActivity,
} from "@framework/ui/ActivityTimeline";
import { Button, Dropdown, Tooltip, dayjsLocal, toast } from "frappe-ui";
import { computed, ref } from "vue";
import {
  injectMaintainerNotes,
  type MaintainerNote,
} from "./useMaintainerNotes";

// same as the framework's timeline, so every row's time reads alike
const TOOLTIP_DATE_FORMAT = "ddd, MMM D, YYYY h:mm A";

const props = defineProps<{
  activity: CommentActivity;
  note: MaintainerNote;
}>();

const authStore = useAuthStore();
const notesApi = injectMaintainerNotes();

const editing = ref(false);
const isConfirmingDelete = ref(false);

const postedAt = computed(() => dayjsLocal(props.note.creation));
const editedAt = computed(() =>
  props.note.edited_at ? dayjsLocal(props.note.edited_at) : null
);

// can_edit covers the owner and Administrator; only the owner may rewrite it
const isOwner = computed(() => props.note.owner === authStore.userId);

const options = computed(() => [
  ...(props.note.can_edit && isOwner.value
    ? [
        {
          label: __("Edit"),
          icon: "lucide-edit-2",
          onClick: () => (editing.value = true),
        },
      ]
    : []),
  ...(props.note.can_edit
    ? ConfirmDelete({
        isConfirmingDelete,
        onConfirmDelete: () => notesApi.deleteNote(props.note.name),
      })
    : []),
]);

async function save(content: string) {
  if (isContentEmpty(content)) {
    toast.error(__("Note cannot be empty."));
    return;
  }
  // stays in edit mode on failure, so the text is not lost
  if (await notesApi.editNote(props.note.name, content)) editing.value = false;
}
</script>
