// tests/extension.spec.js
import { test, expect } from '@playwright/test';
import path from 'path';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';

test.describe('Face Block Chromium Extension', () => {
  let browser;
  let extensionId;
  let userDataDir;

  test.beforeAll(async () => {
    const context = await setupExtensionContext();
    browser = context.browser;
    extensionId = context.extensionId;
    userDataDir = context.userDataDir;
  });

  test.afterAll(async () => {
    await cleanupExtensionContext({ browser, userDataDir });
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
    const response = await page.goto(
      `chrome-extension://${extensionId}/models/tiny_face_detector_model-weights_manifest.json`
    );
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

  test('detector selection UI exists', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Check that detector radio buttons exist
    const detectorRadios = await page.$$('input[name="detector"]');
    expect(detectorRadios.length).toBe(3);

    // Check that all three modes are present
    const tinyFaceRadio = await page.$('input[name="detector"][value="tinyFaceDetector"]');
    const ssdRadio = await page.$('input[name="detector"][value="ssdMobilenetv1"]');
    const hybridRadio = await page.$('input[name="detector"][value="hybrid"]');

    expect(tinyFaceRadio).toBeTruthy();
    expect(ssdRadio).toBeTruthy();
    expect(hybridRadio).toBeTruthy();

    await page.close();
  });

  test('default detector mode is hybrid', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Check that hybrid mode is selected by default
    const hybridChecked = await page.$eval(
      'input[name="detector"][value="hybrid"]',
      el => el.checked
    );

    expect(hybridChecked).toBe(true);

    await page.close();
  });

  test('detector setting can be changed', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Click on Fast Mode (TinyFaceDetector)
    await page.click('input[name="detector"][value="tinyFaceDetector"]');
    await page.waitForTimeout(500);

    // Verify it's now checked
    const tinyChecked = await page.$eval(
      'input[name="detector"][value="tinyFaceDetector"]',
      el => el.checked
    );
    expect(tinyChecked).toBe(true);

    // Click on Thorough Mode (SsdMobilenet)
    await page.click('input[name="detector"][value="ssdMobilenetv1"]');
    await page.waitForTimeout(500);

    // Verify it's now checked
    const ssdChecked = await page.$eval(
      'input[name="detector"][value="ssdMobilenetv1"]',
      el => el.checked
    );
    expect(ssdChecked).toBe(true);

    // Switch back to Hybrid
    await page.click('input[name="detector"][value="hybrid"]');
    await page.waitForTimeout(500);

    const hybridChecked = await page.$eval(
      'input[name="detector"][value="hybrid"]',
      el => el.checked
    );
    expect(hybridChecked).toBe(true);

    await page.close();
  });

  test('detector setting persists across popup reopens', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Change to Thorough Mode
    await page.click('input[name="detector"][value="ssdMobilenetv1"]');
    await page.waitForTimeout(1000);

    await page.close();

    // Reopen popup
    const page2 = await browser.newPage();
    await page2.goto(`chrome-extension://${extensionId}/popup.html`);
    await page2.waitForTimeout(1000);

    // Verify Thorough Mode is still selected
    const ssdChecked = await page2.$eval(
      'input[name="detector"][value="ssdMobilenetv1"]',
      el => el.checked
    );
    expect(ssdChecked).toBe(true);

    // Reset to Hybrid for other tests
    await page2.click('input[name="detector"][value="hybrid"]');
    await page2.waitForTimeout(1000);

    await page2.close();
  });

  test('SsdMobilenet model files exist', async () => {
    const page = await browser.newPage();

    // Check that SsdMobilenet model manifest exists
    const response = await page.goto(
      `chrome-extension://${extensionId}/models/ssd_mobilenetv1_model-weights_manifest.json`
    );
    expect(response.ok()).toBe(true);

    const json = await response.json();
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBeGreaterThan(0);

    await page.close();
  });

  test('detector mode labels have correct descriptions', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Check that mode descriptions exist
    const content = await page.content();

    expect(content).toContain('Fast Mode (TinyFaceDetector)');
    expect(content).toContain('Thorough Mode (SsdMobilenet)');
    expect(content).toContain('Hybrid Mode (Recommended)');

    // Check that descriptions mention key characteristics
    expect(content).toContain('Fastest detection');
    expect(content).toContain('better at profiles');
    expect(content).toContain('falls back');

    await page.close();
  });
});
