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
  // Increase timeout for CI
  timeout: process.env.CI ? 120000 : 60000, // 2 minutes in CI, 1 minute locally

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Increase action timeout for CI
    actionTimeout: process.env.CI ? 30000 : 15000,
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
