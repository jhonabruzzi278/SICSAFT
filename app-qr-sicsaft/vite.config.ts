import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // CORE-RF-05 -- la Web Crypto API (crypto.subtle para PKCE, crypto.randomUUID en ScanPage)
    // solo existe en "contexto seguro" (HTTPS o localhost). El teléfono del Profesional de AFT
    // accede por la IP de LAN de la PC (nunca "localhost" desde su punto de vista), así que
    // necesita HTTPS real, aunque sea autofirmado -- certificado generado una vez y cacheado en
    // node_modules/.vite-plugin-basic-ssl, no se commitea. Solo afecta al dev/preview server, no
    // al build de producción (Vercel sigue sirviendo por su propio HTTPS real).
    //
    // EXCEPTO en `--mode e2e`: la suite de Playwright (playwright.config.ts) sirve el preview y lo
    // sondea en `http://localhost:8765`; con basicSsl el preview arranca en HTTPS y (a) el
    // health-check http nunca responde -> `webServer` da timeout, y (b) Chromium rechaza el
    // Service Worker de MSW por el certificado autofirmado -> la app queda en blanco. En e2e todo
    // corre en localhost (contexto seguro por sí solo), así que no hace falta TLS.
    ...(mode === 'e2e' ? [] : [basicSsl()]),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['icons/icon.svg', '.well-known/assetlinks.json'],
      manifest: {
        name: 'APP QR SICSAFT — Control de Inventario',
        short_name: 'APP QR SICSAFT',
        description: 'Generador de etiquetas QR y lector QR para inventario.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b0d12',
        theme_color: '#0b0d12',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 8765,
    // host: true == 0.0.0.0 -- necesario para que el teléfono en la misma Wi-Fi llegue acá; con
    // el default (solo localhost) el preview server ni siquiera acepta la conexión desde afuera.
    host: true,
  },
}));
