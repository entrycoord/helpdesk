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
    <!-- the note composer; the ticket's reply/comment area stays below the tabs -->
    <div class="shrink-0 border-t border-outline-gray-1">
      <div v-show="!showEditor" class="px-6 py-4 md:px-5 md:py-2.5">
        <Button variant="ghost" :label="__('Add note')" @click="openEditor()">
          <template #prefix>
            <LucideLock class="h-4" />
          </template>
        </Button>
      </div>
      <!-- v-show keeps the editor alive, so it can take focus at once -->
      <div
        v-show="showEditor"
        @keydown.ctrl.enter.capture.stop="editorRef?.submit()"
        @keydown.meta.enter.capture.stop="editorRef?.submit()"
        @keydown.esc.capture.stop="showEditor = false"
      >
        <MaintainerNoteEditor
          ref="editorRef"
          :ticket-id="ticketId"
          :label="
            isMobileView
              ? __('Add note')
              : isMac
              ? __('Add note (⌘ + ⏎)')
              : __('Add note (Ctrl + ⏎)')
          "
          :placeholder="__('@John could you please look into this?')"
          @submit="onSubmitted"
          @discard="showEditor = false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useDevice } from "@/composables";
import { useScreenSize } from "@/composables/screen";
import { __ } from "@/translation";
import { isContentEmpty } from "@/utils";
import {
  ActivityTimeline,
  TimelineContainer,
  type CommentActivity,
} from "@framework/ui/ActivityTimeline";
import { Button } from "frappe-ui";
import { computed, nextTick, provide, ref, useTemplateRef } from "vue";
import LucideLock from "~icons/lucide/lock";
import MaintainerNoteEditor from "./MaintainerNoteEditor.vue";
import MaintainerNoteItem from "./MaintainerNoteItem.vue";
import {
  MaintainerNotesKey,
  useMaintainerNotes,
  type MaintainerNote,
} from "./useMaintainerNotes";

const props = defineProps<{ ticketId: string }>();

const { isMac } = useDevice();
const { isMobileView } = useScreenSize();

const notesApi = useMaintainerNotes(props.ticketId);
provide(MaintainerNotesKey, notesApi);
const { notes, loading } = notesApi;

const timelineRef =
  useTemplateRef<InstanceType<typeof ActivityTimeline>>("timelineRef");
const editorRef =
  useTemplateRef<InstanceType<typeof MaintainerNoteEditor>>("editorRef");

// a draft left from last time reopens the composer
const showEditor = ref(
  !isContentEmpty(
    localStorage.getItem("maintainerNoteContent" + props.ticketId) ?? ""
  )
);

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

async function openEditor() {
  showEditor.value = true;
  await nextTick();
  editorRef.value?.focus();
}

async function onSubmitted() {
  showEditor.value = false;
  await nextTick();
  timelineRef.value?.scrollToLatest();
}
</script>
