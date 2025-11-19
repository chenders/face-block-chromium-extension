/**
 * Block Indicator Tests
 *
 * These tests verify that:
 * 1. Blocked images have a visual indicator (red icon)
 * 2. Blocked images have correct data attributes
 * 3. Tooltip shows on hover with person's name
 * 4. Clicking blocked images unblocks them
 * 5. Unblocked images persist and are not re-blocked
 */

import { test, expect } from '@playwright/test';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';
import { loadTestReferenceData, clearTestReferenceData } from './helpers/test-data-loader.js';

test.describe('Block Indicator Feature', () => {
  let browser;
  let userDataDir;
  let testPageUrl;

  test.beforeAll(
    async () => {
      const context = await setupExtensionContext();
      browser = context.browser;
      userDataDir = context.userDataDir;
    },
    process.env.CI ? 90000 : 60000
  ); // 90 seconds timeout in CI, 60 seconds locally

  test.afterAll(async () => {
    await cleanupExtensionContext({ browser, userDataDir });
  });

  test('blocked images have face-blocked class and correct attributes', async () => {
    // Skip if running in CI with potentially incomplete image download
    // This test requires ~20 reference images for reliable face matching
    const fs = await import('fs');
    const path = await import('path');
    const trumpSourceDir = path.join(process.cwd(), 'tests/fixtures/test-data/trump/source');
    const imageCount = fs.existsSync(trumpSourceDir)
      ? fs.readdirSync(trumpSourceDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png')).length
      : 0;

    test.skip(
      imageCount < 15,
      `Insufficient reference images (${imageCount} < 15), likely incomplete download in CI`
    );

    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Load reference data for Trump
    testPageUrl = await loadTestReferenceData(browser, { people: ['trump'] });

    // Navigate to test page
    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });
    await page.waitForTimeout(12000); // Wait for face detection

    // Check blocked Trump images have correct class and attributes
    const trumpImages = await page.$$eval(
      '[id^="trump-"]:not([id$="-tiny"]):not([id$="-inline"]):not([id$="-inline-2"])',
      imgs =>
        imgs.map(img => ({
          id: img.id,
          hasBlockedClass: img.classList.contains('face-blocked'),
          blockedPerson: img.dataset.blockedPerson,
          blockedDistance: img.dataset.blockedDistance,
          hasOriginalSrc: !!img.dataset.originalSrc,
          alt: img.alt,
        }))
    );

    console.log('Trump images with block indicators:', trumpImages);

    // Filter images that are actually blocked
    const blockedImages = trumpImages.filter(img =>
      img.alt.includes('Image blocked by Face Block')
    );
    expect(blockedImages.length).toBeGreaterThan(0);

    // Verify blocked images have correct attributes
    for (const img of blockedImages) {
      expect(img.hasBlockedClass).toBe(true);
      expect(img.blockedPerson).toBe('Donald Trump');
      expect(img.blockedDistance).toBeTruthy();
      expect(img.hasOriginalSrc).toBe(true);
    }

    await page.close();
  });

  test('blocked images display red icon indicator in SVG', async () => {
    // Skip if insufficient reference images
    const fs = await import('fs');
    const path = await import('path');
    const trumpSourceDir = path.join(process.cwd(), 'tests/fixtures/test-data/trump/source');
    const imageCount = fs.existsSync(trumpSourceDir)
      ? fs.readdirSync(trumpSourceDir).filter(f => f.endsWith('.jpg') || f.endsWith('.png')).length
      : 0;

    test.skip(
      imageCount < 15,
      `Insufficient reference images (${imageCount} < 15), likely incomplete download in CI`
    );

    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    testPageUrl = await loadTestReferenceData(browser, { people: ['trump'] });
    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });
    await page.waitForTimeout(12000);

    // Check if blocked images have SVG data URL with red icon
    const blockedImageInfo = await page.$$eval('img.face-blocked', imgs =>
      imgs.map(img => ({
        id: img.id,
        src: img.src.substring(0, 100),
        hasSvg: img.src.startsWith('data:image/svg+xml'),
        // Check for circle element (red icon) and red color in SVG
        hasRedIcon: img.src.includes('circle') && img.src.includes('220,38,38'),
      }))
    );

    console.log('Blocked images with SVG indicators:', blockedImageInfo);

    // Verify at least one blocked image exists
    expect(blockedImageInfo.length).toBeGreaterThan(0);

    // Verify all blocked images have SVG with red icon
    for (const info of blockedImageInfo) {
      expect(info.hasSvg).toBe(true);
      expect(info.hasRedIcon).toBe(true);
    }

    await page.close();
  });

  test('clicking blocked image unblocks it', async () => {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    testPageUrl = await loadTestReferenceData(browser, { people: ['trump'] });
    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });

    // Increase wait time for CI environments
    const waitTime = process.env.CI ? 20000 : 12000;
    await page.waitForTimeout(waitTime);

    // Wait for blocked images to appear with retry
    let blockedImageId;
    for (let i = 0; i < 3; i++) {
      try {
        blockedImageId = await page.$eval('img.face-blocked', img => img.id);
        if (blockedImageId) break;
      } catch (e) {
        console.log(`Attempt ${i + 1}: No blocked images found yet, waiting...`);
        await page.waitForTimeout(3000);
      }
    }

    if (!blockedImageId) {
      // Log page state for debugging
      const imageCount = await page.$$eval('img', imgs => imgs.length);
      const blockedCount = await page.$$eval('img.face-blocked', imgs => imgs.length);
      console.log(`Found ${imageCount} images, ${blockedCount} blocked`);
      throw new Error('No blocked images found after waiting');
    }

    // Get image info before unblocking
    const beforeUnblock = await page.$eval(`#${blockedImageId}`, img => ({
      id: img.id,
      isBlocked: img.classList.contains('face-blocked'),
      originalSrc: img.dataset.originalSrc,
      currentSrc: img.src.substring(0, 30),
      hasSvgSrc: img.src.startsWith('data:image/svg+xml'),
    }));

    console.log('Before unblock:', beforeUnblock);
    expect(beforeUnblock.isBlocked).toBe(true);
    expect(beforeUnblock.originalSrc).toBeTruthy();
    expect(beforeUnblock.hasSvgSrc).toBe(true);

    // Click to unblock with better error handling
    await page.click(`#${blockedImageId}`);

    // Wait longer in CI for the unblock to process
    const clickWaitTime = process.env.CI ? 2000 : 500;
    await page.waitForTimeout(clickWaitTime);

    // Get image info after unblocking
    const afterUnblock = await page.$eval(`#${blockedImageId}`, img => ({
      id: img.id,
      isBlocked: img.classList.contains('face-blocked'),
      originalSrc: img.dataset.originalSrc,
      currentSrc: img.src.substring(0, 30),
      manuallyUnblocked: img.dataset.manuallyUnblocked,
      hasSvgSrc: img.src.startsWith('data:image/svg+xml'),
    }));

    console.log('After unblock:', afterUnblock);

    // Verify image is unblocked
    expect(afterUnblock.isBlocked).toBe(false);
    expect(afterUnblock.manuallyUnblocked).toBe('true');
    expect(afterUnblock.hasSvgSrc).toBe(false); // Should be restored to original
    expect(afterUnblock.originalSrc).toBeUndefined();

    await page.close();
  });

  test('unblocked images are not re-blocked during session', async () => {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    testPageUrl = await loadTestReferenceData(browser, { people: ['trump'] });
    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });
    await page.waitForTimeout(12000);

    // Find and click first blocked image
    const blockedImageId = await page.$eval('img.face-blocked', img => img.id);
    await page.click(`#${blockedImageId}`);
    await page.waitForTimeout(500);

    // Verify it's unblocked
    const afterUnblock = await page.$eval(`#${blockedImageId}`, img => ({
      isBlocked: img.classList.contains('face-blocked'),
      manuallyUnblocked: img.dataset.manuallyUnblocked,
    }));

    expect(afterUnblock.isBlocked).toBe(false);
    expect(afterUnblock.manuallyUnblocked).toBe('true');

    // Wait to allow any re-processing to occur
    await page.waitForTimeout(3000);

    // Verify it's still unblocked
    const stillUnblocked = await page.$eval(`#${blockedImageId}`, img => ({
      isBlocked: img.classList.contains('face-blocked'),
      manuallyUnblocked: img.dataset.manuallyUnblocked,
      hasSvgSrc: img.src.startsWith('data:image/svg+xml'),
    }));

    console.log('After waiting 3s:', stillUnblocked);
    expect(stillUnblocked.isBlocked).toBe(false);
    expect(stillUnblocked.manuallyUnblocked).toBe('true');
    expect(stillUnblocked.hasSvgSrc).toBe(false); // Should still be original image

    await page.close();
  });

  test('tooltip attributes are set correctly', async () => {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    testPageUrl = await loadTestReferenceData(browser, { people: ['trump'] });
    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });
    await page.waitForTimeout(12000);

    // Get data-blocked-person attributes from all blocked images
    const blockedPersonNames = await page.$$eval('img.face-blocked', imgs =>
      imgs.map(img => img.dataset.blockedPerson)
    );

    console.log('Blocked person names:', blockedPersonNames);
    expect(blockedPersonNames.length).toBeGreaterThan(0);

    // All should be "Donald Trump"
    for (const name of blockedPersonNames) {
      expect(name).toBe('Donald Trump');
    }

    await page.close();
  });

  test('multiple images can be unblocked independently', async () => {
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    testPageUrl = await loadTestReferenceData(browser, { people: ['trump'] });
    await page.goto(testPageUrl + '/test-page.html', { waitUntil: 'load' });
    await page.waitForTimeout(12000);

    // Get all blocked image IDs
    const blockedImageIds = await page.$$eval('img.face-blocked', imgs => imgs.map(img => img.id));
    console.log(`Found ${blockedImageIds.length} blocked images`);

    expect(blockedImageIds.length).toBeGreaterThanOrEqual(2);

    // Unblock first two images
    const idsToUnblock = blockedImageIds.slice(0, 2);
    for (const id of idsToUnblock) {
      await page.click(`#${id}`);
      await page.waitForTimeout(300);
    }

    // Verify both are unblocked
    const unblockStatus = await page.evaluate(ids => {
      return ids.map(id => {
        const img = document.getElementById(id);
        return {
          id,
          isBlocked: img.classList.contains('face-blocked'),
          manuallyUnblocked: img.dataset.manuallyUnblocked,
        };
      });
    }, idsToUnblock);

    console.log('Unblock status:', unblockStatus);

    for (const status of unblockStatus) {
      expect(status.isBlocked).toBe(false);
      expect(status.manuallyUnblocked).toBe('true');
    }

    // Verify other images are still blocked
    const stillBlockedCount = await page.$$eval('img.face-blocked', imgs => imgs.length);
    expect(stillBlockedCount).toBe(blockedImageIds.length - 2);

    await page.close();
  });
});
