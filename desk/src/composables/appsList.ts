// Pure helpers for the apps switcher (no framework imports, unit-testable).
//
// Contract with platform_customize: `frappe.apps.get_apps` returns the canonical
// titles/logos and appends ONE `frappe` ("Rendszer") entry whose route is `/desk`.
// Without it (plain Helpdesk) the same entry is built from the fallback below.

export interface App {
  name: string;
  logo: string;
  title: string;
  route: string;
}

export const SYSTEM_APP_NAME = "frappe";
export const CURRENT_APP_NAME = "helpdesk";

const APP_LOGO_BASE = "/assets/platform_customize/images/apps";

// Canonical order: ERP, Ügyfélszolgálat, CRM, ..., Rendszer (always last).
const APP_ORDER = ["erpnext", "helpdesk", "crm"];

// Used only when the API still returns an upstream title (platform_customize absent).
const UPSTREAM_TITLES: Record<string, Record<string, string>> = {
  erpnext: { ERPNext: "ERP" },
  crm: { "Frappe CRM": "CRM" },
};

export function appLogo(name: string): string {
  return `${APP_LOGO_BASE}/${name}.svg`;
}

/** The "Rendszer" entry built locally; `systemTitle` is the translated "System". */
export function fallbackSystemApp(systemTitle: string): App {
  return {
    name: SYSTEM_APP_NAME,
    logo: appLogo(SYSTEM_APP_NAME),
    title: systemTitle,
    route: "/desk",
  };
}

function rank(name: string): number {
  const i = APP_ORDER.indexOf(name);
  return i === -1 ? APP_ORDER.length : i;
}

/**
 * Turns the `frappe.apps.get_apps` response into the list shown in the Apps
 * submenu: current app (Helpdesk) left out, canonical order, the `frappe`
 * ("Rendszer") entry last and pointing at `/desk` (the Desk apps screen).
 */
export function buildApps(
  data: App[] | null | undefined,
  systemTitle: string
): App[] {
  const fallback = fallbackSystemApp(systemTitle);
  let system: App = fallback;
  const others: App[] = [];

  (data ?? []).forEach((app) => {
    if (!app?.name || app.name === CURRENT_APP_NAME) return;
    if (app.name === SYSTEM_APP_NAME) {
      system = {
        name: SYSTEM_APP_NAME,
        logo: app.logo || fallback.logo,
        title: app.title || fallback.title,
        // never the old `/desk/helpdesk`: the entry means the Desk itself
        route: app.route || fallback.route,
      };
      return;
    }
    others.push({
      name: app.name,
      logo: app.logo || appLogo(app.name),
      title: UPSTREAM_TITLES[app.name]?.[app.title] ?? app.title,
      route: app.route,
    });
  });

  // stable sort by canonical rank
  const sorted = others
    .map((app, index) => ({ app, index }))
    .sort((a, b) => rank(a.app.name) - rank(b.app.name) || a.index - b.index)
    .map(({ app }) => app);

  return [...sorted, system];
}
