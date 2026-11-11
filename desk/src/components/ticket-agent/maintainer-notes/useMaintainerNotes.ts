import { globalStore } from "@/stores/globalStore";
import { __ } from "@/translation";
import { createResource, toast } from "frappe-ui";
import { computed, onScopeDispose, type InjectionKey } from "vue";

const API = "helpdesk.api.maintainer_note";
export const MAINTAINER_NOTE_EVENT = "helpdesk:maintainer-note-update";

export interface MaintainerNoteAttachment {
  name: string;
  file_name: string;
  file_url: string;
  is_private: 0 | 1;
}

export interface MaintainerNote {
  name: string;
  ticket: string;
  content: string;
  owner: string;
  creation: string;
  modified: string;
  edited_at: string | null;
  user: { name: string; full_name: string; image: string | null };
  attachments: MaintainerNoteAttachment[];
  can_edit: boolean;
}

interface NoteUpdatePayload {
  ticket: string;
  note: string;
  action: "add" | "edit" | "delete";
}

// frappe-ui puts the server's message (e.g. a frappe.throw) in `messages`
function serverMessage(error: unknown, fallback: string): string {
  const messages = (error as { messages?: string[] } | null)?.messages;
  return messages?.[0] || fallback;
}

/**
 * Maintainer-only notes of one ticket. Nothing here reaches client staff:
 * every call is checked server-side, and the realtime event carries no content,
 * only a hint to refetch.
 */
export function useMaintainerNotes(ticketId: string) {
  const { $socket } = globalStore();

  const notes = createResource({
    url: `${API}.get_notes`,
    params: { ticket: ticketId },
    auto: true,
    initialData: [],
    onError: (error: unknown) =>
      toast.error(serverMessage(error, __("Could not load the notes"))),
  });

  const addResource = createResource({
    url: `${API}.add_note`,
    onError: (error: unknown) =>
      toast.error(serverMessage(error, __("Could not add the note"))),
  });
  const editResource = createResource({
    url: `${API}.edit_note`,
    onError: (error: unknown) =>
      toast.error(serverMessage(error, __("Could not update the note"))),
  });
  const deleteResource = createResource({
    url: `${API}.delete_note`,
    onError: (error: unknown) =>
      toast.error(serverMessage(error, __("Could not delete the note"))),
  });

  const list = computed<MaintainerNote[]>(() => notes.data ?? []);

  // resolves false on failure; the resource's onError already told the user
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
    } catch {
      return false;
    }
    // the change went through; a failed refresh is reported by its own toast
    await notes.reload().catch(() => {});
    return true;
  }

  function addNote(content: string, attachments: object[] = []) {
    return run(() =>
      addResource.submit({ ticket: ticketId, content, attachments })
    );
  }

  function editNote(name: string, content: string) {
    return run(() => editResource.submit({ name, content }));
  }

  function deleteNote(name: string) {
    return run(() => deleteResource.submit({ name }));
  }

  function onNoteUpdate(payload: NoteUpdatePayload) {
    if (payload?.ticket === ticketId) notes.reload();
  }

  $socket.on(MAINTAINER_NOTE_EVENT, onNoteUpdate);
  onScopeDispose(() => $socket.off(MAINTAINER_NOTE_EVENT, onNoteUpdate));

  return {
    notes: list,
    loading: computed<boolean>(() => notes.loading),
    adding: computed<boolean>(() => addResource.loading),
    reload: () => notes.reload(),
    addNote,
    editNote,
    deleteNote,
  };
}

export type MaintainerNotesApi = ReturnType<typeof useMaintainerNotes>;

export const MaintainerNotesKey: InjectionKey<MaintainerNotesApi> =
  Symbol("maintainerNotes");

/** Mention suggestions: maintainers only, so a note never pings client staff. */
export function useMaintainerMentions() {
  const maintainers = createResource({
    url: `${API}.get_maintainers`,
    auto: true,
    initialData: [],
  });
  return computed(() =>
    (
      (maintainers.data ?? []) as Array<{
        name: string;
        full_name: string;
        image: string | null;
      }>
    ).map((m) => ({
      label: m.full_name || m.name,
      value: m.name,
      image: m.image ?? "",
    }))
  );
}
