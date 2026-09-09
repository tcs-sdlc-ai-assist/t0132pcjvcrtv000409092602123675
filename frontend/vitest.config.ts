import { defineConfig } from 'vitest/config';

/** Configure component tests separately from Playwright end-to-end specs. */
export default defineConfig({
  test: {
    environment: 'jsdom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
  },
});
