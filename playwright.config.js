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
    // Minimize and position browser window to reduce visibility
    launchOptions: {
      args: [
        '--window-size=1,1', // Make window as small as possible
        '--window-position=0,9999', // Push window far down
        '--start-minimized', // Start minimized (macOS compatible)
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
