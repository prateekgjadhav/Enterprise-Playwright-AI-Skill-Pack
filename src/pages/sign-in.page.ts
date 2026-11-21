import type { Locator, Page } from '@playwright/test';

export class SignInPage {
  readonly path = '/sign-in';
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(readonly page: Page) {
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Sign in' });
    this.error = page.getByRole('alert');
  }

  async open(): Promise<void> { await this.page.goto(this.path); }
}
