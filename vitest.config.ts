import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['dist/utils/**/*.js'],
      exclude: ['dist/commands/**', 'dist/index.js', 'dist/mcp.js'],
    },
    testTimeout: 10000,
  },
});
