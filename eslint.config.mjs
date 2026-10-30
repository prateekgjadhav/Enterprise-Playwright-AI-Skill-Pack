import playwright from 'eslint-plugin-playwright';

export default [
  playwright.configs['flat/recommended'],
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='locator'] > Literal[value=/^(xpath=|\\/\\/)/]",
          message: 'No XPath locators — use role/label/test-id (locator-strategy).'
        },
        {
          selector: "NewExpression[callee.name=/Page$/]",
          message: 'No new …Page() in specs — inject via fixtures.'
        }
      ]
    }
  }
];

