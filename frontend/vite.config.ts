import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig( {
  plugins: [
    vue(),
    VitePWA( {
      registerType: 'autoUpdate',
      includeAssets: ['favicon.webp', 'favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Joule: Zero Point',
        short_name: 'Joule ZP',
        description: 'Il primo simulatore di conflitti temporali. Un Living Card Game competitivo basato sulla termodinamica.',
        theme_color: '#0c121c',
        background_color: '#0c121c',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'it',
        categories: ['games', 'entertainment'],
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Terminale',
            short_name: 'Terminal',
            url: '/terminale-punto-zero',
            description: 'Accedi al Terminale AI',
          },
          {
            name: 'Database Carte',
            short_name: 'Carte',
            url: '/cards',
            description: 'Sfoglia i Frammenti',
          },
          {
            name: 'Deckbuilder',
            short_name: 'Mazzi',
            url: '/deckbuilder',
            description: 'Costruisci il tuo mazzo',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: null,
        // Cache static assets aggressively
        globPatterns: ['**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
        // Runtime caching for API calls — network first, fallback to cache
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/v1\/cards/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'joule-cards-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24, // 24h
              },
            },
          },
          {
            urlPattern: /^https:\/\/.*\/api\/v1\/news/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'joule-news-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60, // 1h
              },
            },
          },
        ],
      },
      devOptions: {
        // Enable PWA in dev mode so you can test it locally
        enabled: true,
      },
    } ),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.ts',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
  server: {
    host: true,
    port: 5174,
    proxy: {
      '/socket.io': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: process.env.VITE_PROXY_TARGET || 'http://localhost:3000',
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000,
        configure: ( proxy ) => {
          // Disable response buffering for SSE streaming
          proxy.on( 'proxyRes', ( proxyRes ) => {
            // Force chunked encoding to prevent buffering
            if ( proxyRes.headers['content-type']?.includes( 'text/event-stream' ) ) {
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['x-accel-buffering'] = 'no';
            }
          } );
        }
      }
    }
  },
  build: {
    sourcemap: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
    modulePreload: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks( id ) {
          if ( id.includes( 'highlight.js' ) || id.includes( 'marked' ) || id.includes( 'dompurify' ) ) {
            return 'editor-bundle';
          }
          if ( id.includes( 'axios' ) || id.includes( 'pinia' ) ) {
            return 'core-libs';
          }
          if ( id.includes( 'node_modules' ) ) {
            return 'vendor';
          }
        }
      }
    }
  }
} )
