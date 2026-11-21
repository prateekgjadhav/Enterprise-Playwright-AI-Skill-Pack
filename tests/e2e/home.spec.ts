import { test, expect } from '@fixtures';

test('home page shows the main navigation', { tag: ['@P1', '@home', '@smoke'] }, async ({ homePage }) => {
  await homePage.open();
  await expect(homePage.heading).toBeVisible();
  await expect(homePage.mainNav).toBeVisible();
});
