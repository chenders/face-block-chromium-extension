// tests/helpers/test-setup.js
// Shared test setup utilities to reduce boilerplate

import { chromium } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

/**
 * Setup extension testing context
 * @param {Object} options - Configuration options
 * @param {boolean} options.needsExtensionId - Whether to retrieve extension ID (default: true)
 * @param {number} options.loadDelay - Delay in ms to wait for extension to load (default: 2000)
 * @returns {Promise<Object>} - { browser, extensionId, userDataDir }
 */
export async function setupExtensionContext(options = {}) {
  const { needsExtensionId = true, loadDelay = 2000 } = options;

  // Create temporary directory for user data
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-'));

  // Launch browser with extension
  // With WXT, the built extension is in .output/chrome-mv3
  const pathToExtension = path.join(process.cwd(), '.output/chrome-mv3');
  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: false, // Extensions don't work in headless mode
    args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`],
  });

  // Wait for extension to load
  await new Promise(resolve => setTimeout(resolve, loadDelay));

  let extensionId = null;

  // Get extension ID if needed
  if (needsExtensionId) {
    for (const worker of browser.serviceWorkers()) {
      if (worker.url().includes('chrome-extension://')) {
        extensionId = new URL(worker.url()).host;
        break;
      }
    }

    if (extensionId) {
      console.log('Extension ID:', extensionId);
    }
  }

  return { browser, extensionId, userDataDir };
}

/**
 * Cleanup extension testing context
 * @param {Object} context - Context returned from setupExtensionContext
 */
export async function cleanupExtensionContext({ browser, userDataDir }) {
  if (browser) {
    await browser.close();
  }
  if (userDataDir) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

/**
 * Create a Playwright test fixture with extension context
 * Usage in test files:
 *
 * import { createExtensionFixture } from './helpers/test-setup.js';
 * const test = createExtensionFixture();
 *
 * test('my test', async ({ browser, extensionId }) => {
 *   // Use browser and extensionId
 * });
 */
export function createExtensionFixture(options = {}) {
  const { test } = require('@playwright/test');

  return test.extend({
    // eslint-disable-next-line no-empty-pattern
    context: async ({}, use) => {
      const ctx = await setupExtensionContext(options);
      await use(ctx);
      await cleanupExtensionContext(ctx);
    },
  });
}
