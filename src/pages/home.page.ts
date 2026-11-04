import { type Locator, type Page } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly path: string = '/';
  readonly banner: Locator;
  readonly categoryCards: Locator;

  constructor(page: Page) {
    this.page = page;
    this.banner = page.locator('header a');
    this.categoryCards = page.locator('.category-cards .card');
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }
}
