import { useConfigStore } from "@/stores/config";
import { storeToRefs } from "pinia";

/**
 * The configured help URL (`help_url` from `helpdesk.api.config.get_config`).
 * Empty means there is no documentation: a docs link must not be rendered at
 * all then, and one that is rendered points at `helpUrl`.
 */
export function useHelpUrl() {
  const { helpUrl, hasHelp } = storeToRefs(useConfigStore());
  return { helpUrl, hasHelp };
}
