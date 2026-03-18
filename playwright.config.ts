import {defineConfig, devices} from '@playwright/test';
import config from './cpk-e2e.config';

const port = config.storybookPort;

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
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
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
    command: `npx http-server ${config.targetRoot}/${config.storybookStaticPath} -p ${port} --silent`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
