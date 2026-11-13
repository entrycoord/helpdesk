<!-- Adapted from Frappe framework UI Onboarding; see FRAPPE-MIT-LICENSE. -->
<template>
  <div class="flex flex-col gap-2 overflow-hidden">
    <div class="m-1">
      <TextInput
        ref="searchInput"
        :placeholder="__('Search articles...')"
        v-model="search"
        :debounce="300"
      >
        <template #prefix>
          <LucideSearch class="size-4 text-ink-gray-5" />
        </template>
      </TextInput>
    </div>
    <div
      class="flex justify-between items-center text-base text-ink-gray-5 mx-2"
    >
      <div>{{ __("All articles") }}</div>
      <Button
        v-if="docsLink"
        variant="ghost"
        :aria-label="__('Open docs')"
        @click="openDocs"
      >
        <LucideArrowUpRight class="size-4 text-ink-gray-5" />
      </Button>
    </div>
    <div class="flex flex-col gap-1.5 overflow-y-auto">
      <div
        v-for="a in parsedArticles"
        :key="a.title"
        class="flex flex-col gap-1.5"
      >
        <div
          class="flex items-center justify-between p-1.5 hover:bg-surface-gray-1 rounded-4 cursor-pointer"
          @click="a.opened = !a.opened"
        >
          <div class="flex items-center gap-2">
            <component
              :is="a.opened ? LucideChevronDown : LucideChevronRight"
              class="size-4 text-ink-gray-5"
            />
            <div class="text-base text-ink-gray-8">{{ a.title }}</div>
          </div>
        </div>
        <div v-show="a.opened" class="flex flex-col gap-1.5 ml-5">
          <div
            v-for="subArticle in a.subArticles"
            :key="subArticle.name"
            class="group flex items-center justify-between gap-2 p-1.5 rounded-4"
            :class="
              subArticle.url ? 'hover:bg-surface-gray-1 cursor-pointer' : ''
            "
            @click="() => openDoc(subArticle)"
          >
            <div class="flex items-center gap-2">
              <LucideFileText class="size-4 text-ink-gray-5" />
              <div class="text-base text-ink-gray-8">
                {{ subArticle.title }}
              </div>
            </div>
            <LucideArrowUpRight
              v-if="subArticle.url"
              class="size-4 hidden group-hover:flex text-ink-gray-5"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { __ } from "@/translation";
import { Button, TextInput } from "frappe-ui";
import LucideArrowUpRight from "~icons/lucide/arrow-up-right";
import LucideChevronDown from "~icons/lucide/chevron-down";
import LucideChevronRight from "~icons/lucide/chevron-right";
import LucideFileText from "~icons/lucide/file-text";
import LucideSearch from "~icons/lucide/search";
import { ref, computed, onMounted } from "vue";
import type { HelpArticle, HelpCenterProps, HelpSubArticle } from "./types";

// `docsLink` is the help URL from the config; no default, so nothing can
// point at an upstream site when it is not set.
const props = defineProps<HelpCenterProps>();

// `el` is frappe-ui's current TextInput template-ref member. It is being
// renamed to `inputElement` in frappe-ui 1.0.0 (spec/imperative-api.md), so
// this line follows that rename when the peer range moves to 1.0.0.
const searchInput = ref<{ el?: HTMLInputElement } | null>(null);
const search = ref("");
const articles = defineModel<HelpArticle[]>();

const parsedArticles = computed(() => {
  if (!search.value) return articles.value;

  return articles.value?.filter((a) => {
    const filteredSubArticles = a.subArticles.filter((subArticle) => {
      return subArticle.title
        .toLowerCase()
        .includes(search.value.toLowerCase());
    });

    return (
      a.title.toLowerCase().includes(search.value.toLowerCase()) ||
      filteredSubArticles.length > 0
    );
  });
});

function openDocs() {
  if (!props.docsLink) return;
  window.open(props.docsLink, "_blank", "noopener");
}

// An article is a link only when it defines its own `url`: an absolute URL
// as it is, anything else relative to the help URL.
function openDoc(article: HelpSubArticle) {
  if (!article.url) return;
  const url = /^https?:\/\//i.test(article.url)
    ? article.url
    : `${(props.docsLink || "").replace(/\/+$/, "")}/${article.url.replace(
        /^\/+/,
        ""
      )}`;
  window.open(url, "_blank", "noopener");
}

onMounted(() => {
  searchInput.value?.el?.focus();
});
</script>
