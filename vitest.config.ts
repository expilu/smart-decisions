import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      include: ['src/**'],
      // index.ts is a barrel of re-exports; types/ holds only interface/type
      // declarations, i.e. no executable code to cover.
      exclude: ['src/index.ts', 'src/types/**'],
      reporter: ['text', 'html'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
