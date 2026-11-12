// Translate controlled ticket vocabulary only; teams, SLAs and user text are data.
export function displayHistoryValue(
  fieldname: string | null | undefined,
  value: string | undefined,
  translate: (value: string) => string
): string | undefined {
  if (
    !value ||
    !["status", "priority", "ticket_type"].includes(fieldname ?? "")
  )
    return value;
  return translate(value);
}

// Old and new tag events store English text. Match the whole generated shape,
// leaving arbitrary info comments and the underlying record untouched.
export function translateTagActivity(
  text: string,
  author: string | undefined,
  labels: {
    both: (author: string, added: string, removed: string) => string;
    added: (author: string, names: string) => string;
    removed: (author: string, names: string) => string;
  }
): string {
  if (!author || !text.startsWith(author + " ")) return text;
  const body = text.slice(author.length + 1);
  const match =
    /^(?:added tags? ([^&]+))?(?: & )?(?:removed tags? ([^&]+))?$/.exec(body);
  if (!match || (!match[1] && !match[2])) return text;
  const added = match[1]?.trim();
  const removed = match[2]?.trim();
  if (added && removed) return labels.both(author, added, removed);
  if (added) return labels.added(author, added);
  return labels.removed(author, removed!);
}
