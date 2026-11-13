import type { HelpArticle } from "@/components/onboarding/types";

/**
 * Articles listed in the Help panel (Help centre).
 *
 * Our own content goes here. The list is empty on purpose: the product has no
 * documentation of its own yet, and the Help button only shows when a help URL
 * is configured (Branding Settings -> `help_url`, delivered by
 * `helpdesk.api.config.get_config`).
 *
 * Each group has a heading and its pages. A page is only a link when it sets
 * its own `url`: either an absolute http(s) URL, or a path that is resolved
 * against the configured help URL. A page without `url` is listed as plain
 * text. Titles go through `__()` so they can be translated:
 *
 *   {
 *     title: __("Getting Started"),
 *     opened: false,
 *     subArticles: [
 *       { name: "first-ticket", title: __("Creating a ticket"), url: "first-ticket" },
 *     ],
 *   }
 *
 * This is a function, not a constant, because `__()` must run after the
 * translations are loaded.
 */
export function getHelpArticles(): HelpArticle[] {
  return [];
}
