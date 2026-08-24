<script setup lang="ts">
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import { useNotificationStore } from "../stores/notificationStore";
import api from "../utils/api";

// Global Orchestration: Routing & Stores
const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();
const notifications = useNotificationStore();

// UI State & Form Attributes
const isLogin = ref(route.query.mode !== "register");
const username = ref("");
const email = ref("");
const password = ref("");
const confirmPassword = ref("");
const acceptedTerms = ref(false);
const loading = ref(false);
const shakeError = ref(false);

/**
 * Toggle between Authentication and Identification (Login/Register)
 */
const toggleMode = () => {
  isLogin.value = !isLogin.value;
};

const triggerShake = () => {
  shakeError.value = true;
  setTimeout(() => (shakeError.value = false), 600);
};

/**
 * Submission Protocol: Authenticate with the Joule Matrix
 * Handles both session creation (Login) and identity registration.
 */
const submitForm = async () => {
  loading.value = true;

  try {
    if (isLogin.value) {
      // Identity Verification Sequence
      const res = await api.post("/auth/login", {
        email: email.value,
        password: password.value,
      });

      // Persist session tokens to the central Auth Store
      authStore.setAuth(
        res.data.token,
        res.data.username,
        res.data.isAdmin || false,
        res.data.email
      );
      notifications.success("Sincronizzazione completata con successo!");

      // Redirect handling with intentional delay for UI smoothing
      const redirectTo = (route.query.redirect as string) || "/";
      setTimeout(() => router.push(redirectTo), 800);
    } else {
      // Password Integrity Check (8+ characters)
      if (password.value.length < 8) {
        triggerShake();
        notifications.error(
          "Frequenza troppo corta: La Passphrase deve essere di almeno 8 caratteri.",
        );
        return;
      }

      // Identity Verification Constraint Check
      if (password.value !== confirmPassword.value) {
        triggerShake();
        notifications.error(
          "Errore crittografico: Le Passphrase non combaciano.",
        );
        return;
      }

      // Legal Compliance Check
      if (!acceptedTerms.value) {
        triggerShake();
        notifications.error(
          "Protocollo negato: È necessario accettare i Termini e confermare l'età.",
        );
        return;
      }

      // New Identity Initialization Sequence
      const res = await api.post("/auth/register", {
        username: username.value,
        email: email.value,
        password: password.value,
        privacyAccepted: acceptedTerms.value
      });
      notifications.success(
        res.data.message || "Frequenza generata! Controlla la posta.",
      );

      // Automatic switch to Login perspective after successful registration (without token issuance)
      setTimeout(() => {
        isLogin.value = true;
        password.value = "";
        confirmPassword.value = "";
        acceptedTerms.value = false;
      }, 2800);
    }
  } catch {
    // Structural errors are managed by the global API interceptor.
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="login-view fade-in">
    <div class="glass-panel auth-panel">
      <h2>{{ isLogin ? "Accesso Costruttori" : "Nuova Sincronizzazione" }}</h2>

      <div
        v-if="isLogin && route.query.session_expired"
        class="alert-box error"
      >
        Frequenza di sessione scaduta. Re-autenticazione richiesta.
      </div>

      <form @submit.prevent="submitForm">
        <input
          v-if="!isLogin"
          v-model="username"
          type="text"
          placeholder="Nome Costruttore"
          class="glass-input"
          required
        />
        <input
          v-model="email"
          type="email"
          placeholder="Frequenza Temporale (Email)"
          class="glass-input"
          required
        />
        <input
          v-model="password"
          type="password"
          placeholder="Passphrase"
          class="glass-input"
          :class="{ 'shake-limit': shakeError && password.length < 8 }"
          required
        />
        <div v-if="!isLogin" class="password-requirements">
          <span :class="{ met: password.length >= 8 }">
            {{ password.length >= 8 ? "✓" : "○" }} Almeno 8 caratteri necessari
          </span>
        </div>
        <input
          v-if="!isLogin"
          v-model="confirmPassword"
          type="password"
          placeholder="Conferma Passphrase"
          class="glass-input"
          :class="{ 'shake-limit': shakeError && password !== confirmPassword }"
          required
        />

        <div
          v-if="!isLogin"
          class="legal-checkbox-wrapper"
          :class="{ 'shake-limit': shakeError && !acceptedTerms }"
        >
          <label class="cyber-checkbox-container">
            <input v-model="acceptedTerms" type="checkbox" />
            <span class="checkmark"></span>
            <span class="label-text">
              Accetto i
              <RouterLink to="/terms" target="_blank">Termini di Utilizzo</RouterLink>
              e confermo di avere più di 18 anni. Ho letto l'
              <RouterLink to="/privacy" target="_blank">Informativa Privacy</RouterLink>.
            </span>
          </label>
        </div>

        <button
          type="submit"
          class="cyber-btn btn-primary full-width"
          :disabled="loading"
        >
          {{
            loading
              ? "Elaborazione..."
              : isLogin
                ? "Sincronizzazione"
                : "Registra Frequenza"
          }}
        </button>
      </form>

      <p v-if="isLogin" class="toggle-text forgot-wrapper">
        <RouterLink to="/forgot-password" class="forgot-link">
          Hai smarrito la Passphrase?
        </RouterLink>
      </p>

      <p class="toggle-text">
        {{
          isLogin
            ? "Non hai un identificativo temporale?"
            : "Hai già una frequenza registrata?"
        }}
        <a href="#" @click.prevent="toggleMode">{{
          isLogin ? "Inizializzalo" : "Accedi"
        }}</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.alert-box {
  padding: 0.8rem;
  border-radius: 6px;
  margin-bottom: 1.5rem;
  font-family: var(--font-body);
  font-size: 0.9rem;
  text-align: center;
}
.error {
  background: rgba(255, 0, 60, 0.2);
  border: 1px solid var(--accent-magenta);
  color: #ff80a0;
}
.success {
  background: rgba(0, 255, 100, 0.2);
  border: 1px solid #00ff88;
  color: #80ffc0;
}
.toggle-text {
  text-align: center;
  margin-top: 1.5rem;
  font-size: 0.85rem;
  color: var(--text-muted);
}
.toggle-text a {
  color: var(--accent-gold);
  text-decoration: none;
  font-weight: 600;
  margin-left: 0.5rem;
}
.toggle-text a:hover {
  text-decoration: underline;
  text-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
}
.forgot-wrapper {
  margin-top: 1rem;
  margin-bottom: -0.5rem;
}
.forgot-link {
  color: var(--text-light) !important;
  font-size: 0.8rem;
  font-style: italic;
}

.auth-panel .btn-primary,
.auth-panel .btn-primary:hover,
.auth-panel .btn-primary:disabled {
  color: #0a0e1a !important;
}

form {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.glass-input {
  margin: 0 !important;
}

/* Password & Legal Styles */
.password-requirements {
  text-align: center;
  margin: -0.2rem 0; /* Regolato per sommarsi al gap del form */
  font-size: 0.78rem;
  color: var(--text-muted);
  font-family: var(--font-body);
  transition: all 0.3s ease;
}
.password-requirements span {
  display: inline-block;
  padding: 0.2rem 0.8rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 20px;
}
.password-requirements .met {
  color: #00ff88;
  border-color: rgba(0, 255, 136, 0.3);
  background: rgba(0, 255, 136, 0.05);
  text-shadow: 0 0 12px rgba(0, 255, 136, 0.4);
}

.legal-checkbox-wrapper {
  margin: 1.5rem 0 2rem;
  text-align: left;
  padding: 0 0.5rem;
}

.cyber-checkbox-container {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  cursor: pointer;
  font-size: 0.82rem;
  line-height: 1.5;
  color: var(--text-muted);
}

.cyber-checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  min-width: 18px;
  height: 18px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--glass-border);
  border-radius: 3px;
  position: relative;
  transition: all 0.2s ease;
  margin-top: 2px;
}

.cyber-checkbox-container:hover input ~ .checkmark {
  border-color: var(--accent-gold);
  background: rgba(254, 220, 104, 0.05);
}

.cyber-checkbox-container input:checked ~ .checkmark {
  background: var(--accent-gold);
  border-color: var(--accent-gold);
  box-shadow: 0 0 10px rgba(254, 220, 104, 0.3);
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
  left: 6px;
  top: 2px;
  width: 5px;
  height: 10px;
  border: solid #0a0e1a;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.cyber-checkbox-container input:checked ~ .checkmark:after {
  display: block;
}

.label-text a {
  color: var(--text-main);
  text-decoration: underline;
  text-decoration-color: var(--accent-gold);
  transition: color 0.2s;
}

.label-text a:hover {
  color: var(--accent-gold);
}

/* Error Feedback Animations */
.shake-limit {
  animation: shake-limit 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  border-color: rgba(255, 0, 60, 0.5) !important;
  box-shadow: 0 0 15px rgba(255, 0, 60, 0.15) !important;
}

@keyframes shake-limit {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }
  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}
</style>
