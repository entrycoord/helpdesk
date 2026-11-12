// Display helpers copied from Frappe ActivityTimeline (see FRAPPE-MIT-LICENSE).
/** Clip for display; `title` holds the full value only when clipped (tooltip on truncation). */
export function truncate(
  value = "",
  limit = 40
): { text: string; title?: string } {
  if (value.length <= limit) return { text: value };
  return { text: value.slice(0, limit) + "…", title: value };
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Split `text` into bold/plain segments, bolding each occurrence of `names`.
 * Matches exact backend-supplied strings, so it's locale-agnostic — no template parsing.
 */
export function splitBold(
  text: string,
  names: Array<string | undefined>
): Array<{ text: string; bold: boolean }> {
  // longest first so "Foo Bar" wins over a stray "Foo"
  const unique = [...new Set(names.filter(Boolean) as string[])].sort(
    (a, b) => b.length - a.length
  );
  if (!unique.length) return [{ text, bold: false }];

  const matcher = new RegExp(`(${unique.map(escapeRegExp).join("|")})`, "g");
  const bolded = new Set(unique);
  return text
    .split(matcher)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, bold: bolded.has(part) }));
}

// Frappe timestamps use a space separator; Date.parse needs 'T' for reliable parsing.
export function timeValue(ts?: string): number {
  if (!ts) return 0;
  const t = Date.parse(ts.includes(" ") ? ts.replace(" ", "T") : ts);
  return Number.isNaN(t) ? 0 : t;
}
