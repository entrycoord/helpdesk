<template>
  <AppSidebar :profile-settings="profileSettings">
    <template #footer="{ isCollapsed }">
      <!-- The Sidebar container already has p-2; the extra px-2 only fits when
      expanded. Collapsed, it would squeeze the banners' icon buttons to 0. -->
      <div
        class="flex flex-col gap-2"
        :class="isCollapsed ? 'items-center' : 'px-2'"
      >
        <GettingStartedBanner
          v-if="showOnboardingBanner && hasHelp"
          :isSidebarCollapsed="isCollapsed"
          appName="helpdesk"
        />
        <template v-if="!isCustomerPortal">
          <CustomerPortalPermissionBanner
            v-if="isBannerVisible('customer_portal_permission')"
            :isSidebarCollapsed="isCollapsed"
          />
          <TicketFieldPermissionBanner
            v-if="isBannerVisible('ticket_field_permission')"
            :isSidebarCollapsed="isCollapsed"
          />
        </template>
      </div>
      <SidebarItem
        v-if="hasHelp && isOnboardingStepsCompleted && !isCustomerPortal"
        :label="__('Help')"
        :icon="HelpIcon"
        :on-click="
          () => {
            showHelpModal = minimize ? true : !showHelpModal;
            minimize = !showHelpModal;
          }
        "
      />
    </template>
  </AppSidebar>

  <SettingsModal v-model="showSettingsModal" />
  <ShortcutsModal v-model="showShortcutsModal" />
  <HelpModal
    v-if="hasHelp && showHelpModal"
    v-model="showHelpModal"
    v-model:articles="articles"
    appName="helpdesk"
    :title="productName"
    :logo="logo"
    :docsLink="helpUrl"
    :afterSkip="(step: string) => capture('onboarding_step_skipped_' + step)"
    :afterSkipAll="() => capture('onboarding_steps_skipped')"
    :afterReset="(step: string) => capture('onboarding_step_reset_' + step)"
    :afterResetAll="() => capture('onboarding_steps_reset')"
  />
  <IntermediateStepModal
    v-model="showIntermediateModal"
    :currentStep="currentStep"
  />
</template>

<script setup lang="ts">
import HDLogo from "@/assets/logos/HDLogo.vue";
import { InviteCustomer } from "@/components/icons";
import CustomerPortalPermissionBanner from "@/components/banners/CustomerPortalPermissionBanner.vue";
import TicketFieldPermissionBanner from "@/components/banners/TicketFieldPermissionBanner.vue";
import ShortcutsModal from "@/components/modals/ShortcutsModal.vue";
import SettingsModal from "@/components/Settings/SettingsModal.vue";
import { useApps } from "@/composables/useApps";
import { useBanners } from "@/composables/useBanners";
import { showNewContactModal } from "@/pages/contact/dialogState";
import {
  showAssignmentModal,
  showCommentBox,
  showEmailBox,
} from "@/pages/ticket/modalStates";
import { useAuthStore } from "@/stores/auth";
import { useHelpUrl } from "@/composables/useHelpUrl";
import { useConfigStore } from "@/stores/config";
import { getHelpArticles } from "@/data/helpArticles";
import { capture } from "@/telemetry";
import { isCustomerPortal } from "@/utils";
import { call, SidebarItem, toast, useColorScheme } from "frappe-ui";
import { minimize, showHelpModal, useOnboarding } from "@framework/ui";

import GettingStartedBanner from "@/components/onboarding/GettingStartedBanner.vue";
import HelpModal from "@/components/onboarding/HelpModal.vue";
import IntermediateStepModal from "@/components/onboarding/IntermediateStepModal.vue";
import { HelpIcon } from "frappe-ui/icons";
import { computed, h, markRaw, onMounted, ref } from "vue";
import { storeToRefs } from "pinia";
import { useRouter } from "vue-router";
import AppSidebar from "./AppSidebar.vue";
import { showShortcutsModal } from "./layoutSettings";

