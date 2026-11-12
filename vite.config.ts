import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// The version shown in the app is the real one, and every build stamps itself.
// A phone keeps running the old bundle until the page reloads, so without a
// per build stamp there is no way to tell an updated PWA from a stale one.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const buildId = new Date().toISOString().replace('T', ' ').slice(0, 19);

const isolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  // One build works at a domain root and under any GitHub Pages repository path.
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: {
        name: 'Phosphoreya — живая карта',
        short_name: 'Phosphoreya',
        lang: 'ru',
        start_url: '.',
        display: 'standalone',
        background_color: '#141618',
        theme_color: '#141618',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globIgnores: ['**/ort-wasm-*'],
        globPatterns: ['**/*.{js,css,html,svg,png,wasm,wav}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: false,
      },
    }),
  ],

  worker: {
    format: 'es',
  },

  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm'],
  },

  server: {
    port: 5173,
    strictPort: true,
    headers: isolationHeaders,
  },

  preview: {
    port: 4173,
    strictPort: true,
    headers: isolationHeaders,
  },
});
