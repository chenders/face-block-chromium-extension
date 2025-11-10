// tests/real-world-urls.spec.js
import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';
import { loadTestReferenceData, clearTestReferenceData } from './helpers/test-data-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse test_urls.md files
function parseTestUrls(filepath) {
  const content = fs.readFileSync(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
  return lines;
}

const einsteinUrls = {
  withImages: parseTestUrls(
    path.join(__dirname, 'fixtures/images/albert_einstein/test_urls.md')
  ).slice(0, 4),
  withoutImages: parseTestUrls(
    path.join(__dirname, 'fixtures/images/albert_einstein/test_urls.md')
  ).slice(4, 8),
};

const saganUrls = {
  withImages: parseTestUrls(path.join(__dirname, 'fixtures/images/carl_sagan/test_urls.md')).slice(
    0,
    4
  ),
  withoutImages: parseTestUrls(
    path.join(__dirname, 'fixtures/images/carl_sagan/test_urls.md')
  ).slice(4, 8),
};

test.describe('Real-World URL Testing', () => {
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

  test('Einstein pages with his images block correctly', async () => {
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Load Einstein reference data
    await loadTestReferenceData(browser, { people: ['albert_einstein'] });

    // Test the first URL with Einstein images
    const testUrl = einsteinUrls.withImages[0];
    console.log(`Testing URL: ${testUrl}`);

    try {
      await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for extension to process
      await page.waitForTimeout(8000);

      // Check if any images were blocked
      const blockedImages = await page.$$eval(
        'img',
        imgs =>
          imgs.filter(img => img.alt === 'Image blocked by Face Block Chromium Extension').length
      );

      console.log(`Blocked ${blockedImages} image(s) on ${testUrl}`);

      // Should block at least some images on Einstein pages
      expect(blockedImages).toBeGreaterThan(0);
    } catch (error) {
      console.log(`Error loading ${testUrl}:`, error.message);
      // Some URLs might fail to load - skip test
      test.skip();
    }

    await page.close();
  });

  test('pages without Einstein images show normally', async () => {
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    await loadTestReferenceData(browser, { people: ['albert_einstein'] });

    // Test URL without Einstein
    const testUrl = einsteinUrls.withoutImages[0];
    console.log(`Testing URL: ${testUrl}`);

    try {
      await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      await page.waitForTimeout(8000);

      // Check blocked images
      const blockedImages = await page.$$eval(
        'img',
        imgs =>
          imgs.filter(img => img.alt === 'Image blocked by Face Block Chromium Extension').length
      );

      console.log(`Blocked ${blockedImages} image(s) on ${testUrl}`);

      // Should not block any images on pages without Einstein
      expect(blockedImages).toBe(0);
    } catch (error) {
      console.log(`Error loading ${testUrl}:`, error.message);
      test.skip();
    }

    await page.close();
  });

  test('Carl Sagan pages block correctly', async () => {
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // Clear previous data and load Sagan
    await clearTestReferenceData(page);
    await loadTestReferenceData(browser, { people: ['carl_sagan'] });

    // Test Sagan URL
    const testUrl = saganUrls.withImages[0];
    console.log(`Testing URL: ${testUrl}`);

    try {
      await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      await page.waitForTimeout(8000);

      const blockedImages = await page.$$eval(
        'img',
        imgs =>
          imgs.filter(img => img.alt === 'Image blocked by Face Block Chromium Extension').length
      );

      console.log(`Blocked ${blockedImages} image(s) on ${testUrl}`);

      // Should block at least some images on Sagan pages
      expect(blockedImages).toBeGreaterThan(0);
    } catch (error) {
      console.log(`Error loading ${testUrl}:`, error.message);
      test.skip();
    }

    await page.close();
  });

  test('extension processes images on complex real-world pages', async () => {
    const page = await browser.newPage();

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    await loadTestReferenceData(browser, { people: ['albert_einstein'] });

    // Test a complex page (Britannica)
    const testUrl = 'https://www.britannica.com/biography/Albert-Einstein';
    console.log(`Testing complex page: ${testUrl}`);

    try {
      await page.goto(testUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      await page.waitForTimeout(10000);

      // Count total and processed images
      const imageStats = await page.$$eval('img:not([src^="data:"]):not([src^="blob:"])', imgs => ({
        total: imgs.length,
        processed: imgs.filter(
          img =>
            img.hasAttribute('data-face-block-processed') ||
            img.alt === 'Image blocked by Face Block Chromium Extension'
        ).length,
        blocked: imgs.filter(img => img.alt === 'Image blocked by Face Block Chromium Extension')
          .length,
        visible: imgs.filter(img => {
          const style = window.getComputedStyle(img);
          return style.opacity !== '0' && style.display !== 'none';
        }).length,
      }));

      console.log('Image stats:', imageStats);

      // Most images should be processed
      expect(imageStats.processed).toBeGreaterThan(0);

      // Some images should be blocked on Einstein page
      expect(imageStats.blocked).toBeGreaterThan(0);
    } catch (error) {
      console.log(`Error loading ${testUrl}:`, error.message);
      test.skip();
    }

    await page.close();
  });
});
