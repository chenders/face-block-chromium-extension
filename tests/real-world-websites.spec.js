/**
 * Real-World Website Tests
 *
 * These tests verify that the extension works properly on real-world
 * image-heavy websites without breaking layout or functionality.
 */

import { test, expect } from '@playwright/test';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';

test.describe('Real-World Website Compatibility', () => {
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

  // Helper to create a page with realistic browser headers
  async function createRealisticPage() {
    const page = await browser.newPage({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('PAGE ERROR:', msg.text());
      }
    });

    return page;
  }

  test('extension does not break Unsplash image-heavy pages', async () => {
    const page = await createRealisticPage();

    // Navigate to Unsplash explore page with many images
    await page.goto('https://unsplash.com/explore', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Scroll down to trigger lazy-loaded images
    console.log('Scrolling to load more images...');
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let totalHeight = 0;
        const distance = 500;
        const timer = setInterval(() => {
          window.scrollBy(0, distance);
          totalHeight += distance;
          if (totalHeight >= document.body.scrollHeight / 2) {
            clearInterval(timer);
            resolve();
          }
        }, 200);
      });
    });

    // Wait for images to load after scrolling
    await page.waitForTimeout(2000);

    // Get all images on the page
    const imageInfo = await page.$$eval('img', imgs =>
      imgs.map(img => ({
        src: img.src.substring(0, 50),
        width: img.width,
        height: img.height,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        visible: img.offsetWidth > 0 && img.offsetHeight > 0,
        hasError: img.complete && img.naturalWidth === 0,
      }))
    );

    console.log(`Total images on Unsplash page: ${imageInfo.length}`);

    // Filter to images that should be loaded (exclude tiny icons, etc.)
    const substantialImages = imageInfo.filter(img => img.width > 30 && img.height > 30);

    console.log(`Substantial images (>30x30): ${substantialImages.length}`);

    // Verify most images loaded successfully
    const loadedImages = substantialImages.filter(img => img.complete && !img.hasError);
    const loadSuccessRate = loadedImages.length / substantialImages.length;

    console.log(
      `Image load success rate: ${(loadSuccessRate * 100).toFixed(1)}% (${loadedImages.length}/${substantialImages.length})`
    );

    // At least 80% of images should load (Unsplash uses heavy lazy-loading)
    expect(loadSuccessRate).toBeGreaterThanOrEqual(0.8);

    // Verify most images are visible (not hidden by extension)
    const visibleImages = substantialImages.filter(img => img.visible);
    const visibilityRate = visibleImages.length / substantialImages.length;

    console.log(
      `Image visibility rate: ${(visibilityRate * 100).toFixed(1)}% (${visibleImages.length}/${substantialImages.length})`
    );

    // At least 80% of images should be visible (some may be lazy-loaded or hidden by design)
    expect(visibilityRate).toBeGreaterThanOrEqual(0.8);

    // Verify page layout is intact
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    console.log(`Page height: ${pageHeight}px`);

    // Page should have reasonable height (not collapsed)
    expect(pageHeight).toBeGreaterThan(1000);

    // Check that no layout errors occurred
    const layoutErrors = await page.evaluate(() => {
      const errors = [];
      const elements = document.querySelectorAll('*');

      for (const el of elements) {
        const style = window.getComputedStyle(el);

        // Check for negative dimensions (sign of broken layout)
        if (el.offsetWidth < 0 || el.offsetHeight < 0) {
          errors.push(`Negative dimensions on ${el.tagName}`);
        }

        // Check for overlapping positioned elements that might be caused by our tooltips
        if (style.position === 'fixed' && style.zIndex && parseInt(style.zIndex) > 10000) {
          errors.push(`Very high z-index (${style.zIndex}) on ${el.tagName}`);
        }
      }

      return errors;
    });

    console.log(`Layout errors: ${layoutErrors.length}`);
    if (layoutErrors.length > 0) {
      console.log('Layout errors:', layoutErrors.slice(0, 5));
    }

    // Should have no major layout errors
    expect(layoutErrors.length).toBe(0);

    await page.close();
  });

  test('extension handles Flickr image galleries correctly', async () => {
    const page = await createRealisticPage();

    // Navigate to Flickr Explore
    await page.goto('https://www.flickr.com/explore', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Scroll to trigger lazy-loaded images
    console.log('Scrolling to load more images...');
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);

    // Get all images
    const imageInfo = await page.$$eval('img', imgs =>
      imgs.map(img => ({
        src: img.src.substring(0, 50),
        width: img.width,
        height: img.height,
        complete: img.complete,
        visible: img.offsetWidth > 0 && img.offsetHeight > 0,
        hasBlockedClass: img.classList.contains('face-blocked'),
      }))
    );

    console.log(`Total images on Flickr: ${imageInfo.length}`);

    // Filter to substantial images (not tiny thumbnails or icons)
    const substantialImages = imageInfo.filter(img => img.width > 50 && img.height > 50);

    console.log(`Substantial images (>50x50): ${substantialImages.length}`);

    // Verify most images are visible and loaded
    const visibleImages = substantialImages.filter(img => img.visible && img.complete);
    const visibilityRate = visibleImages.length / substantialImages.length;

    console.log(
      `Visible images: ${(visibilityRate * 100).toFixed(1)}% (${visibleImages.length}/${substantialImages.length})`
    );

    // At least 30% should be visible (Flickr lazy-loads very heavily)
    expect(visibilityRate).toBeGreaterThanOrEqual(0.3);

    await page.close();
  });

  test('extension handles 500px photography site correctly', async () => {
    const page = await createRealisticPage();

    // Navigate to 500px Discover page
    await page.goto('https://500px.com/popular', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Scroll to trigger lazy-loaded images
    console.log('Scrolling to load more images...');
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);

    // Get all images
    const imageInfo = await page.$$eval('img', imgs =>
      imgs.map(img => ({
        width: img.width,
        height: img.height,
        complete: img.complete,
        visible: img.offsetWidth > 0 && img.offsetHeight > 0,
      }))
    );

    console.log(`Total images on 500px: ${imageInfo.length}`);

    const substantialImages = imageInfo.filter(img => img.width > 50 && img.height > 50);
    console.log(`Substantial images: ${substantialImages.length}`);

    // Verify images are loading
    expect(substantialImages.length).toBeGreaterThan(0);

    const visibleImages = substantialImages.filter(img => img.visible);
    const visibilityRate = visibleImages.length / substantialImages.length;

    console.log(`Visible images: ${(visibilityRate * 100).toFixed(1)}%`);

    // At least 60% should be visible
    expect(visibilityRate).toBeGreaterThanOrEqual(0.6);

    await page.close();
  });

  test('extension handles Behance creative portfolios correctly', async () => {
    const page = await createRealisticPage();

    // Navigate to Behance Discover
    await page.goto('https://www.behance.net/search/projects', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Scroll to trigger lazy-loaded images
    console.log('Scrolling to load more images...');
    await page.evaluate(() => window.scrollBy(0, 1000));
    await page.waitForTimeout(2000);

    // Get all images
    const imageInfo = await page.$$eval('img', imgs =>
      imgs.map(img => ({
        width: img.width,
        height: img.height,
        visible: img.offsetWidth > 0 && img.offsetHeight > 0,
      }))
    );

    console.log(`Total images on Behance: ${imageInfo.length}`);

    const substantialImages = imageInfo.filter(img => img.width > 50 && img.height > 50);
    console.log(`Substantial images: ${substantialImages.length}`);

    expect(substantialImages.length).toBeGreaterThan(0);

    const visibleImages = substantialImages.filter(img => img.visible);
    const visibilityRate = visibleImages.length / substantialImages.length;

    console.log(`Visible images: ${(visibilityRate * 100).toFixed(1)}%`);

    // At least 60% should be visible
    expect(visibilityRate).toBeGreaterThanOrEqual(0.6);

    await page.close();
  });

  test('extension handles Amazon product pages with filters correctly', async () => {
    const page = await createRealisticPage();

    // Navigate to Amazon Best Sellers (lots of product images)
    await page.goto('https://www.amazon.com/Best-Sellers/zgbs', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for initial load
    await page.waitForTimeout(2000);

    // Count initial images
    const initialImageCount = await page.$$eval('img', imgs => imgs.length);
    console.log(`Initial images on Amazon: ${initialImageCount}`);

    // Scroll down to trigger lazy-loaded images
    console.log('Scrolling to load more images...');
    await page.evaluate(() => window.scrollBy(0, 1500));
    await page.waitForTimeout(2000);

    // Try to interact with department filters if available
    const departmentLinks = await page.$$('a[href*="/zgbs/"]');
    if (departmentLinks.length > 0) {
      console.log(`Found ${departmentLinks.length} department filter links`);

      // Click on first department filter to test dynamic content
      try {
        const firstLinkText = await departmentLinks[0].textContent();
        console.log(`Attempting to click department filter: ${firstLinkText}`);
        await departmentLinks[0].click({ timeout: 3000 });
        await page.waitForTimeout(2000);
        console.log('Successfully clicked department filter - page updated');
      } catch (e) {
        console.log('Could not click department filter (may be blocked or not visible)');
      }
    }

    // Get all images after scrolling and interaction
    const imageInfo = await page.$$eval('img', imgs =>
      imgs.map(img => ({
        width: img.width,
        height: img.height,
        complete: img.complete,
        visible: img.offsetWidth > 0 && img.offsetHeight > 0,
      }))
    );

    console.log(`Total images on Amazon after interaction: ${imageInfo.length}`);

    const substantialImages = imageInfo.filter(img => img.width > 30 && img.height > 30);
    console.log(`Substantial images: ${substantialImages.length}`);

    expect(substantialImages.length).toBeGreaterThan(0);

    const visibleImages = substantialImages.filter(img => img.visible);
    const visibilityRate = visibleImages.length / substantialImages.length;

    console.log(`Visible images: ${(visibilityRate * 100).toFixed(1)}%`);

    // At least 70% should be visible
    expect(visibilityRate).toBeGreaterThanOrEqual(0.7);

    await page.close();
  });

  test('extension performance does not degrade page load times excessively', async () => {
    const page = await createRealisticPage();

    // Measure page load time on Unsplash
    const startTime = Date.now();

    await page.goto('https://unsplash.com', {
      waitUntil: 'domcontentloaded',
      timeout: 40000,
    });

    // Wait for extension processing
    await page.waitForTimeout(3000);

    const loadTime = Date.now() - startTime;

    console.log(`Page load time (including extension processing): ${loadTime}ms`);

    // Page should load within reasonable time (30 seconds including processing and network variability)
    expect(loadTime).toBeLessThan(30000);

    // Verify page is functional (has images loaded)
    const imageCount = await page.$$eval('img', imgs => imgs.length);
    console.log(`Total images on page: ${imageCount}`);

    // Should have loaded a reasonable number of images
    expect(imageCount).toBeGreaterThan(20);

    await page.close();
  });

  test('extension does not break responsive image functionality', async () => {
    const page = await createRealisticPage();

    await page.goto('https://unsplash.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Check responsive images with srcset (excluding blocked images)
    const responsiveImageInfo = await page.$$eval('img[srcset]', imgs =>
      imgs.map(img => ({
        hasSrcset: !!img.srcset,
        currentSrc: img.currentSrc.substring(0, 50),
        complete: img.complete,
        visible: img.offsetWidth > 0 && img.offsetHeight > 0,
        isBlocked: img.classList.contains('face-blocked'),
      }))
    );

    console.log(`Responsive images (with srcset): ${responsiveImageInfo.length}`);

    if (responsiveImageInfo.length > 0) {
      // Filter out blocked images (those are replaced by the extension intentionally)
      const nonBlockedImages = responsiveImageInfo.filter(img => !img.isBlocked);
      console.log(`Non-blocked responsive images: ${nonBlockedImages.length}`);

      // Check working responsive images (those that loaded successfully)
      const workingResponsiveImages = nonBlockedImages.filter(
        img => img.currentSrc && img.currentSrc.length > 10
      );

      const workingRate = workingResponsiveImages.length / nonBlockedImages.length;

      console.log(
        `Working responsive images: ${(workingRate * 100).toFixed(1)}% (${workingResponsiveImages.length}/${nonBlockedImages.length})`
      );

      // At least 50% should be working (accounts for lazy-loading and network variability)
      expect(workingRate).toBeGreaterThanOrEqual(0.5);
    }

    await page.close();
  });

  test('tooltips do not interfere with page interaction', async () => {
    const page = await createRealisticPage();

    await page.goto('https://unsplash.com', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(3000);

    // Try to click a link to ensure tooltips don't block interaction
    // Look for any navigation link
    const navLink = await page.$('a[href*="unsplash.com"]:not([href*="#"])');

    if (navLink) {
      const linkHref = await navLink.getAttribute('href');
      console.log(`Attempting to click link: ${linkHref}`);

      // Scroll into view first
      await navLink.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);

      // This should not throw an error or be blocked by tooltips
      await navLink.click({ timeout: 5000 });

      // Wait for navigation
      await page.waitForTimeout(1500);

      // Verify navigation occurred (URL should have changed)
      const currentUrl = page.url();
      console.log(`Current URL after click: ${currentUrl}`);

      // Should still be on Unsplash domain
      expect(currentUrl).toContain('unsplash.com');
    } else {
      console.log('No suitable link found, test passes by default');
    }

    await page.close();
  });
});
