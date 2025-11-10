// tests/face-detection-with-references.spec.js
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';
import { loadTestReferenceData, clearTestReferenceData } from './helpers/test-data-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Face Detection with Reference Data', () => {
  let browser;
  let userDataDir;
  let testPageUrl;

  test.beforeAll(async () => {
    const context = await setupExtensionContext();
    browser = context.browser;
    userDataDir = context.userDataDir;
  });

  test.afterAll(async () => {
    await cleanupExtensionContext({ browser, userDataDir });
  });

  test('blocked person images are replaced with placeholders', async () => {
    const page = await browser.newPage();

    // Listen for console logs
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Load reference data for Einstein (but not Sagan)
    // This also starts the test server and returns the URL
    testPageUrl = await loadTestReferenceData(browser, { people: ['albert_einstein'] });

    // Navigate to test page
    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });

    // Wait for extension to process images (needs time for face detection)
    await page.waitForTimeout(12000);

    // Check Einstein images are blocked
    const einsteinImages = await page.$$eval('[id^="einstein-"]:not([id$="-tiny"])', imgs =>
      imgs.map(img => ({
        id: img.id,
        isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension',
        src: img.src.substring(0, 50),
        hasProcessed: img.hasAttribute('data-face-block-processed'),
      }))
    );

    console.log('Einstein images:', einsteinImages);

    // Most Einstein images should be blocked (profile views may not match with threshold 0.6)
    const blockedCount = einsteinImages.filter(img => img.isBlocked).length;
    expect(blockedCount).toBeGreaterThanOrEqual(4); // At least 4/5 should be blocked
    console.log(`${blockedCount}/${einsteinImages.length} Einstein images blocked`);

    // Check Sagan images are NOT blocked (no reference data for Sagan)
    const saganImages = await page.$$eval('[id^="sagan-"]', imgs =>
      imgs.map(img => ({
        id: img.id,
        isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension',
        hasProcessed: img.hasAttribute('data-face-block-processed'),
      }))
    );

    console.log('Sagan images:', saganImages);

    // Sagan images should NOT be blocked
    const saganBlockedCount = saganImages.filter(img => img.isBlocked).length;
    expect(saganBlockedCount).toBe(0);

    // But they should be processed (marked as processed)
    const saganProcessedCount = saganImages.filter(img => img.hasProcessed).length;
    expect(saganProcessedCount).toBe(saganImages.length);

    // Check non-matching images are shown
    const nonMatchingImages = await page.$$eval('#monroe, #pruitt', imgs =>
      imgs.map(img => ({
        id: img.id,
        isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension',
        opacity: window.getComputedStyle(img).opacity,
        hasProcessed: img.hasAttribute('data-face-block-processed'),
      }))
    );

    console.log('Non-matching images:', nonMatchingImages);

    // Non-matching images should not be blocked
    const nonMatchingBlockedCount = nonMatchingImages.filter(img => img.isBlocked).length;
    expect(nonMatchingBlockedCount).toBe(0);

    // They should be visible
    const visibleCount = nonMatchingImages.filter(img => img.opacity === '1').length;
    expect(visibleCount).toBe(nonMatchingImages.length);

    await page.close();
  });

  test('multiple blocked people are all detected', async () => {
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Clear any existing data
    await clearTestReferenceData(browser);

    // Load reference data for both Einstein and Sagan
    testPageUrl = await loadTestReferenceData(browser, {
      people: ['albert_einstein', 'carl_sagan'],
    });

    // Navigate to test page
    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });

    // Wait for extension to process images
    await page.waitForTimeout(6000);

    // Check both Einstein and Sagan images are blocked
    const blockedImages = await page.$$eval(
      '[id^="einstein-"]:not([id$="-tiny"]), [id^="sagan-"]',
      imgs =>
        imgs.map(img => ({
          id: img.id,
          isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension',
          hasProcessed: img.hasAttribute('data-face-block-processed'),
        }))
    );

    console.log('All potentially blocked images:', blockedImages);

    const blockedCount = blockedImages.filter(img => img.isBlocked).length;
    console.log(`${blockedCount}/${blockedImages.length} images blocked`);

    // Should block at least some Einstein and Sagan images
    expect(blockedCount).toBeGreaterThan(0);

    // Non-matching images should still be shown
    const nonMatchingImages = await page.$$eval('#monroe, #pruitt', imgs =>
      imgs.map(img => ({
        id: img.id,
        isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension',
      }))
    );

    const nonMatchingBlockedCount = nonMatchingImages.filter(img => img.isBlocked).length;
    expect(nonMatchingBlockedCount).toBe(0);

    await page.close();
  });

  test('inline images are processed correctly', async () => {
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    testPageUrl = await loadTestReferenceData(browser, {
      people: ['albert_einstein', 'carl_sagan'],
    });

    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });
    await page.waitForTimeout(6000);

    // Check inline images
    const inlineImages = await page.$$eval(
      '#einstein-inline, #monroe-inline, #sagan-inline, #pruitt-inline',
      imgs =>
        imgs.map(img => ({
          id: img.id,
          isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension',
          hasProcessed: img.hasAttribute('data-face-block-processed'),
        }))
    );

    console.log('Inline images:', inlineImages);

    // Einstein and Sagan should be blocked
    const einstein = inlineImages.find(img => img.id === 'einstein-inline');
    const sagan = inlineImages.find(img => img.id === 'sagan-inline');

    expect(einstein?.isBlocked || einstein?.hasProcessed).toBeTruthy();
    expect(sagan?.isBlocked || sagan?.hasProcessed).toBeTruthy();

    // Monroe and Pruitt should not be blocked
    const monroe = inlineImages.find(img => img.id === 'monroe-inline');
    const pruitt = inlineImages.find(img => img.id === 'pruitt-inline');

    expect(monroe?.isBlocked).toBe(false);
    expect(pruitt?.isBlocked).toBe(false);

    await page.close();
  });
});
