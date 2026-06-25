import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirror tsconfig "paths" ({ "@/*": ["./src/*"] }) so modules under test that
    // import via the @/ alias (e.g. db.ts → @/entitlements) resolve as they do
    // under Next.js. Vitest/Vite don't read tsconfig paths on their own.
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
});
