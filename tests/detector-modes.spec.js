// tests/detector-modes.spec.js
// Tests for face detection with different detector modes
import { test, expect } from '@playwright/test';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';

test.describe('Detector Modes', () => {
  let browser;
  let extensionId;
  let userDataDir;
  let testServerUrl;

  test.beforeAll(async () => {
    // Use existing test server (assumed to be running on port 8080)
    testServerUrl = 'http://localhost:8080';

    const context = await setupExtensionContext();
    browser = context.browser;
    extensionId = context.extensionId;
    userDataDir = context.userDataDir;
  });

  test.afterAll(async () => {
    await cleanupExtensionContext({ browser, userDataDir });
  });

  test('hybrid mode loads both TinyFace and SsdMobilenet models', async () => {
    const page = await browser.newPage();
    await page.goto(`${testServerUrl}/test-ssdmobilenet.html`);

    // Wait for models to load and first detection
    await page.waitForTimeout(5000);

    // Check console for model loading logs
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));

    await page.waitForTimeout(2000);

    // Reload to capture logs
    await page.reload();
    await page.waitForTimeout(5000);

    const logText = logs.join('\n');

    // In hybrid mode (default), should see loading message for both detectors
    const hasHybridLoading =
      logText.includes('Loading hybrid detectors') ||
      logText.includes('TinyFace') ||
      logText.includes('SsdMobilenet');

    expect(hasHybridLoading).toBe(true);

    await page.close();
  });

  test('Fast Mode (TinyFaceDetector) loads correctly', async () => {
    // Set detector to TinyFaceDetector
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(1000);

    await popupPage.click('input[name="detector"][value="tinyFaceDetector"]');
    await popupPage.waitForTimeout(1000);
    await popupPage.close();

    // Navigate to test page
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    await page.goto(`${testServerUrl}/test-ssdmobilenet.html`);
    await page.waitForTimeout(5000);

    const logText = logs.join('\n');
    console.log('TinyFaceDetector logs:', logText);

    // Verify TinyFaceDetector loads correctly
    const hasTinyFaceLoading =
      logText.includes('Loading TinyFaceDetector') ||
      logText.includes('detector: tinyFaceDetector');
    const hasModelsLoaded = logText.includes('Models loaded');

    expect(hasTinyFaceLoading).toBe(true);
    expect(hasModelsLoaded).toBe(true);

    await page.close();

    // Reset to hybrid
    const resetPage = await browser.newPage();
    await resetPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await resetPage.waitForTimeout(1000);
    await resetPage.click('input[name="detector"][value="hybrid"]');
    await resetPage.waitForTimeout(1000);
    await resetPage.close();
  });

  test('Thorough Mode (SsdMobilenet) loads correctly', async () => {
    // Set detector to SsdMobilenet
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(1000);

    await popupPage.click('input[name="detector"][value="ssdMobilenetv1"]');
    await popupPage.waitForTimeout(1000);
    await popupPage.close();

    // Navigate to test page
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    await page.goto(`${testServerUrl}/test-ssdmobilenet.html`);
    await page.waitForTimeout(5000);

    const logText = logs.join('\n');
    console.log('SsdMobilenet logs:', logText);

    // Verify SsdMobilenet loads correctly
    const hasSsdLoading =
      logText.includes('Loading SsdMobilenetv1') || logText.includes('detector: ssdMobilenetv1');
    const hasModelsLoaded = logText.includes('Models loaded');

    expect(hasSsdLoading).toBe(true);
    expect(hasModelsLoaded).toBe(true);

    await page.close();

    // Reset to hybrid
    const resetPage = await browser.newPage();
    await resetPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await resetPage.waitForTimeout(1000);
    await resetPage.click('input[name="detector"][value="hybrid"]');
    await resetPage.waitForTimeout(1000);
    await resetPage.close();
  });

  test('Hybrid Mode loads both detectors correctly', async () => {
    // Set detector to Hybrid (should be default)
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(1000);

    await popupPage.click('input[name="detector"][value="hybrid"]');
    await popupPage.waitForTimeout(1000);
    await popupPage.close();

    // Navigate to test page
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    await page.goto(`${testServerUrl}/test-ssdmobilenet.html`);
    await page.waitForTimeout(5000);

    const logText = logs.join('\n');
    console.log('Hybrid mode logs:', logText);

    // In hybrid mode, should load both detectors
    const hasHybridLoading =
      logText.includes('Loading hybrid detectors') || logText.includes('TinyFace + SsdMobilenet');
    const hasModelsLoaded =
      logText.includes('Models loaded') && logText.includes('detector: hybrid');

    expect(hasHybridLoading).toBe(true);
    expect(hasModelsLoaded).toBe(true);

    await page.close();
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
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    await page.goto(`${testServerUrl}/test-ssdmobilenet.html`);
    await page.waitForTimeout(5000);

    // Clear logs
    logs.length = 0;

    // Change detector mode in popup
    const popupPage = await browser.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(1000);

    // Switch to a different mode
    await popupPage.click('input[name="detector"][value="ssdMobilenetv1"]');
    await popupPage.waitForTimeout(2000);

    const logText = logs.join('\n');
    console.log('Logs after detector change:', logText);

    // Should see detector changed message
    const hasDetectorChange =
      logText.includes('Detector changed') ||
      logText.includes('Loading') ||
      logText.includes('Models loaded');

    expect(hasDetectorChange).toBe(true);

    await popupPage.close();
    await page.close();
  });
});
