import { createResource } from "frappe-ui";
import { computed, h, markRaw, type Component, type ComputedRef } from "vue";
import AppsIcon from "@/components/icons/AppsIcon.vue";
import { __ } from "@/translation";
import { isCustomerPortal } from "@/utils";
import { buildApps, type App } from "./appsList";

export type { App };

interface AppsMenuOption {
  label: string;
  icon: Component;
  submenu: Array<{ label: string; icon: unknown; onClick: () => void }>;
}

/**
 * Fetches the Frappe apps the user can switch to (ERP, CRM, ..., Rendszer) and
 * exposes them as a native Dropdown submenu option that opens on hover.
 *
 * Titles, logos and the `frappe` ("Rendszer", route `/desk`) entry come from
 * `frappe.apps.get_apps`; `buildApps` only orders them and fills the gaps.
 *
 * Mirrors the apps switcher in frappe/builder (`DashboardSidebar.vue`): plain
 * `label`/`icon`/`onClick` items so reka's submenu hover-intent works cleanly.
 */
export function useApps() {
  const resource = createResource({
    url: "frappe.apps.get_apps",
    cache: "apps",
    // customers lack permission for get_apps (403); sidebar remounts on portal
    // switch, so this re-evaluates for agents
    auto: !isCustomerPortal.value,
    transform: (data: App[]) => buildApps(data, __("System")),
  });

  const apps = computed<App[]>(() => resource.data ?? []);

  const appsMenuOption: ComputedRef<AppsMenuOption> = computed(() => ({
    label: __("Apps"),
    icon: markRaw(AppsIcon),
    submenu: apps.value.map((app) => ({
      label: app.title,
      icon: h("img", { src: app.logo }),
      onClick: () => window.open(app.route, "_self"),
    })),
  }));

  return { apps, appsMenuOption };
}
