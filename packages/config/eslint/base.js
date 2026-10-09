// Shared ESLint flat-config building blocks for every HealthGuard package.
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export const sharedIgnores = {
  ignores: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.next/**',
    '**/.turbo/**',
    '**/coverage/**',
    '**/src/generated/**',
    '**/next-env.d.ts',
    '**/playwright-report/**',
    '**/test-results/**',
    '**/public/sw.js',
  ],
};

/** Rules that keep clinical and security code honest. */
export const sharedRules = {
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/no-explicit-any': 'error',
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': 'error',
  '@typescript-eslint/switch-exhaustiveness-check': 'error',
  eqeqeq: ['error', 'always'],
  'no-console': ['error', { allow: ['warn', 'error'] }],
};

/**
 * Type-aware TypeScript config.
 * @param {{ tsconfigRootDir: string, extra?: import('eslint').Linter.Config[] }} options
 */
export function typescriptConfig({ tsconfigRootDir, extra = [] }) {
  return defineConfig(
    sharedIgnores,
    js.configs.recommended,
    tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: {
            allowDefaultProject: ['*.config.ts', '*.config.mts'],
          },
          tsconfigRootDir,
        },
      },
      rules: sharedRules,
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.disableTypeChecked],
    },
    {
      files: ['**/*.test.ts', '**/*.spec.ts', '**/test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-non-null-assertion': 'off',
        '@typescript-eslint/no-unsafe-member-access': 'off',
        '@typescript-eslint/no-unsafe-assignment': 'off',
        '@typescript-eslint/no-unsafe-argument': 'off',
        '@typescript-eslint/unbound-method': 'off',
        '@typescript-eslint/no-unsafe-call': 'off',
        '@typescript-eslint/no-unsafe-return': 'off',
      },
    },
    ...extra,
    prettier,
  );
}
