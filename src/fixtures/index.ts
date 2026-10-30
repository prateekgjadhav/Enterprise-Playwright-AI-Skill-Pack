import { test as base, expect } from '@playwright/test';
import { HomePage } from '../pages/home.page.js';

type TestFixtures = {
  homePage: HomePage;
  apiAs: (role: 'guest' | 'user' | 'admin') => Promise<{ authScheme: string; headers: Record<string, string> }>;
};

export const test = base.extend<TestFixtures>({
  homePage: async ({ page }, use) => {
    const homePage = new HomePage(page);
    await use(homePage);
  },
  apiAs: async ({}, use) => {
    await use(async (role: 'guest' | 'user' | 'admin') => {
      const authHeaderVal = process.env.AUTH_HEADER || `Bearer ${role}`;
      return {
        authScheme: 'Bearer',
        headers: {
          Authorization: authHeaderVal,
        },
      };
    });
  },
});

export { expect };

