import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', {open: 'never'}],
    ['list'],
  ],
  timeout: 180_000,

  use: {
    baseURL: 'http://localhost:6006',
    trace: 'on-first-retry',
    screenshot: 'on',
  },

  projects: [
    {
      name: 'chromium',
      use: {...devices['Desktop Chrome']},
    },
    {
      name: 'mobile-chrome',
      use: {...devices['Pixel 5']},
    },
  ],

  // Auto-start storybook server before tests
  webServer: {
    command: 'npx http-server ../cpk-ui/storybook-static -p 6006 --silent',
    port: 6006,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
