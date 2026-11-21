import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@fixtures';

test('home page has no serious accessibility violations', { tag: ['@P1', '@home', '@a11y'] }, async ({ page, homePage }) => {
  await homePage.open();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  const blocking = result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(blocking.map((v) => `${v.id}: ${v.nodes.length} element(s)`)).toEqual([]);
});
