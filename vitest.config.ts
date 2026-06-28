import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    // Verhindert, dass happy-dom iframe-src tatsaechlich uebers Netz laedt
    // (Blocker-Tests setzen echte Embed-URLs). Nur Test-Infrastruktur.
    environmentOptions: {
      happyDOM: { settings: { disableIframePageLoading: true } },
    },
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/stub.js'],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
