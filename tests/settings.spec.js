// tests/settings.spec.js
import { test, expect } from '@playwright/test';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';

test.describe('Settings and Configuration', () => {
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

  test('match threshold slider exists and works', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Wait for popup to load
    await page.waitForSelector('#matchThreshold');

    // Get initial value
    const initialValue = await page.inputValue('#matchThreshold');
    expect(parseFloat(initialValue)).toBe(0.6); // Default value

    // Change threshold
    await page.fill('#matchThreshold', '0.7');

    // Verify value changed
    const newValue = await page.inputValue('#matchThreshold');
    expect(parseFloat(newValue)).toBe(0.7);

    await page.close();
  });

  test('add person section is visible', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check add person section exists
    const addSection = await page.$('#addPersonSection');
    expect(addSection).toBeTruthy();

    // Check required fields
    const nameInput = await page.$('#personName');
    expect(nameInput).toBeTruthy();

    const photoInput = await page.$('#photoInput');
    expect(photoInput).toBeTruthy();

    const addButton = await page.$('#addPersonBtn');
    expect(addButton).toBeTruthy();

    await page.close();
  });

  test('stored people section exists', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check stored people section
    const storedSection = await page.$('#storedPeopleSection');
    expect(storedSection).toBeTruthy();

    const peopleList = await page.$('#peopleList');
    expect(peopleList).toBeTruthy();

    await page.close();
  });

  test('export/import/clear buttons exist', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check data management section
    const dataSection = await page.$('#dataManagementSection');
    expect(dataSection).toBeTruthy();

    // Check buttons
    const exportBtn = await page.$('#exportDataBtn');
    expect(exportBtn).toBeTruthy();

    const importBtn = await page.$('#importDataBtn');
    expect(importBtn).toBeTruthy();

    const clearBtn = await page.$('#clearAllDataBtn');
    expect(clearBtn).toBeTruthy();

    await page.close();
  });

  test('validation prevents adding person without name', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Try to add person without name
    const addButton = await page.$('#addPersonBtn');

    // Leave name empty and try to click
    await page.fill('#personName', '');

    // Click add button
    await addButton.click();

    // Should show error or prevent submission
    await page.waitForTimeout(500);

    // Check that no success message appeared (since validation should fail)
    const statusText = await page.textContent('#uploadStatus');
    expect(statusText).not.toContain('Success');

    await page.close();
  });

  test('models load in popup', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Wait for models to load
    await page.waitForTimeout(3000);

    // Check if face-api models loaded
    const modelsLoaded = await page.evaluate(() => {
      return typeof window.faceapi !== 'undefined';
    });

    expect(modelsLoaded).toBe(true);

    await page.close();
  });

  test('threshold display updates with slider', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Wait for popup to load
    await page.waitForSelector('#matchThreshold');

    // Find the threshold value display
    const thresholdValue = await page.$('#thresholdValue');
    expect(thresholdValue).toBeTruthy();

    // Get initial display value
    const initialDisplay = await page.textContent('#thresholdValue');
    expect(initialDisplay).toContain('0.60');

    // Change slider
    await page.fill('#matchThreshold', '0.75');

    // Check display updated
    const newDisplay = await page.textContent('#thresholdValue');
    expect(newDisplay).toContain('0.75');

    await page.close();
  });

  test('popup dimensions are reasonable', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check popup size
    const dimensions = await page.evaluate(() => {
      return {
        width: document.body.scrollWidth,
        height: document.body.scrollHeight
      };
    });

    // Popup should be reasonably sized
    expect(dimensions.width).toBeGreaterThan(300);
    expect(dimensions.width).toBeLessThan(800);
    expect(dimensions.height).toBeGreaterThan(200);

    await page.close();
  });
});
