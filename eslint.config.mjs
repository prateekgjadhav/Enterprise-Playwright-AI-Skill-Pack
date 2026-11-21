import tseslint from 'typescript-eslint';
import qa from './eslint/qa-rules.mjs';

const QA = Object.fromEntries(Object.keys(qa.rules).map((r) => [`qa/${r}`, 'error']));

export default [
  { ignores: ['node_modules/**', 'rag/**', 'scripts/**', 'hooks/**', 'eslint/**', 'evals/**', 'reports/**', 'test-results/**', 'playwright-report/**', 'blob-report/**', 'dist/**'] },
  ...tseslint.configs.recommended,
  {
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' },
    plugins: { qa },
    files: ['src/**/*.ts', 'tests/**/*.ts', 'playwright.config.ts'],
    rules: QA,
  },
];
