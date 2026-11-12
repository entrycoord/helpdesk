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

// Load only the requested locale. The boot language is resolved by Frappe for
// this user; browser language and site defaults may be different.
const localeLoaders = import.meta.glob<{ default: any }>(
  "../node_modules/dayjs/esm/locale/*.js"
);
let activeLocale = "en";

async function applyDateLocale() {
  const language =
    typeof (window as any).lang === "string"
      ? (window as any).lang.trim().toLowerCase().replace(/_/g, "-")
      : "";
  const candidates = [language, language.split("-")[0]].filter(Boolean);
  activeLocale = "en";
  for (const candidate of candidates) {
    if (candidate === "en") break;
    const loader =
      localeLoaders[`../node_modules/dayjs/esm/locale/${candidate}.js`];
    if (!loader) continue;
    try {
      const { default: locale } = await loader();
      // Register on frappe-ui's dayjs instance, even if the package is duplicated.
      dayjs.locale({ ...locale }, undefined, true);
      activeLocale = locale.name;
      break;
    } catch (error) {
      console.warn("Date locale could not be loaded", candidate, error);
    }
  }
  dayjs.locale(activeLocale);
}

/** Hungarian catalog phrases use an "ezelőtt"/"múlva" wrapper.
 * Other locales need their native plural and direction rules. */
function applyRelativeTimeLocale() {
  if (activeLocale !== "hu") return;
  const relativeTime = {
    future: __("in %s"),
    past: __("%s ago"),
    s: __("a few seconds"),
    m: __("a minute"),
    mm: __("%d minutes"),
    h: __("an hour"),
    hh: __("%d hours"),
    d: __("a day"),
    dd: __("%d days"),
    M: __("a month"),
    MM: __("%d months"),
    y: __("a year"),
    yy: __("%d years"),
  };
  // Avoid mixed languages or lost substitutions with an incomplete catalog.
  const required = [
    ["in %s", "%s"],
    ["%s ago", "%s"],
    ["a few seconds", ""],
    ["a minute", ""],
    ["%d minutes", "%d"],
    ["an hour", ""],
    ["%d hours", "%d"],
    ["a day", ""],
    ["%d days", "%d"],
    ["a month", ""],
    ["%d months", "%d"],
    ["a year", ""],
    ["%d years", "%d"],
  ];
  if (
    required.every(([key, placeholder]) => {
      const value = messages.value[key];
      return (
        value && value !== key && (!placeholder || value.includes(placeholder))
      );
    })
  ) {
    dayjs.updateLocale("hu", { relativeTime });
  }
}

function setMessages(data: Record<string, string>) {
  (window as any).translatedMessages = data;
  messages.value = data;
  applyRelativeTimeLocale();
}

/** Fetches the dictionary. Awaited before the app mounts, so the very first
 *  render is already translated; a slow or failed request never blocks it. */
export async function loadTranslations(timeoutMs = 4000): Promise<void> {
  await applyDateLocale();
  if (Object.keys(messages.value).length) {
    applyRelativeTimeLocale();
    return;
  }
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
}

declare module "@vue/runtime-core" {
  interface ComponentCustomProperties {
    __: typeof translate;
  }
}
