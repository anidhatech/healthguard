import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'evals/**/*.eval.test.ts'],
    environment: 'node',
  },
});
