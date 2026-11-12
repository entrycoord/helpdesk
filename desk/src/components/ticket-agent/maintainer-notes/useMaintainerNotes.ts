import { globalStore } from "@/stores/globalStore";
import { __ } from "@/translation";
import { createResource, toast } from "frappe-ui";
import { computed, inject, onScopeDispose, ref, type InjectionKey } from "vue";

const API = "helpdesk.api.maintainer_note";
const MAINTAINER_NOTE_EVENT = "helpdesk:maintainer-note-update";

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
 *
 * Call it once per ticket (MaintainerNotesProvider does) and share the result
 * through MaintainerNotesKey: the timeline and the composer are far apart in
 * the tree and must see the same list, one fetch and one socket listener.
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

  // Set once a note of ours is saved and in the list; the timeline consumes it
  // (scrolls to the newest note) as soon as it is on screen, which may be later
  // than the save when another tab was active.
  const scrollPending = ref(false);

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

  async function addNote(content: string, attachments: object[] = []) {
    const ok = await run(() =>
      addResource.submit({ ticket: ticketId, content, attachments })
    );
    if (ok) scrollPending.value = true;
    return ok;
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
    scrollPending,
    reload: () => notes.reload(),
    addNote,
    editNote,
    deleteNote,
  };
}

export type MaintainerNotesApi = ReturnType<typeof useMaintainerNotes>;

/** null for everyone but maintainers: they never fetch or listen. */
export const MaintainerNotesKey: InjectionKey<MaintainerNotesApi | null> =
  Symbol("maintainerNotes");

/** The ticket's shared notes; only call it where a maintainer sees the UI. */
export function injectMaintainerNotes(): MaintainerNotesApi {
  const api = inject(MaintainerNotesKey, null);
  if (!api) throw new Error("MaintainerNotesProvider is missing");
  return api;
}

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
