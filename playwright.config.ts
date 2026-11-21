import { defineConfig, devices } from '@playwright/test';
import { loadQaConfig } from './src/config/load';

// Fails closed: throws until .agents/qa.config.json has an approved environment, roles and a secret provider.
const qa = loadQaConfig();
const browsers = { chromium: devices['Desktop Chrome'], firefox: devices['Desktop Firefox'], webkit: devices['Desktop Safari'] } as const;
const roles = qa.framework.roles;

export default defineConfig({
  testDir: './tests',
  forbidOnly: !!process.env.CI,
  failOnFlakyTests: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  fullyParallel: true,
  reporter: process.env.CI ? [['blob'], ['github'], ['json', { outputFile: 'reports/results.json' }]] : [['html', { open: 'never' }], ['json', { outputFile: 'reports/results.json' }]],
  use: {
    baseURL: qa.baseUrl,
    testIdAttribute: qa.framework.testIdAttribute,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts$/ },
    ...Object.entries(browsers).flatMap(([browser, device]) =>
      roles.map((role) => ({
        name: `${browser}-${role}`,
        use: { ...device, storageState: `.auth/${role}.json` },
        dependencies: ['setup'],
        grepInvert: /@quarantine/,
        testIgnore: [/auth\.setup\.ts$/, /tests\/sec\//],
      }))),
    { name: 'quarantine', grep: /@quarantine/, retries: 0, use: { ...browsers.chromium, storageState: `.auth/${roles[0]}.json` }, dependencies: ['setup'], testIgnore: /tests\/sec\// },
    // The security project exists only for a run that names a scope; the verify-scope hook and the CI job check
    // the scope's signature, window and targets before any of these tests can start.
    ...(process.env.QA_SCOPE_FILE ? [{ name: 'security', testDir: './tests/sec', use: { ...browsers.chromium, storageState: `.auth/${roles[0]}.json` }, dependencies: ['setup'] }] : []),
  ],
});
