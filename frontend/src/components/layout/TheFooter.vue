<script setup lang="ts">
import { computed } from "vue";
import { useRoute } from "vue-router";

// Route Orchestration: Global Layout Controller
const route = useRoute();

/**
 * Visibility Logic
 * Determines if the footer should be rendered based on route metadata (hideUI flag).
 * Commonly disabled in immersive views like the Terminal or specialized dashboards.
 */
const hideUI = computed(() => route.meta.hideUI === true);

</script>

<template>
  <footer v-if="!hideUI" class="app-footer">
    <div class="footer-social-section">
      <div class="footer-section-title">SOCIAL NETWORK</div>
      <div class="footer-socials">
        <a href="https://discord.gg/kjFWC5Uj" target="_blank" rel="noopener noreferrer" aria-label="Discord" class="footer-social-link">
          <svg viewBox="0 0 24 24" class="footer-social-icon" aria-hidden="true">
            <path fill="currentColor" d="M19.6 5.7a15 15 0 0 0-3.8-1.2l-.2.4c1.5.4 2.2 1 2.2 1a11 11 0 0 0-5.8-1.5A11 11 0 0 0 6.2 6s.7-.6 2.2-1l-.2-.4a15 15 0 0 0-3.8 1.2C2 9.2 1.4 12.5 1.6 15.8a15.6 15.6 0 0 0 4.6 2.3l1-1.6c-.6-.2-1.1-.5-1.6-.8l.4-.3c2 1 4.2 1.5 6.4 1.5s4.4-.5 6.4-1.5l.4.3c-.5.3-1 .6-1.6.8l1 1.6a15.6 15.6 0 0 0 4.6-2.3c.3-3.8-.6-7.1-3.6-10.1M8.9 14.1c-.8 0-1.4-.7-1.4-1.5c0-.9.6-1.5 1.4-1.5c.8 0 1.4.7 1.4 1.5c0 .9-.6 1.5-1.4 1.5m6.2 0c-.8 0-1.4-.7-1.4-1.5c0-.9.6-1.5 1.4-1.5c.8 0 1.4.7 1.4 1.5c0 .9-.6 1.5-1.4 1.5" />
          </svg>
        </a>
      </div>
    </div>
    <div class="footer-divider"></div>
    <div class="footer-links">
      <RouterLink to="/terms">Termini di utilizzo</RouterLink>
      <RouterLink to="/code-of-conduct">Codice di condotta</RouterLink>
      <RouterLink to="/privacy">Informativa sulla privacy</RouterLink>
      <RouterLink to="/contact">Contatti</RouterLink>
    </div>
    <div class="footer-divider footer-divider--secondary"></div>
    <div class="footer-copyright">
      © 2026 Simone Camerano. All Right Reserved. <br>
      <span class="legal-badge">Opera depositata Patamu n. 289903</span>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  width: 100%;
  text-align: center;
  padding: 1.8rem 2rem 1.2rem;
  color: var(--text-muted);
  font-size: 0.8rem;
  letter-spacing: 0.6px;
  border-top: 1px solid var(--glass-border);
  background: var(--surface-glass);
}

.footer-social-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.28rem;
  padding-top: 0.2rem;
  padding-bottom: 0.5rem;
}

.footer-section-title {
  font-family: var(--font-display);
  font-size: 0.92rem;
  letter-spacing: 0.28rem;
  color: var(--text-main);
}

.footer-divider {
  width: min(320px, 100%);
  height: 1px;
  margin: 0.45rem auto 0;
  background: linear-gradient(90deg, rgba(255, 255, 255, 0), rgba(254, 220, 104, 0.5), rgba(255, 255, 255, 0));
}

.footer-copyright { 
  margin-top: 1rem; 
  line-height: 1.6;
  font-size: 0.75rem;
}
.legal-badge {
  display: inline-block;
  margin-top: 0.4rem;
  opacity: 0.85;
}
.footer-divider--secondary { margin-top: 1.2rem; }

.footer-links {
  display: flex;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem 1.4rem;
  margin-top: 0.9rem;
}

.footer-links a {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.8rem;
  transition: color 0.2s ease;
}

.footer-links a:hover { color: var(--accent-gold); }

.footer-socials {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.footer-social-link {
  color: var(--accent-gold);
  text-decoration: none;
  width: 42px;
  height: 42px;
  border: 1px solid rgba(254, 220, 104, 0.5);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  background: rgba(255, 255, 255, 0.03);
}

.footer-social-link:hover {
  background: rgba(254, 220, 104, 0.12);
  box-shadow: 0 0 12px rgba(254, 220, 104, 0.3);
}

.footer-social-icon { width: 20px; height: 20px; }
</style>
