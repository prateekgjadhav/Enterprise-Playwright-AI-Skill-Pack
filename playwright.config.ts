import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { open: 'never' }],
    ['list']
  ],
  use: {
    baseURL: process.env.BASE_URL,
    testIdAttribute: 'data-testid',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'functional',
      testDir: 'tests/functional',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'api',
      testDir: 'tests/api',
    },
    {
      name: 'visual',
      testDir: 'tests/visual',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'a11y',
      testDir: 'tests/a11y',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'security',
      testDir: 'tests/security',
      grep: /@security/,
      retries: 0,
    },
  ],
});

