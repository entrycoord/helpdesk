<template>
  <Editor
    ref="editorRef"
    v-model="content"
    :extensions="extensions"
    :placeholder="placeholder"
    :upload-function="
      (file: any, options: any) =>
        track(uploadFunction(file, null, null, true, options))
    "
  >
    <!-- same frame as CommentTextEditor, so both composers read alike -->
    <div class="max-h-[44vh] overflow-y-auto">
      <EditorContent
        :class="[
          'prose-sm max-w-none min-h-[7rem] mx-5 border-t py-3',
          getFontFamily(content ?? ''),
        ]"
      />
    </div>
    <AttachmentList
      class="my-2 ms-5"
      :attachments="attachments"
      @remove="removeAttachment"
    />
    <div class="flex flex-col gap-2 border-t">
      <div class="px-4">
        <div class="flex justify-between gap-2 overflow-hidden py-2.5">
          <div class="flex min-w-0 flex-1 items-center overflow-x-auto">
            <div class="inline-flex items-center gap-1.5 p-1">
              <FileUploader private @success="onUploaded">
                <template #default="{ openFileSelector, uploading }">
                  {{ void (fileUploading = uploading) }}
                  <button
                    class="flex rounded-4 p-1 text-ink-gray-8 transition-colors focus-within:ring-0 hover:bg-surface-gray-3"
                    @click="openFileSelector()"
                    :disabled="uploading"
                  >
                    <LoadingIndicator v-if="uploading" class="h-4 w-4" />
                    <AttachmentIcon
                      v-else
                      class="h-4 w-4"
                      style="stroke-width: 1.5 !important"
                    />
                  </button>
                </template>
              </FileUploader>
              <div class="h-4 w-[2px] border-s ms-1" />
            </div>
            <EditorFixedMenu :items="fullToolbar" />
            <EditorTableMenu />
          </div>
          <div class="flex shrink-0 items-center justify-end gap-x-2">
            <Button :label="__('Discard')" @click="discard()" />
            <Tooltip
              :text="isUploading ? __('Please wait, media is uploading') : ''"
            >
              <span class="inline-flex">
                <Button
                  variant="solid"
                  :label="label"
                  :disabled="isDisabled"
                  :loading="sending || fileUploading"
                  @click="submit()"
                />
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
    </div>
  </Editor>
</template>

<script setup lang="ts">
import { AttachmentList } from "@/components/";
import { buildEditorExtensions, fullToolbar } from "@/components/editor/config";
import { AttachmentIcon } from "@/components/icons/";
import { useUploadTracker } from "@/composables/useUploadTracker";
import { __ } from "@/translation";
import {
  getFontFamily,
  isContentEmpty,
  removeAttachmentFromServer,
  uploadFunction,
} from "@/utils";
import { useStorage } from "@vueuse/core";
import { Button, FileUploader, LoadingIndicator, Tooltip } from "frappe-ui";
import {
  Editor,
  EditorContent,
  EditorFixedMenu,
  EditorTableMenu,
} from "frappe-ui/editor";
import { computed, inject, onBeforeUnmount, ref } from "vue";
import {
  MaintainerNotesKey,
  useMaintainerMentions,
} from "./useMaintainerNotes";

interface NoteUpload {
  name: string;
  file_url: string;
  file_name: string;
}

const props = defineProps<{
  ticketId: string;
  label: string;
  placeholder: string;
}>();
const emit = defineEmits<{ submit: []; discard: [] }>();

const notesApi = inject(MaintainerNotesKey)!;

// its own draft key: a note draft must never surface in the comment box
const draftKey = "maintainerNoteContent" + props.ticketId;
const content = useStorage<string | null>(draftKey, null);

const maintainers = useMaintainerMentions();
const extensions = buildEditorExtensions({ mentions: () => maintainers.value });

const editorRef = ref<InstanceType<typeof Editor> | null>(null);
// the paperclip's uploads: private and unattached, so nothing about them
// reaches the ticket (or its realtime room); add_note attaches them to the note
const attachments = ref<NoteUpload[]>([]);
const fileUploading = ref(false);
const sending = ref(false);
const { isUploading, track, dropUnused } = useUploadTracker();

const isDisabled = computed(
  () =>
    isContentEmpty(content.value ?? "") ||
    sending.value ||
    fileUploading.value ||
    isUploading.value
);

function onUploaded(file: Partial<NoteUpload>) {
  if (file.name && file.file_url)
    attachments.value.push({
      name: file.name,
      file_url: file.file_url,
      file_name: file.file_name ?? file.file_url,
    });
}

function removeAttachment(attachment: { file_url: string }) {
  const file = attachments.value.find(
    (a) => a.file_url === attachment.file_url
  );
  if (!file) return;
  attachments.value = attachments.value.filter((a) => a !== file);
  removeAttachmentFromServer(file.name);
}

function discard() {
  content.value = null;
  attachments.value = [];
  dropUnused(null);
  emit("discard");
}

async function submit() {
  // the keyboard shortcut reaches here without passing the disabled button
  if (isDisabled.value) return;
  const text = content.value ?? "";
  sending.value = true;
  // the draft stays in the box until the server accepts it, so a refused
  // mention loses nothing
  const ok = await notesApi.addNote(text, attachments.value);
  sending.value = false;
  if (!ok) return;
  dropUnused(text);
  content.value = null;
  attachments.value = [];
  emit("submit");
}

function focus() {
  editorRef.value?.editor?.commands.focus("end");
}

onBeforeUnmount(() => {
  dropUnused(content.value);
  if (isContentEmpty(content.value ?? "")) localStorage.removeItem(draftKey);
});

defineExpose({
  submit,
  focus,
  hasDraft: () => !isContentEmpty(content.value ?? ""),
});
</script>
