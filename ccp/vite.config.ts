import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Puerto 5174 (no 5173) para poder correr junto a app-qr-sicsaft en desarrollo sin chocar — ver
// devops/local/docker-compose.yml CIS_CORS_ORIGIN.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
  },
  preview: {
    port: 8766,
  },
});
