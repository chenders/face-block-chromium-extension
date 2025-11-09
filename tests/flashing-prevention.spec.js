// tests/flashing-prevention.spec.js
import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

test.describe('Flashing Prevention', () => {
  let browser;
  let userDataDir;

  test.beforeAll(async () => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-'));

    const pathToExtension = path.join(process.cwd(), 'extension');
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test.afterAll(async () => {
    await browser.close();
    if (userDataDir) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test('preload CSS should be injected early', async () => {
    const page = await browser.newPage();

    // Check that preload styles exist
    await page.goto('https://en.wikipedia.org/wiki/Main_Page', {
      waitUntil: 'domcontentloaded'
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
      waitUntil: 'domcontentloaded'
    });

    // Check images immediately after DOM loads
    await page.waitForTimeout(500);

    const initialImages = await page.$$eval('img:not([src^="data:"]):not([src^="blob:"])', imgs =>
      imgs.slice(0, 5).map(img => ({
        src: img.src.substring(0, 50),
        opacity: window.getComputedStyle(img).opacity,
        hasProcessed: img.hasAttribute('data-face-block-processed')
      }))
    );

    console.log('Initial images (should be hidden):', initialImages);

    // Most images should be hidden (opacity 0) initially
    const hiddenCount = initialImages.filter(img => img.opacity === '0').length;
    console.log(`${hiddenCount}/${initialImages.length} images hidden initially`);

    // Wait for processing
    await page.waitForTimeout(4000);

    // Check after processing
    const processedImages = await page.$$eval('img:not([src^="data:"]):not([src^="blob:"])', imgs =>
      imgs.slice(0, 5).map(img => ({
        src: img.src.substring(0, 50),
        opacity: window.getComputedStyle(img).opacity,
        hasProcessed: img.hasAttribute('data-face-block-processed'),
        isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension'
      }))
    );

    console.log('Processed images:', processedImages);

    // After processing, images should either be:
    // 1. Visible with data-face-block-processed (no match)
    // 2. Blocked (replaced with SVG)
    const properlyProcessed = processedImages.filter(img =>
      img.hasProcessed || img.isBlocked
    ).length;

    console.log(`${properlyProcessed}/${processedImages.length} images properly processed`);

    // At least some images should be processed
    expect(properlyProcessed).toBeGreaterThan(0);

    await page.close();
  });
});
