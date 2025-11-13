// playwright.config.js
import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Extensions can't run in parallel easily
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Run tests sequentially
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Run in headless mode by default (no visible browser)
    // Set HEADED=1 environment variable to see the browser: HEADED=1 npm test
    headless: !process.env.HEADED,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Load the extension
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve('./extension')}`,
            `--load-extension=${path.resolve('./extension')}`,
            // Prevent browser from stealing focus when in headed mode
            '--no-startup-window',
            '--disable-popup-blocking',
          ],
        },
      },
    },
  ],
});
