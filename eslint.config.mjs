import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  {
    settings: {
      next: {
        rootDir: 'apps/web/',
      },
    },
  },
  {
    files: [
      'apps/web/components/monthly-quotation-report-view.tsx',
      'apps/web/components/open-aging-quotation-report-view.tsx',
    ],
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
  globalIgnores([
    '**/.next/**',
    '**/dist/**',
    '**/node_modules/**',
    'playwright-report/**',
    'test-results/**',
    'coverage/**',
  ]),
]);
