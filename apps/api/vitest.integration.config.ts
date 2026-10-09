import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integration tests run the real app against PostgreSQL and Redis.
// They reset TEST_DATABASE_URL (default: the healthguard_test database).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.int.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
