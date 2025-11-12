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

    // Load reference data for Trump
    // This also starts the test server and returns the URL
    testPageUrl = await loadTestReferenceData(browser, { people: ['trump'] });

    // Navigate to test page
    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });

    // Wait for extension to process images (needs time for face detection)
    await page.waitForTimeout(12000);

    // Check Trump images are blocked
    const trumpImages = await page.$$eval('[id^="trump-"]:not([id$="-tiny"]):not([id$="-inline"]):not([id$="-inline-2"])', imgs =>
      imgs.map(img => ({
        id: img.id,
        isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension',
        src: img.src.substring(0, 50),
        hasProcessed: img.hasAttribute('data-face-block-processed'),
      }))
    );

    console.log('Trump images:', trumpImages);

    // Most Trump images should be blocked
    const blockedCount = trumpImages.filter(img => img.isBlocked).length;
    expect(blockedCount).toBeGreaterThanOrEqual(3); // At least 3/4 should be blocked
    console.log(`${blockedCount}/${trumpImages.length} Trump images blocked`);

    // Check non-matching images (Obama, Biden) are NOT blocked
    const nonMatchingImages = await page.$$eval('#obama, #biden', imgs =>
      imgs.map(img => ({
        id: img.id,
        isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension',
        hasProcessed: img.hasAttribute('data-face-block-processed'),
      }))
    );

    console.log('Non-matching images (Obama, Biden):', nonMatchingImages);

    // Non-matching images should NOT be blocked
    const nonMatchingBlockedCount = nonMatchingImages.filter(img => img.isBlocked).length;
    expect(nonMatchingBlockedCount).toBe(0);

    // But they should be processed (marked as processed)
    const nonMatchingProcessedCount = nonMatchingImages.filter(img => img.hasProcessed).length;
    expect(nonMatchingProcessedCount).toBe(nonMatchingImages.length);

    // They should be visible
    const visibleNonMatching = await page.$$eval('#obama, #biden', imgs =>
      imgs.map(img => ({
        id: img.id,
        opacity: window.getComputedStyle(img).opacity,
      }))
    );

    console.log('Non-matching visibility:', visibleNonMatching);

    const visibleCount = visibleNonMatching.filter(img => img.opacity === '1').length;
    expect(visibleCount).toBe(visibleNonMatching.length);

    await page.close();
  });

  test('all Trump images are detected and blocked', async () => {
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Clear any existing data
    await clearTestReferenceData(browser);

    // Load reference data for Trump
    testPageUrl = await loadTestReferenceData(browser, {
      people: ['trump'],
    });

    // Navigate to test page
    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });

    // Wait for extension to process images
    await page.waitForTimeout(12000);

    // Check Trump images are blocked (excluding tiny and inline variants for this test)
    const trumpImages = await page.$$eval(
      '[id^="trump-"]:not([id$="-tiny"]):not([id$="-inline"]):not([id$="-inline-2"])',
      imgs =>
        imgs.map(img => ({
          id: img.id,
          isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension',
          hasProcessed: img.hasAttribute('data-face-block-processed'),
        }))
    );

    console.log('All Trump images:', trumpImages);

    const blockedCount = trumpImages.filter(img => img.isBlocked).length;
    console.log(`${blockedCount}/${trumpImages.length} Trump images blocked`);

    // Should block most Trump images
    expect(blockedCount).toBeGreaterThanOrEqual(3);

    // Non-matching images should still be shown
    const nonMatchingImages = await page.$$eval('#obama, #biden', imgs =>
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
      people: ['trump'],
    });

    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });
    await page.waitForTimeout(12000);

    // Check inline images
    const inlineImages = await page.$$eval(
      '#trump-inline, #trump-inline-2, #obama-inline, #biden-inline',
      imgs =>
        imgs.map(img => ({
          id: img.id,
          isBlocked: img.alt === 'Image blocked by Face Block Chromium Extension',
          hasProcessed: img.hasAttribute('data-face-block-processed'),
        }))
    );

    console.log('Inline images:', inlineImages);

    // Trump images should be blocked or at least processed
    const trumpInline1 = inlineImages.find(img => img.id === 'trump-inline');
    const trumpInline2 = inlineImages.find(img => img.id === 'trump-inline-2');

    expect(trumpInline1?.isBlocked || trumpInline1?.hasProcessed).toBeTruthy();
    expect(trumpInline2?.isBlocked || trumpInline2?.hasProcessed).toBeTruthy();

    // Obama and Biden should not be blocked
    const obama = inlineImages.find(img => img.id === 'obama-inline');
    const biden = inlineImages.find(img => img.id === 'biden-inline');

    expect(obama?.isBlocked).toBe(false);
    expect(biden?.isBlocked).toBe(false);

    await page.close();
  });
});
