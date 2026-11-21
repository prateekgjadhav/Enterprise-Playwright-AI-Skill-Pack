import type { SignInPage } from '../pages/sign-in.page';

/** The sign-in journey, written once. It returns; the spec asserts. */
export class SignInModule {
  constructor(private readonly signInPage: SignInPage) {}

  async as(email: string, password: string): Promise<void> {
    await this.signInPage.open();
    await this.signInPage.email.fill(email);
    await this.signInPage.password.fill(password);
    await this.signInPage.submit.click();
  }
}