import { useShortcut } from "@/composables/shortcuts";
import { __ } from "@/translation";
import FileText from "~icons/lucide/file-text";
import Globe from "~icons/lucide/globe";
import LucideKeyboard from "~icons/lucide/keyboard";
import LucideMail from "~icons/lucide/mail";
import MailOpen from "~icons/lucide/mail-open";
import MessageCircle from "~icons/lucide/message-circle";
import Ticket from "~icons/lucide/ticket";
import Timer from "~icons/lucide/timer";
import UserPen from "~icons/lucide/user-pen";
import LucideUserPlus from "~icons/lucide/user-plus";
import { useTelephonyStore } from "@/stores/telephony";
import {
  setActiveSettingsTab,
  showSettingsModal,
} from "../Settings/settingsModal";

const router = useRouter();
const authStore = useAuthStore();
const { helpUrl, hasHelp } = useHelpUrl();
const { productName } = storeToRefs(useConfigStore());
const { isVisible: isBannerVisible } = useBanners();

const { appsMenuOption } = useApps();
const { colorScheme, toggleColorScheme } = useColorScheme();

const themeMenuItem = computed(() => ({
  label: __("Toggle theme"),
  icon: colorScheme.value === "dark" ? LucideSun : LucideMoon,
  onClick: () => toggleColorScheme(),
}));

const customerPortalDropdown = computed(() => [
  {
    group: __("Danger"),
    hideLabel: true,
    options: [
      {
        label: __("Log out"),
        icon: "lucide-log-out",
        onClick: () => authStore.logout(),
      },
    ],
  },
]);

const agentPortalDropdown = computed(() => [
  appsMenuOption.value,
  {
    label: __("Customer portal"),
    icon: "lucide-users",
    onClick: () => {
      const path = router.resolve({ name: "TicketsCustomer" });
      window.open(path.href);
    },
  },
  {
    label: __("Shortcuts"),
    icon: h(LucideKeyboard),
    onClick: () => (showShortcutsModal.value = true),
  },
  {
    label: __("Settings"),
    icon: "lucide-settings",
    onClick: () => (showSettingsModal.value = true),
  },
  {
    group: __("Danger"),
    hideLabel: true,
    options: [
      {
        label: __("Log out"),
        icon: "lucide-log-out",
        onClick: () => authStore.logout(),
      },
    ],
  },
]);

const profileSettings = computed(() => {
  return isCustomerPortal.value
    ? customerPortalDropdown.value
    : agentPortalDropdown.value;
});

const logo = h(
  HDLogo,
  {
    class: "h-12 w-12",
  },
  null
);

const showOnboardingBanner = computed(() => {
  return (
    !isCustomerPortal.value &&
    !isOnboardingStepsCompleted?.value &&
    authStore.isManager
  );
});

