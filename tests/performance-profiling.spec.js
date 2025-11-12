// tests/performance-profiling.spec.js
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';
import { loadTestReferenceData } from './helpers/test-data-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure longer timeout for performance tests
test.setTimeout(300000); // 5 minutes

test.describe('Performance Profiling', () => {
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

  /**
   * Helper to run performance test for a given configuration
   */
  async function runPerformanceTest(config) {
    const { imageCount, detectorMode, testName } = config;

    // Load reference data (Trump only for consistent testing)
    testPageUrl = await loadTestReferenceData(browser, {
      people: ['trump'],
    });

    // Set detector mode if specified (via popup page which has access to chrome.storage)
    if (detectorMode) {
      const popupPage = await browser.newPage();
      const extensionId = await popupPage.evaluate(() => {
        return new Promise(resolve => {
          chrome.management.getSelf(info => {
            resolve(info.id);
          });
        });
      });

      // Set the detector mode via storage in the extension context
      await popupPage.evaluate(async mode => {
        await chrome.storage.local.set({ detectorMode: mode });
      }, detectorMode);

      await popupPage.close();
      console.log(`Set detector mode to: ${detectorMode}`);
    }

    const page = await browser.newPage();

    // Collect console logs
    const logs = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      if (text.includes('PERFORMANCE_COMPLETE')) {
        console.log('PAGE LOG:', text);
      }
    });

    // Navigate to performance test page
    const testPage = `performance-test-${imageCount}.html`;
    await page.goto(`${testPageUrl}/${testPage}`, { waitUntil: 'load' });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test: ${testName}`);
    console.log(`Images: ${imageCount}, Detector: ${detectorMode || 'default (hybrid)'}`);
    console.log('='.repeat(60));

    // Record start time
    const startTime = Date.now();

    // Wait for all images to be processed (with generous timeout)
    const timeout = imageCount * 100 + 30000; // ~100ms per image + 30s buffer
    console.log(`Waiting up to ${(timeout / 1000).toFixed(0)}s for processing...`);

    try {
      // Wait for the PERFORMANCE_COMPLETE log message
      await page.waitForFunction(
        () => {
          const processed = document.querySelectorAll('[data-face-block-processed="true"]').length;
          const total = document.querySelectorAll('.test-image').length;
          return processed === total;
        },
        { timeout }
      );

      const endTime = Date.now();
      const totalTimeSeconds = ((endTime - startTime) / 1000).toFixed(2);

      // Extract performance data from the page
      const stats = await page.evaluate(() => {
        return {
          totalImages: parseInt(document.getElementById('stat-total')?.textContent || '0'),
          processed: parseInt(document.getElementById('stat-processed')?.textContent || '0'),
          blocked: parseInt(document.getElementById('stat-blocked')?.textContent || '0'),
          totalTime: document.getElementById('stat-time')?.textContent || 'N/A',
          avgPerImage: document.getElementById('stat-avg')?.textContent || 'N/A',
        };
      });

      // Get memory usage if available
      let memoryUsage = null;
      try {
        const metrics = await page.metrics();
        memoryUsage = {
          jsHeapUsedMB: (metrics.JSHeapUsedSize / 1024 / 1024).toFixed(2),
          jsHeapTotalMB: (metrics.JSHeapTotalSize / 1024 / 1024).toFixed(2),
        };
      } catch (e) {
        // Memory metrics might not be available
      }

      const result = {
        testName,
        imageCount,
        detectorMode: detectorMode || 'hybrid (default)',
        ...stats,
        totalTimeSeconds,
        memoryUsage,
      };

      console.log('\n📊 Results:');
      console.log(`  Total Images:      ${result.totalImages}`);
      console.log(`  Processed:         ${result.processed}`);
      console.log(`  Blocked:           ${result.blocked}`);
      console.log(`  Total Time:        ${result.totalTime} (${totalTimeSeconds}s)`);
      console.log(`  Avg per Image:     ${result.avgPerImage}`);
      if (memoryUsage) {
        console.log(
          `  Memory Usage:      ${memoryUsage.jsHeapUsedMB} MB / ${memoryUsage.jsHeapTotalMB} MB`
        );
      }
      console.log('');

      await page.close();

      return result;
    } catch (error) {
      console.error(`❌ Test failed or timed out: ${error.message}`);
      await page.close();
      throw error;
    }
  }

  test('Performance baseline - 50 images (hybrid mode)', async () => {
    const result = await runPerformanceTest({
      imageCount: 50,
      detectorMode: null,
      testName: 'Baseline - 50 images',
    });

    expect(result.processed).toBe(result.totalImages);
    expect(result.totalImages).toBe(50);
  });

  test('Performance test - 100 images (hybrid mode)', async () => {
    const result = await runPerformanceTest({
      imageCount: 100,
      detectorMode: null,
      testName: '100 images - Hybrid',
    });

    expect(result.processed).toBe(result.totalImages);
    expect(result.totalImages).toBe(100);
  });

  test('Performance test - 200 images (hybrid mode)', async () => {
    const result = await runPerformanceTest({
      imageCount: 200,
      detectorMode: null,
      testName: '200 images - Hybrid',
    });

    expect(result.processed).toBe(result.totalImages);
    expect(result.totalImages).toBe(200);
  });

  test('Performance test - 500 images (hybrid mode)', async () => {
    const result = await runPerformanceTest({
      imageCount: 500,
      detectorMode: null,
      testName: '500 images - Hybrid',
    });

    expect(result.processed).toBe(result.totalImages);
    expect(result.totalImages).toBe(500);
  });

  test('Performance comparison - 100 images with TinyFaceDetector', async () => {
    const result = await runPerformanceTest({
      imageCount: 100,
      detectorMode: 'tinyFaceDetector',
      testName: '100 images - TinyFace (Fast)',
    });

    expect(result.processed).toBe(result.totalImages);
    expect(result.totalImages).toBe(100);
  });

  test('Performance comparison - 100 images with SsdMobilenetv1', async () => {
    const result = await runPerformanceTest({
      imageCount: 100,
      detectorMode: 'ssdMobilenetv1',
      testName: '100 images - SSD (Accurate)',
    });

    expect(result.processed).toBe(result.totalImages);
    expect(result.totalImages).toBe(100);
  });
});
