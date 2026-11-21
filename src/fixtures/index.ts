// The one entry point for specs: import { test, expect } from '@fixtures'. Dependencies arrive by injection.
import { test as base, expect } from '@playwright/test';
import { loadQaConfig } from '../config/load';
import { createSecretProvider, type SecretProvider } from './secret-providers';
import { registerForRedaction } from './redaction-registry';
import { HomePage } from '../pages/home.page';
import { SignInPage } from '../pages/sign-in.page';
import { SignInModule } from '../modules/sign-in.module';
import { UserFactory } from '../data/user.factory';

const qa = loadQaConfig();

type TestFixtures = { egressGuard: void; homePage: HomePage; signInPage: SignInPage; signIn: SignInModule; users: UserFactory };
type WorkerFixtures = { secretProvider: SecretProvider };

export const test = base.extend<TestFixtures, WorkerFixtures>({
  secretProvider: [async ({}, use) => {
    const provider = createSecretProvider(qa.secrets.provider, qa.secrets.refs);
    await use({
      async get(name) {
        const value = await provider.get(name);
        if (!value) throw new Error(`secret ${name} resolved to nothing (fail closed)`);
        registerForRedaction(value);
        return value;
      },
    });
  }, { scope: 'worker' }],

  // Browser-level egress guard: any request to a host outside environments[].hosts is aborted.
  egressGuard: [async ({ context }, use) => {
    await context.route('**/*', (route) => (qa.isAllowedUrl(route.request().url()) ? route.continue() : route.abort('blockedbyclient')));
    await use();
  }, { auto: true }],

  homePage: async ({ page }, use) => { await use(new HomePage(page)); },
  signInPage: async ({ page }, use) => { await use(new SignInPage(page)); },
  signIn: async ({ signInPage }, use) => { await use(new SignInModule(signInPage)); },
  users: async ({ request }, use, testInfo) => {
    const factory = new UserFactory(request, testInfo.workerIndex);
    try { await use(factory); } finally { await factory.cleanup(); }
  },
});

export { expect };
