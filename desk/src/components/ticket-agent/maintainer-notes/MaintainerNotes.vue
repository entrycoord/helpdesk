<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <!-- fixed, so the privacy of this tab is never scrolled out of sight -->
    <div
      class="flex shrink-0 items-center gap-2 border-b border-outline-gray-1 bg-surface-gray-1 px-5 py-2 text-sm text-ink-gray-6"
    >
      <LucideLock class="size-3.5 shrink-0" />
      <span>{{ __("Only maintainers can see these notes") }}</span>
    </div>
    <TimelineContainer>
      <ActivityTimeline
        ref="timelineRef"
        class="px-5 pb-6 pt-5"
        :activities="activities"
        :loading="loading"
      >
        <template #empty>
          <div
            class="flex h-full flex-col items-center justify-center gap-2 text-ink-gray-4"
          >
            <LucideLock class="size-6" />
            <p class="text-p-base text-ink-gray-5">
              {{ __("No maintainer notes yet") }}
            </p>
          </div>
        </template>
        <template #item-comment="{ activity }">
          <MaintainerNoteItem
            v-if="noteByName.get(activity.data.name)"
            :activity="activity"
            :note="noteByName.get(activity.data.name)!"
          />
        </template>
      </ActivityTimeline>
    </TimelineContainer>
  </div>
</template>

<script setup lang="ts">
import { __ } from "@/translation";
import {
  ActivityTimeline,
  TimelineContainer,
  type CommentActivity,
} from "@framework/ui/ActivityTimeline";
import { computed, nextTick, onMounted, ref, watch } from "vue";
import LucideLock from "~icons/lucide/lock";
import MaintainerNoteItem from "./MaintainerNoteItem.vue";
import {
  injectMaintainerNotes,
  type MaintainerNote,
} from "./useMaintainerNotes";

// the ticket's shared instance, also used by the composer in CommunicationArea
const { notes, loading, scrollPending } = injectMaintainerNotes();

const timelineRef = ref<InstanceType<typeof ActivityTimeline> | null>(null);

// after saving a note the newest row belongs on screen (old feed parity); when
// the save happened while another tab was active, this runs on first display
async function scrollToNewNote() {
  if (!scrollPending.value) return;
  await nextTick();
  if (!timelineRef.value) return;
  timelineRef.value.scrollToLatest();
  scrollPending.value = false;
}
watch(scrollPending, scrollToNewNote);
onMounted(scrollToNewNote);

const noteByName = computed(
  () => new Map<string, MaintainerNote>(notes.value.map((n) => [n.name, n]))
);

// framework comment rows: same card, gutter avatar and spacing as Comments
const activities = computed<CommentActivity[]>(() =>
  notes.value.map(
    (note): CommentActivity => ({
      type: "comment",
      key: `maintainer-note:${note.name}`,
      timestamp: note.creation,
      author: {
        email: note.user?.name ?? note.owner,
        fullname: note.user?.full_name || note.owner,
        image: note.user?.image ?? "",
      },
      data: {
        name: note.name,
        content: note.content,
        // an inline image is attached so readers can load it, but it is not a chip
        attachments: (note.attachments ?? []).filter(
          (file) => !note.content?.includes(file.file_url)
        ),
      },
    })
  )
);
</script>
