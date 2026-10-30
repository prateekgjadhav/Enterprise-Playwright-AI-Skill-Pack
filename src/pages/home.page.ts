import { type Locator, type Page } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly path: string = '/';
  readonly heading: Locator;
  readonly getStartedButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.getStartedButton = page.getByRole('link', { name: 'Get started' });
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path);
  }
}

