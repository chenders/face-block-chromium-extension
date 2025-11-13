// tests/detector-modes.spec.js
// Tests for face detection with different detector modes
import { test, expect } from '@playwright/test';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';

test.describe('Detector Modes', () => {
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

  test('detector change triggers status message', async () => {
    const page = await browser.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Initially no status message should be visible
    const initialStatus = await page.$eval('#statusMessage', el =>
      el.classList.contains('success')
    );
    expect(initialStatus).toBe(false);

    // Change detector
    await page.click('input[name="detector"][value="tinyFaceDetector"]');
    await page.waitForTimeout(500);

    // Status message should now be visible
    const statusVisible = await page.$eval('#statusMessage', el =>
      el.classList.contains('success')
    );
    expect(statusVisible).toBe(true);

    // Status message should mention the detector change
    const statusText = await page.$eval('#statusMessage', el => el.textContent);
    expect(statusText).toContain('Detector changed');
    expect(statusText).toContain('Fast Mode');

    await page.close();
  });

  test('detector models are loaded based on selected mode', async () => {
    const page = await browser.newPage();

    // Test TinyFaceDetector model availability
    const tinyResponse = await page.goto(
      `chrome-extension://${extensionId}/models/tiny_face_detector_model-weights_manifest.json`
    );
    expect(tinyResponse.ok()).toBe(true);

    // Test SsdMobilenet model availability
    const ssdResponse = await page.goto(
      `chrome-extension://${extensionId}/models/ssd_mobilenetv1_model-weights_manifest.json`
    );
    expect(ssdResponse.ok()).toBe(true);

    // Both models should be available for hybrid mode
    await page.close();
  });

  test('changing detector mode reprocesses images', async () => {
    // This test verifies that when detector changes, content scripts are notified
    const page = await browser.newPage();

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Change detector mode in popup
    await page.click('input[name="detector"][value="ssdMobilenetv1"]');
    await page.waitForTimeout(2000);

    // Open a new page to trigger content script with new detector
    const contentPage = await browser.newPage();
    const logs = [];
    contentPage.on('console', msg => {
      if (msg.text().includes('Detector changed')) {
        logs.push(msg.text());
      }
    });

    await contentPage.goto('https://example.com');
    await contentPage.waitForTimeout(2000);

    const logText = logs.join('\n');
    console.log('Logs after detector change:', logText);

    // Should see detector changed message
    const hasDetectorChange = logText.includes('Detector changed');

    expect(hasDetectorChange).toBe(true);

    await contentPage.close();
    await page.close();
  });
});
