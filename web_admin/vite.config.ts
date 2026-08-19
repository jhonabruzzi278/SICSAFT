import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Puerto 5176 (5173 app-qr-sicsaft, 5174 ccp, 5175 ccp modo mock) para poder correr junto a los
// demas portales en desarrollo sin chocar — ver devops/local/docker-compose.yml CIS_CORS_ORIGIN.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5176,
  },
  preview: {
    port: 8767,
  },
});
