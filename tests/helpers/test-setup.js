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
 * @param {number} options.timeout - Maximum time to wait for browser launch (default: 60000 for CI, 30000 otherwise)
 * @returns {Promise<Object>} - { browser, extensionId, userDataDir }
 */
export async function setupExtensionContext(options = {}) {
  const {
    needsExtensionId = true,
    loadDelay = process.env.CI ? 5000 : 2000,
    timeout = process.env.CI ? 60000 : 30000
  } = options;

  console.log(`Setting up extension context (CI: ${!!process.env.CI}, timeout: ${timeout}ms)`);

  // Create temporary directory for user data
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-'));
  console.log(`Created user data directory: ${userDataDir}`);

  // Launch browser with extension
  // With WXT, the built extension is in .output/chrome-mv3
  const pathToExtension = path.join(process.cwd(), '.output/chrome-mv3');

  // Check if extension directory exists
  if (!fs.existsSync(pathToExtension)) {
    throw new Error(`Extension directory not found: ${pathToExtension}. Did you run 'npm run build' first?`);
  }

  console.log(`Loading extension from: ${pathToExtension}`);

  let browser;
  try {
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Extensions don't work in headless mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        // Add more args for CI stability
        ...(process.env.CI ? [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ] : [])
      ],
      timeout: timeout,
    });
    console.log('Browser launched successfully');
  } catch (error) {
    console.error('Failed to launch browser:', error);
    throw error;
  }

  // Wait for extension to load
  console.log(`Waiting ${loadDelay}ms for extension to load...`);
  await new Promise(resolve => setTimeout(resolve, loadDelay));

  let extensionId = null;

  // Get extension ID if needed
  if (needsExtensionId) {
    // Retry mechanism for getting service worker
    const maxRetries = process.env.CI ? 10 : 5;
    const retryDelay = 2000;

    for (let i = 0; i < maxRetries; i++) {
      const workers = browser.serviceWorkers();
      console.log(`Attempt ${i + 1}/${maxRetries}: Found ${workers.length} service workers`);

      for (const worker of workers) {
        if (worker.url().includes('chrome-extension://')) {
          extensionId = new URL(worker.url()).host;
          break;
        }
      }

      if (extensionId) {
        break;
      }

      if (i < maxRetries - 1) {
        console.log(`No extension service worker found yet, retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (extensionId) {
      console.log('Extension ID:', extensionId);
    } else {
      console.warn('Warning: Could not find extension ID from service workers');
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
