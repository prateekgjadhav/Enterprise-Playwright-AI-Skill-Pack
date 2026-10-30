import { test, expect } from '@fixtures';

test.describe('Home Page Smoke Tests', () => {
  test('verify home page loads and displays main heading @P0 @smoke @home', async ({ homePage }) => {
    await homePage.goto();
    await expect(homePage.heading).toBeVisible();
  });
});

