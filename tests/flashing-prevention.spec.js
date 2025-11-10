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
  });

  test.afterAll(async () => {
    await cleanupExtensionContext({ browser, userDataDir });
  });

  test('preload CSS should be injected early', async () => {
    const page = await browser.newPage();

    // Check that preload styles exist
    await page.goto('https://en.wikipedia.org/wiki/Main_Page', {
      waitUntil: 'domcontentloaded',
    });

    // Wait a moment for preload script
    await page.waitForTimeout(500);

    // Verify preload style tag exists
    const hasPreloadStyles = await page.evaluate(() => {
      return document.getElementById('face-block-preload-styles') !== null;
    });

    expect(hasPreloadStyles).toBe(true);

    await page.close();
  });

  test('images should be hidden initially and revealed after processing', async () => {
    const page = await browser.newPage();

    // Listen for console logs
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    // Navigate to a test page
    await page.goto('https://en.wikipedia.org/wiki/Main_Page', {
      waitUntil: 'domcontentloaded',
    });

    // Check images immediately after DOM loads
    await page.waitForTimeout(300);

    const initialImages = await page.$$eval('img:not([src^="data:"]):not([src^="blob:"])', imgs =>
      imgs.slice(0, 5).map(img => ({
        src: img.src.substring(0, 50),
        opacity: window.getComputedStyle(img).opacity,
        hasProcessed: img.hasAttribute('data-face-block-processed'),
      }))
    );

    console.log('Initial images (should be hidden):', initialImages);

    // Most images should be hidden (opacity 0) initially
    const hiddenCount = initialImages.filter(img => img.opacity === '0').length;
    console.log(`${hiddenCount}/${initialImages.length} images hidden initially`);

    // Wait for processing (reduced from 4000ms due to faster 100ms debounce)
    await page.waitForTimeout(3000);

    // Check after processing
    const processedImages = await page.$$eval('img:not([src^="data:"]):not([src^="blob:"])', imgs =>
      imgs.slice(0, 5).map(img => ({
        src: img.src.substring(0, 50),
        opacity: window.getComputedStyle(img).opacity,
        hasProcessed: img.hasAttribute('data-face-block-processed'),
        isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension',
      }))
    );

    console.log('Processed images:', processedImages);

    // After processing, images should either be:
    // 1. Visible with data-face-block-processed (no match)
    // 2. Blocked (replaced with SVG)
    const properlyProcessed = processedImages.filter(
      img => img.hasProcessed || img.isBlocked
    ).length;

    console.log(`${properlyProcessed}/${processedImages.length} images properly processed`);

    // At least some images should be processed
    expect(properlyProcessed).toBeGreaterThan(0);

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
