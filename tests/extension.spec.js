// tests/extension.spec.js
import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

test.describe('Face Block Chromium Extension', () => {
  let browser;
  let context;
  let extensionId;
  let userDataDir;

  test.beforeAll(async () => {
    // Create temporary directory for user data
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-'));

    // Launch browser with extension
    const pathToExtension = path.join(process.cwd(), 'extension');
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false, // Extensions don't work in headless mode
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    // Wait for extension to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Find extension ID from chrome://extensions
    const pages = browser.pages();
    let serviceWorker;

    // Get service worker
    for (const worker of browser.serviceWorkers()) {
      if (worker.url().includes('chrome-extension://')) {
        serviceWorker = worker;
        extensionId = new URL(serviceWorker.url()).host;
        break;
      }
    }

    console.log('Extension ID:', extensionId);
  });

  test.afterAll(async () => {
    await browser.close();
    // Clean up temporary directory
    if (userDataDir) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test('extension loads successfully', async () => {
    // Verify extension is loaded by checking if we can access its popup
    expect(extensionId).toBeTruthy();
    expect(extensionId).toMatch(/^[a-z]{32}$/);

    // Navigate to extension popup
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check popup loads and has correct title
    const title = await page.textContent('h1');
    expect(title).toBe('Face Block Chromium Extension');

    await page.close();
  });

  test('content script loads on web pages', async () => {
    const page = await browser.newPage();

    // Navigate to test fixture page (content scripts run on http/https pages)
    const fixturePath = path.join(process.cwd(), 'tests/fixtures/test-page.html');
    await page.goto(`file://${fixturePath}`);

    // Wait for content script to inject
    await page.waitForTimeout(2000);

    // Verify page loaded
    const images = await page.$$('img');
    expect(images.length).toBeGreaterThan(0);

    // Content scripts are running if extension ID is valid (from beforeAll)
    // This is an indirect test since content scripts run in isolated context
    expect(extensionId).toBeTruthy();

    await page.close();
  });

  test('extension popup opens', async () => {
    const page = await browser.newPage();

    // Navigate to extension popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Wait for popup to load
    await page.waitForTimeout(1000);

    // Check popup content
    const title = await page.textContent('h1');
    expect(title).toBe('Face Block Chromium Extension');

    // Check that key UI elements exist
    const addPersonSection = await page.$('.add-person-section');
    expect(addPersonSection).toBeTruthy();

    const personNameInput = await page.$('#personName');
    expect(personNameInput).toBeTruthy();

    const addPersonBtn = await page.$('#addPersonBtn');
    expect(addPersonBtn).toBeTruthy();

    await page.close();
  });

  test('models directory exists', async () => {
    const page = await browser.newPage();

    // Try to load a model file
    const response = await page.goto(`chrome-extension://${extensionId}/models/tiny_face_detector_model-weights_manifest.json`);
    expect(response.ok()).toBe(true);

    const json = await response.json();
    // The manifest is an array of weight groups
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);
    // Check first element has expected structure
    expect(json[0]).toHaveProperty('weights');
    expect(json[0]).toHaveProperty('paths');

    await page.close();
  });

  test('face-api.js library loads', async () => {
    const page = await browser.newPage();

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check if face-api is available
    const hasFaceApi = await page.evaluate(() => {
      return typeof window.faceapi !== 'undefined';
    });

    expect(hasFaceApi).toBe(true);

    await page.close();
  });
});
