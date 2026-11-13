import { createResource } from "frappe-ui";
import { defineStore } from "pinia";
import { computed, ComputedRef } from "vue";
import { __ } from "@/translation";
import { globalStore } from "./globalStore";

export const useConfigStore = defineStore("config", () => {
  const { $socket } = globalStore();
  const configResource = createResource({
    url: "helpdesk.api.config.get_config",
    auto: true,
  });

  const config = computed(() => configResource.data || {});
  const brandName = computed(() => config.value.brand_name);
  // Name shown where the app names itself (header, tab title, welcome text).
  // `brandName` is the raw HD Settings value, this one falls back to the
  // product name.
  const productName = computed(() => brandName.value || __("Ügyfélszolgálat"));
  // Base URL of our own help pages. Empty (or anything that is not an
  // http(s) or site-relative URL) means there is no documentation, and the
  // Help button, the Help panel and every docs link stay hidden.
  const helpUrl = computed(() => {
    const url = String(config.value.help_url || "").trim();
    return /^(https?:\/\/|\/(?!\/))/i.test(url) ? url : "";
  });
  const hasHelp = computed(() => !!helpUrl.value);
  const brandLogo = computed(() => config.value.brand_logo);
  const favicon = computed(() => config.value.favicon);

  const teamRestrictionApplied = computed(
    () => !!parseInt(config.value.restrict_tickets_by_agent_group)
  );
  const disableGlobalScopeForSavedReplies = computed(
    () => !!parseInt(config.value.disable_saved_replies_global_scope)
  );
  const assignWithinTeam = computed(
    () => !!parseInt(config.value.assign_within_team)
  );
  const skipEmailWorkflow: ComputedRef<boolean> = computed(
    () => !!parseInt(config.value.skip_email_workflow)
  );
  const preferKnowledgeBase = computed(
    () => !!parseInt(config.value.prefer_knowledge_base)
  );
  const isFeedbackMandatory = computed(
    () => !!parseInt(config.value.is_feedback_mandatory)
  );
  const enableCommentReactions = computed(
    () => !!parseInt(config.value.enable_comment_reactions)
  );

  $socket.on("helpdesk:settings-updated", () => configResource.reload());

  return {
    configResource,
    brandName,
    productName,
    helpUrl,
    hasHelp,
    brandLogo,
    favicon,
    config,
    preferKnowledgeBase,
    skipEmailWorkflow,
    isFeedbackMandatory,
    teamRestrictionApplied,
    assignWithinTeam,
    disableGlobalScopeForSavedReplies,
    enableCommentReactions,
  };
});