const steps = [
  {
    name: "setup_email_account",
    title: __("Connect your support email"),
    completed: false,
    icon: markRaw(LucideMail),
    onClick: () => {
      minimize.value = true;
      showSettingsModal.value = true;
      setActiveSettingsTab("Email Accounts");
    },
  },
  {
    name: "invite_agents",
    title: __("Invite agents"),
    completed: false,
    icon: markRaw(LucideUserPlus),
    onClick: () => {
      minimize.value = true;
      showSettingsModal.value = true;
      setActiveSettingsTab("Invite Agents");
    },
  },
  {
    name: "setup_sla",
    title: __("Setup SLA"),
    completed: false,
    icon: markRaw(Timer),
    onClick: () => {
      setActiveSettingsTab("SLA Policies");
      showSettingsModal.value = true;
      minimize.value = true;
    },
  },
  {
    name: "create_first_ticket",
    title: __("Create a ticket"),
    completed: false,
    icon: markRaw(Ticket),
    onClick: () => {
      router.push({ name: "TicketAgentNew" });
      minimize.value = true;
    },
  },
  {
    name: "assign_to_agent",
    title: __("Assign a ticket to an agent"),
    completed: false,
    dependsOn: "create_first_ticket",
    icon: markRaw(UserPen),
    onClick: async () => {
      await handleFirstTicketNavigation();
      showAssignmentModal.value = true;
      minimize.value = true;
    },
  },
  {
    name: "reply_on_ticket",
    title: __("Reply on a ticket"),
    completed: false,
    dependsOn: "create_first_ticket",
    icon: markRaw(MailOpen),
    onClick: async () => {
      await handleFirstTicketNavigation();
      showEmailBox.value = true;
      showCommentBox.value = false;
      minimize.value = true;
    },
  },
  {
    name: "comment_on_ticket",
    title: __("Add a comment on a ticket"),
    completed: false,
    dependsOn: "create_first_ticket",
    icon: markRaw(MessageCircle),
    onClick: async () => {
      await handleFirstTicketNavigation();
      showCommentBox.value = true;
      showEmailBox.value = false;
      minimize.value = true;
    },
  },
  {
    name: "first_article",
    title: __("Create an article"),
    completed: false,
    icon: markRaw(FileText),
    onClick: async () => {
      const generalCategory = await getGeneralCategory();
      router.push({
        name: "NewArticle",
        query: {
          title: __("General"),
        },
        params: { id: generalCategory },
      });
      minimize.value = true;
    },
  },
  {
    name: "add_invite_contact",
    title: __("Create & invite a contact"),
    completed: false,
    icon: markRaw(InviteCustomer),
    onClick: () => {
      minimize.value = true;
      currentStep.value = {
        title: __("Create & invite a contact"),
        buttonLabel: __("Create"),
        message: __("Create a contact and invite them to the customer portal."),
        onClick: async () => {
          showIntermediateModal.value = false;
          router.push({ name: "ContactList" });
          showNewContactModal.value = true;
        },
      };
      showIntermediateModal.value = true;
    },
  },
  {
    name: "explore_customer_portal",
    title: __("Explore customer portal"),
    completed: false,
    icon: markRaw(Globe),
    onClick: () => {
      window.open("/helpdesk/my-tickets", "_blank");
      updateOnboardingStep?.("explore_customer_portal");
      minimize.value = true;
    },
  },
];

// Our own articles live in data/helpArticles.ts (empty for now).
const articles = ref(getHelpArticles());

const showIntermediateModal = ref(false);
const currentStep = ref({});

const { isOnboardingStepsCompleted, setUp, updateOnboardingStep } =
  useOnboarding("helpdesk") ?? {};

async function handleFirstTicketNavigation() {
  const ticket = await getFirstTicket();

  if (!ticket) {
    router.push({ name: "TicketAgentNew" });
    updateOnboardingStep?.("create_first_ticket", false); // reset the step as first ticket is not created
    toast.error(
      __("Please create a new ticket to proceed with the next step.")
    );
    return;
  }

  router.push({
    name: "TicketAgent",
    params: { ticketId: ticket },
  });
}

async function getFirstTicket() {
  let cachedTicket = localStorage.getItem("firstTicket");
  const ticket = await call("helpdesk.api.onboarding.get_first_ticket", {
    ticket: cachedTicket,
  });
  if (ticket) {
    localStorage.setItem("firstTicket", ticket);
  } else {
    localStorage.removeItem("firstTicket");
  }
  return ticket;
}

async function getGeneralCategory() {
  let generalCategory = localStorage.getItem("generalCategoryId");
  if (!generalCategory) {
    generalCategory = await call(
      "helpdesk.api.onboarding.get_general_category_id"
    );
    if (!generalCategory) return;
    localStorage.setItem("generalCategoryId", generalCategory);
  }
  return generalCategory;
}

function setUpOnboarding() {
  if (!authStore.isManager) return;
  setUp?.(steps);
  useShortcut({ key: "h", meta: true }, () => {
    if (!hasHelp.value) return;
    showHelpModal.value = !showHelpModal.value;
  });
}

onMounted(() => {
  setUpOnboarding();
  if (isCustomerPortal.value) return;
  useShortcut({ key: ",", meta: true }, () => {
    showSettingsModal.value = !showSettingsModal.value;
  });
});
</script>
