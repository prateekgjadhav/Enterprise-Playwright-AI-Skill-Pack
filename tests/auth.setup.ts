import { test as setup } from '@fixtures';
import { loadQaConfig } from '../src/config/load';

const qa = loadQaConfig();

for (const role of qa.framework.roles) {
  setup(`sign in as ${role}`, async ({ page, signIn, secretProvider }) => {
    const [email, password] = (await secretProvider.get(role)).split(':');
    await signIn.as(email, password);
    await page.waitForURL((url) => !url.pathname.startsWith('/sign-in'));
    await page.context().storageState({ path: `.auth/${role}.json` });
  });
}
