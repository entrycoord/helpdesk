import { createResource, dayjs } from "frappe-ui";
import { shallowRef } from "vue";
import type { App } from "vue";

// Reactive, so a `__()` evaluated inside a computed or render function is
// re-evaluated once the dictionary arrives instead of staying English.
const messages = shallowRef<Record<string, string>>(
  (("translatedMessages" in window ? window["translatedMessages"] : null) ??
    {}) as Record<string, string>
);

function getTranslatedMessage(message: string): string {
  return messages.value[message] || message;
}

type Replacement = string | number;

function translate(message: string): string;
function translate(message: string, ...args: Replacement[]): string;
function translate(message: string, args: Replacement[]): string;
function translate(
  message: string,
  ...args: (Replacement | Replacement[])[]
): string {
  const translatedMessage = getTranslatedMessage(message);
  const values = args.flat();
  if (values.length === 0) {
    return translatedMessage;
  }
  return translatedMessage.replace(/{(\d+)}/g, function (match, index) {
    const value = values[Number(index)];
    return value === undefined ? match : String(value);
  });
}

export const __ = translate;

/** Relative times ("an hour ago") come from dayjs, so its English strings
 *  are replaced with translatable ones. */
function applyRelativeTimeLocale() {
  dayjs.updateLocale("en", {
    relativeTime: {
      future: translate("in %s"),
      past: translate("%s ago"),
      s: translate("a few seconds"),
      m: translate("a minute"),
      mm: translate("%d minutes"),
      h: translate("an hour"),
      hh: translate("%d hours"),
      d: translate("a day"),
      dd: translate("%d days"),
      M: translate("a month"),
      MM: translate("%d months"),
      y: translate("a year"),
      yy: translate("%d years"),
    },
  });
}

function setMessages(data: Record<string, string>) {
  (window as any).translatedMessages = data;
  messages.value = data;
  applyRelativeTimeLocale();
}

/** Fetches the dictionary. Awaited before the app mounts, so the very first
 *  render is already translated; a slow or failed request never blocks it. */
export async function loadTranslations(timeoutMs = 4000): Promise<void> {
  if (Object.keys(messages.value).length) return;
  try {
    // the endpoint only answers GET, which `call()` does not send
    const resource = createResource({
      url: "helpdesk.api.general.get_translations",
      method: "GET",
    });
    const data = await Promise.race([
      resource.fetch(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]);
    setMessages(data as Record<string, string>);
  } catch (e) {
    console.warn("Translations could not be loaded", e);
  }
}

export function translationPlugin(app: App<Element>) {
  app.config.globalProperties.__ = translate;
  const windowObj = window as any;
  windowObj.__ = translate;
  if (Object.keys(messages.value).length) applyRelativeTimeLocale();
}

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    __: typeof translate;
  }
}
