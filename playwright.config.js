// playwright.config.js
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Extensions can't run in parallel easily
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run tests sequentially
  maxFailures: 1, // Stop after first failure (fast-fail)
  reporter: 'html',
  // Filter tests based on environment
  grep: process.env.SMOKE_TESTS ? /@smoke/ : undefined,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Load the extension from WXT build output
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve('./.output/chrome-mv3')}`,
            `--load-extension=${path.resolve('./.output/chrome-mv3')}`,
          ],
        },
      },
    },
  ],
});
