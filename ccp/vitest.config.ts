import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

// Config separada de vite.config.ts a propósito — evita mezclar tipos de `vitest/config` con los
// plugins de build (react()/tailwindcss()) que no hacen falta para correr tests unitarios de
// src/lib/ (DOC-023/hallazgo de cobertura: OIDC/PKCE no tenía ningún test, ni unitario ni e2e).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts'],
    },
  },
});
