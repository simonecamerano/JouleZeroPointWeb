<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref, watch } from "vue";
import { RouterView, useRoute } from "vue-router";
import FloatingTerminalTrigger from "./components/layout/FloatingTerminalTrigger.vue";
import TheFooter from "./components/layout/TheFooter.vue";
import TheNavbar from "./components/layout/TheNavbar.vue";
import JouleNotification from "./components/ui/JouleNotification.vue";
import { useAuthStore } from "./stores/auth";

// Layout components (100% Pro Edition)
const JouleTerminal = defineAsyncComponent(
  () => import("./components/JouleTerminal.vue"),
);

const route = useRoute();
const authStore = useAuthStore();

const isTerminalOpen = ref(false);

onMounted(async () => {
  // Defer non-critical auth initialization to prioritize Home LCP
  setTimeout(() => {
    authStore.initialize();
  }, 1500);

  if (route.query.terminal === "1") {
    isTerminalOpen.value = true;
  }
});

// Watch route changes driven by query params (e.g., terminal deep link)
watch(
  () => route.query.terminal,
  (newVal) => {
    if (newVal === "1") {
      isTerminalOpen.value = true;
    }
  },
);

// Protocol: Synchronize Browser Meta Intelligence (Title)
watch(
  () => route.path,
  () => {
    const baseTitle = "Joule: Zero Point";
    const subTitle = (route.name as string) || (route.path.split('/')[1]) || "";
    
    if (subTitle && subTitle !== "home") {
      const formattedSub = subTitle.charAt(0).toUpperCase() + subTitle.slice(1).replace(/-/g, ' ');
      document.title = `${formattedSub} | ${baseTitle}`;
    } else {
      document.title = `${baseTitle} - Il Gioco di Carte Sci-Fi`;
    }
  },
  { immediate: true }
);
</script>

<template>
  <div class="app-layout">
    <!-- Global visual feedback (100% Pro) -->
    <JouleNotification />

    <!-- Layout orchestration -->
    <TheNavbar />

    <main
      class="content-wrapper"
      :class="{ 'content-wrapper--flush-top': route.path === '/' }"
    >
      <RouterView />
    </main>

    <TheFooter />

    <!-- Galactic accessories -->
    <FloatingTerminalTrigger
      :is-open="isTerminalOpen"
      @toggle="isTerminalOpen = !isTerminalOpen"
    />

    <Teleport to="body">
      <JouleTerminal
        :is-open="isTerminalOpen"
        @close="isTerminalOpen = false"
      />
    </Teleport>

    <!-- Joule atmosphere -->
    <div class="ambient-glow"></div>
  </div>
</template>

<style>
/* 
  JOULE: ZERO POINT GLOBAL STYLES
  These styles define the core atmosphere of the application.
*/
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
}

.content-wrapper {
  flex: 1;
  padding-top: 5rem; /* Navbar height compensation (dynamic fix) */
  transition: filter 0.3s ease;
  position: relative;
  z-index: 1;
}

.content-wrapper--flush-top {
  padding-top: 0;
}

/* Background atmosphere (Joule ZP Matrix) */
.ambient-glow {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(
      circle at 15% 15%,
      rgba(var(--accent-gold-rgb), 0.05) 0%,
      transparent 40%
    ),
    radial-gradient(
      circle at 85% 85%,
      rgba(var(--accent-gold-rgb), 0.05) 0%,
      transparent 40%
    );
}

/* Global blur for mobile menu (handled by Navbar component) */
.content-wrapper.blurred {
  filter: blur(4px);
  pointer-events: none;
}
</style>
