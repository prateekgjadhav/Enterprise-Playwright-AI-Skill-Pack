import type { Locator, Page } from '@playwright/test';

export class HomePage {
  readonly path = '/';
  readonly heading: Locator;
  readonly mainNav: Locator;
  readonly signInLink: Locator;

  // Locators are assigned here, not in field initialisers: with useDefineForClassFields a field initialiser
  // that reads this.page would run before the parameter property is set.
  constructor(readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.mainNav = page.getByRole('navigation', { name: 'Main' });
    this.signInLink = page.getByRole('link', { name: 'Sign in' });
  }

  async open(): Promise<void> { await this.page.goto(this.path); }
}
