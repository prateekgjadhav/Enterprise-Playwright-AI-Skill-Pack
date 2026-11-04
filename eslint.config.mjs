import playwright from 'eslint-plugin-playwright';
import tseslint from 'typescript-eslint';

export default [
  ...tseslint.configs.recommended,
  playwright.configs['flat/recommended'],
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='locator'] > Literal[value=/^(xpath=|\\/\\/)/]",
          message: 'No XPath locators — use role/label/test-id (locator-strategy).'
        }
      ]
    }
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.spec.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name=/Page$/]",
          message: 'No new …Page() in specs — inject via fixtures.'
        }
      ]
    }
  }
];
