<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import api from "../utils/api";
import { useRoute } from "vue-router";
import { useHead } from "@unhead/vue";
import {
  getNewsCategoryLabel,
  isStoryCategory,
  type NewsCategory,
} from "../utils/newsCategory";
import { resolveNewsImage } from "../utils/imageResolver";

/**
 * NewsDetail Data Structure
 * Comprehensive model for individual news entries.
 */
type NewsDetail = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  content: string; // Markdown or plain text content
  category: NewsCategory;
  imageUrl: string;
  sourceUrl: string;
  publishedAt: string;
  isFeatured: boolean;
  featuredOrder: number | null;
};

// Global Orchestration: Routing & State
const route = useRoute();
const news = ref<NewsDetail | null>(null);
const isLoading = ref(true);
const errorMessage = ref("");

// SEO Optimization: Dynamic News & Lore Metadata.
// Must come after the refs it reads: these computed getters touch news.value,
// and unhead evaluates them while the component is setting up. Declared above
// the refs, as it was until 2026-08-25, the getter runs while `news` is still
// in its temporal dead zone and the whole view dies with "Cannot access 'n'
// before initialization", leaving the page shell without the article.
// SEO Optimization: Dynamic News & Lore Metadata
useHead({
  title: computed(() => news.value ? `${news.value.title} - Joule News` : "Caricamento News..."),
  meta: [
    {
      name: "description",
      content: computed(() => news.value?.summary || "Leggi le ultime novità e la storia ufficiale di Joule: Zero Point."),
    },
    {
      property: "og:title",
      content: computed(() => news.value?.title),
    },
    {
      property: "og:description",
      content: computed(() => news.value?.summary),
    },
    {
      property: "og:image",
      content: computed(() => news.value?.imageUrl ? resolveNewsImage(news.value.imageUrl) : ""),
    },
    {
      name: "twitter:card",
      content: "summary_large_image",
    },
  ],
});

/**
 * Date Localization Bridge
 * Formats ISO strings into human-readable Italian locale markers.
 * @param value ISO date string
 */
const formatNewsDate = (value: string) =>
  new Date(value).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

/**
 * Content Synthesis: Paragraph Extraction
 * Splits the raw content string into displayable paragraph units.
 */
const paragraphs = computed(() =>
  (news.value?.content || "")
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean),
);

onMounted(async () => {
  // Initialization Sequence: Fetch specific news artifact by slug
  const slug = String(route.params.slug || "");

  if (!slug) {
    errorMessage.value = "Invalid news identifier.";
    isLoading.value = false;
    return;
  }

  try {
    const response = await api.get(`/news/${slug}`);
    news.value = response.data;
  } catch {
    errorMessage.value = "The requested news entry is unavailable in the Matrix.";
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <div class="news-detail-page fade-in">
    <article v-if="news && !isLoading" class="glass-panel news-detail-card">
      <p class="news-meta">{{ formatNewsDate(news.publishedAt) }}</p>
      <div class="news-badges-row">
        <div
          class="news-category-badge"
          :class="
            isStoryCategory(news.category)
              ? 'news-category-badge--lore'
              : 'news-category-badge--news'
          "
        >
          {{ getNewsCategoryLabel(news.category) }}
        </div>
        <div v-if="news.isFeatured" class="news-badge">NEWS IN EVIDENZA</div>
      </div>
      <h1>{{ news.title }}</h1>
      <p class="news-summary">{{ news.summary }}</p>
      <img
        v-if="news.imageUrl"
        :src="resolveNewsImage(news.imageUrl)"
        :alt="news.title"
        class="news-image"
      />

      <div class="news-content">
        <p v-for="(paragraph, index) in paragraphs" :key="index">
          {{ paragraph }}
        </p>
      </div>

      <div class="news-detail-actions">
        <div class="news-detail-links">
          <RouterLink
            to="/"
            class="link-text detail-nav-link detail-nav-link--back"
          >
            <svg viewBox="0 0 16 16" class="detail-nav-icon" aria-hidden="true">
              <path
                d="M9.5 3.5L5 8l4.5 4.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>Torna alla Home</span>
          </RouterLink>
          <RouterLink
            :to="isStoryCategory(news.category) ? { path: '/news', query: { category: 'storia' } } : '/news'"
            class="news-archive-link"
          >
            {{
              isStoryCategory(news.category)
                ? "Archivio storia"
                : "Archivio news"
            }}
          </RouterLink>
        </div>
        <a
          v-if="news.sourceUrl"
          :href="news.sourceUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="news-source-link"
        >
          Vai alla fonte esterna
        </a>
      </div>
    </article>

    <div v-else-if="isLoading" class="glass-panel news-state">
      Caricamento news in corso...
    </div>

    <div v-else class="glass-panel news-state">
      <p>{{ errorMessage || "News non trovata." }}</p>
      <RouterLink
        to="/"
        class="link-text detail-nav-link detail-nav-link--back"
      >
        <svg viewBox="0 0 16 16" class="detail-nav-icon" aria-hidden="true">
          <path
            d="M9.5 3.5L5 8l4.5 4.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>Torna alla Home</span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.news-detail-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 1.8rem 2rem 2.2rem;
}

.news-detail-card {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.news-meta {
  margin: 0;
  font-size: 0.8rem;
  color: rgba(226, 232, 240, 0.72);
  letter-spacing: 0.6px;
}

.news-detail-card h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.35rem, 2.8vw, 2.1rem);
  line-height: 1.2;
  color: var(--text-light);
}

.news-summary {
  margin: 0;
  color: var(--text-muted);
  font-size: 1rem;
  line-height: 1.65;
  border-left: 2px solid var(--accent-gold);
  padding-left: 0.85rem;
}

.news-badge {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: #ffd892;
  background: rgba(255, 190, 92, 0.12);
  border: 1px solid rgba(255, 205, 120, 0.2);
  border-radius: 999px;
  padding: 0.18rem 0.55rem;
}

.news-badges-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
}

.news-category-badge {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.8px;
  border-radius: 999px;
  padding: 0.18rem 0.55rem;
}

.news-category-badge--news {
  color: var(--accent-gold);
  background: rgba(254, 220, 104, 0.12);
  border: 1px solid rgba(254, 220, 104, 0.26);
}

.news-category-badge--lore {
  color: #00ff96;
  background: rgba(0, 255, 150, 0.12);
  border: 1px solid rgba(0, 255, 150, 0.26);
}

.news-image {
  width: 100%;
  max-height: 430px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.news-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.news-content p {
  margin: 0;
  line-height: 1.75;
  color: var(--text-light);
}

.news-detail-actions {
  margin-top: 0.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.8rem;
}

.news-detail-links {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  flex-wrap: wrap;
}

.detail-nav-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.detail-nav-icon {
  width: 0.9rem;
  height: 0.9rem;
  flex: 0 0 auto;
}

.news-archive-link {
  display: inline-flex;
  align-items: center;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s ease;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  padding-left: 1.2rem;
}

.news-archive-link:hover {
  color: var(--accent-gold);
  padding-left: 1.4rem;
}

.news-source-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.85rem;
}

.news-state {
  padding: 1.3rem 1.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  color: var(--text-muted);
}

@media (max-width: 768px) {
  .news-detail-page {
    padding: 1.2rem 1rem 1.8rem;
  }

  .news-detail-card {
    padding: 1.2rem;
  }
}
</style>
