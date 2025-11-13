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
    // Keep headed mode for accurate extension testing
    headless: false,
    viewport: { width: 800, height: 600 },
    // Position browser window offscreen to prevent stealing focus
    launchOptions: {
      args: [
        '--window-position=-2000,-2000', // Move window offscreen
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-popup-blocking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=TranslateUI',
        '--disable-extensions-except=' + path.resolve('./extension'),
        '--load-extension=' + path.resolve('./extension'),
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
});
