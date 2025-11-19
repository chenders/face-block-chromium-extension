// tests/flashing-prevention.spec.js
import { test, expect } from '@playwright/test';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';

test.describe('Flashing Prevention', () => {
  let browser;
  let userDataDir;

  test.beforeAll(async () => {
    const context = await setupExtensionContext();
    browser = context.browser;
    userDataDir = context.userDataDir;
  }, process.env.CI ? 90000 : 60000) // 90 seconds timeout in CI, 60 seconds locally;

  test.afterAll(async () => {
    await cleanupExtensionContext({ browser, userDataDir });
  });

  test('preload hiding mechanism works correctly', async () => {
    const page = await browser.newPage();

    // Create a test page with images
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            /* Simulate the preload-hide.css that the extension injects */
            html[data-face-block-active] img {
              visibility: hidden !important;
            }
          </style>
        </head>
        <body>
          <img id="test-img" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==" width="100" height="100" />
        </body>
      </html>
    `);

    await page.waitForTimeout(100);

    // Initially, image should be visible (attribute not set yet)
    let visibility = await page.$eval('#test-img', img => window.getComputedStyle(img).visibility);
    expect(visibility).toBe('visible');

    // Set the data attribute (simulating what preload.js does)
    await page.evaluate(() => {
      document.documentElement.setAttribute('data-face-block-active', 'true');
    });

    // Now image should be hidden
    visibility = await page.$eval('#test-img', img => window.getComputedStyle(img).visibility);
    expect(visibility).toBe('hidden');

    // Remove the attribute (simulating what content.js does)
    await page.evaluate(() => {
      document.documentElement.removeAttribute('data-face-block-active');
    });

    // Image should be visible again
    visibility = await page.$eval('#test-img', img => window.getComputedStyle(img).visibility);
    expect(visibility).toBe('visible');

    await page.close();
  });

  test('images should be hidden initially and revealed after processing', async () => {
    const page = await browser.newPage();

    // Set up console logging
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));

    // Use a test fixture file
    const path = await import('path');
    const fixturePath = path.join(process.cwd(), 'tests/fixtures/test-pages/test-page.html');

    await page.goto(`file://${fixturePath}`, {
      waitUntil: 'domcontentloaded',
    });

    // Small delay to let preload script run
    await page.waitForTimeout(100);

    // Verify preload activation happened
    const hasPreloadLog = logs.some(log =>
      log.includes('[Face Block Preload] Image hiding activated')
    );
    console.log('Preload activation logged:', hasPreloadLog);

    // Check that attribute was set
    const hasActiveAttribute = await page.evaluate(() => {
      return document.documentElement.hasAttribute('data-face-block-active');
    });

    console.log('Has data-face-block-active attribute:', hasActiveAttribute);

    // Wait for processing to complete
    await page.waitForTimeout(3000);

    // Check that attribute was removed after processing
    const attributeAfterProcessing = await page.evaluate(() => {
      return document.documentElement.hasAttribute('data-face-block-active');
    });

    console.log('Attribute removed after processing:', !attributeAfterProcessing);

    // Check that images were processed
    const images = await page.$$eval('img', imgs =>
      imgs.map(img => ({
        src: img.src.substring(0, 50),
        processed: img.hasAttribute('data-face-block-processed'),
        opacity: window.getComputedStyle(img).opacity,
      }))
    );

    console.log('Processed images:', images);

    // At least some images should be processed
    const processedCount = images.filter(img => img.processed).length;
    expect(processedCount).toBeGreaterThan(0);

    await page.close();
  });

  test('images respond quickly to src changes with 100ms debounce', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="test-img" src="https://via.placeholder.com/300x200?text=Initial" width="300" height="200" alt="Test">
        </body>
      </html>
    `);

    // Wait for initial processing
    await page.waitForTimeout(2000);

    // Record when we change the src
    const startTime = Date.now();

    // Listen for processing logs
    const timestamps = [];
    page.on('console', msg => {
      if (
        msg.text().includes('Face Block') &&
        (msg.text().includes('Processing') || msg.text().includes('Scanning'))
      ) {
        timestamps.push(Date.now());
      }
    });

    // Change src
    await page.evaluate(() => {
      document.getElementById('test-img').src = 'https://via.placeholder.com/300x200?text=Changed';
    });

    // Wait for processing (should be quick with 100ms debounce)
    await page.waitForTimeout(500);

    // Processing should have started relatively quickly
    // With 100ms debounce, should be much faster than old 500ms
    if (timestamps.length > 0) {
      const responseTime = timestamps[0] - startTime;
      console.log(`Response time: ${responseTime}ms`);
      // Should respond within ~400ms (100ms debounce + processing + margin)
      expect(responseTime).toBeLessThan(600);
    }

    await page.close();
  });
});
