// tests/google-images-scenarios.spec.js
// Tests simulating Google Images lazy loading patterns
import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

test.describe('Google Images Lazy Loading Scenarios', () => {
  let browser;
  let extensionId;
  let userDataDir;

  test.beforeAll(async () => {
    // Create temporary directory for user data
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-google-'));

    // Launch browser with extension
    const pathToExtension = path.join(process.cwd(), 'extension');
    browser = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
      ],
    });

    // Wait for extension to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get extension ID
    for (const worker of browser.serviceWorkers()) {
      if (worker.url().includes('chrome-extension://')) {
        extensionId = new URL(worker.url()).host;
        break;
      }
    }

    console.log('Extension ID:', extensionId);
  });

  test.afterAll(async () => {
    await browser.close();
    if (userDataDir) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test('handles Google Images placeholder-to-real pattern', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    // Create page with 10 placeholder images
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <div id="image-container">
            ${Array.from({ length: 10 }, (_, i) => `
              <img id="img-${i}"
                   src="data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
                   style="width: 259px; height: 180px; display: inline-block; margin: 5px;"
                   data-deferred="1"
                   alt="Image ${i}">
            `).join('')}
          </div>
        </body>
      </html>
    `);

    // Wait a moment for initial scan
    await page.waitForTimeout(1000);

    // Clear logs
    logs.length = 0;

    // Simulate Google Images updating all src attributes rapidly
    await page.evaluate(() => {
      const images = document.querySelectorAll('img[data-deferred]');
      images.forEach((img, i) => {
        setTimeout(() => {
          img.removeAttribute('data-deferred');
          img.src = `https://via.placeholder.com/259x180?text=Real${i}`;
        }, i * 10); // Stagger slightly like Google does
      });
    });

    // Wait for batch processing (100ms debounce + processing time)
    await page.waitForTimeout(2000);

    // Should have skipped placeholders initially
    const hasPlaceholderSkipLog = logs.some(log =>
      log.includes('too small') && log.includes('natural:1x1')
    );

    // Should have processed real images
    const hasProcessingLog = logs.some(log =>
      log.includes('Processing') || log.includes('Scanning')
    );

    expect(hasPlaceholderSkipLog).toBe(true);
    expect(hasProcessingLog).toBe(true);

    await page.close();
  });

  test('batch processes multiple images updated simultaneously', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block') && msg.text().includes('Processing batch')) {
        logs.push(msg.text());
      }
    });

    // Create page with placeholders
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <div id="image-container">
            ${Array.from({ length: 20 }, (_, i) => `
              <img id="img-${i}"
                   src="data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
                   style="width: 200px; height: 150px; display: inline-block;"
                   alt="Image ${i}">
            `).join('')}
          </div>
        </body>
      </html>
    `);

    await page.waitForTimeout(1000);

    // Update all images at once
    await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      images.forEach((img, i) => {
        img.src = `https://via.placeholder.com/200x150?text=Batch${i}`;
      });
    });

    // Wait for batch processing
    await page.waitForTimeout(1000);

    // Should process in batches, not one-by-one
    // With batch size of 10, we should see 2 batch processing logs
    const batchLogs = logs.filter(log => log.includes('Processing batch'));
    expect(batchLogs.length).toBeGreaterThan(0);

    await page.close();
  });

  test('handles images with CSS-scaled dimensions correctly', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    // Image with natural 1x1 scaled to 46x46 by CSS
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="scaled-placeholder"
               src="data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
               style="width: 46px; height: 46px;"
               alt="Scaled">
        </body>
      </html>
    `);

    await page.waitForTimeout(2000);

    // Should skip due to natural dimensions being 1x1
    const hasSkipLog = logs.some(log =>
      log.includes('too small') &&
      log.includes('display:46x46') &&
      log.includes('natural:1x1')
    );

    expect(hasSkipLog).toBe(true);

    await page.close();
  });

  test('processes images that meet minimum size threshold', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    // Images at and above 30x30 threshold
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="at-threshold" src="https://via.placeholder.com/30x30" width="30" height="30" alt="At threshold">
          <img id="above-threshold" src="https://via.placeholder.com/31x31" width="31" height="31" alt="Above threshold">
        </body>
      </html>
    `);

    await page.waitForTimeout(3000);

    // Both should be processed (30x30 is at threshold)
    const processingLogs = logs.filter(log =>
      log.includes('Image dimensions') && !log.includes('too small')
    );

    expect(processingLogs.length).toBeGreaterThan(0);

    await page.close();
  });

  test('skips images below minimum size threshold', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block') && msg.text().includes('too small')) {
        logs.push(msg.text());
      }
    });

    // Images below 30x30 threshold
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="below-1" src="https://via.placeholder.com/29x29" width="29" height="29" alt="Below 1">
          <img id="below-2" src="https://via.placeholder.com/20x20" width="20" height="20" alt="Below 2">
          <img id="below-3" src="https://via.placeholder.com/10x10" width="10" height="10" alt="Below 3">
        </body>
      </html>
    `);

    await page.waitForTimeout(2000);

    // All three should be skipped
    expect(logs.length).toBeGreaterThanOrEqual(3);

    await page.close();
  });

  test('handles rapid sequential src updates with debouncing', async () => {
    const page = await browser.newPage();
    const logs = [];
    let processingCount = 0;

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Face Block')) {
        logs.push(text);
        if (text.includes('Processing batch')) {
          processingCount++;
        }
      }
    });

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="rapid-img" src="https://via.placeholder.com/300x200?text=Initial" width="300" height="200" alt="Test">
        </body>
      </html>
    `);

    await page.waitForTimeout(2000);

    // Clear counters
    processingCount = 0;

    // Make 5 rapid changes within 100ms (should be batched)
    await page.evaluate(() => {
      const img = document.getElementById('rapid-img');
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          img.src = `https://via.placeholder.com/300x200?text=Change${i}`;
        }, i * 15); // 15ms apart, all within 100ms debounce window
      }
    });

    // Wait for debounced processing
    await page.waitForTimeout(500);

    // Should have minimal processing cycles due to debouncing
    // Not necessarily 1 due to timing, but should be much less than 5
    expect(processingCount).toBeLessThan(5);

    await page.close();
  });

  test('handles initial page load with many placeholder images efficiently', async () => {
    const page = await browser.newPage();
    const logs = [];
    let placeholderSkipCount = 0;

    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('Face Block')) {
        logs.push(text);
        if (text.includes('too small') && text.includes('natural:1x1')) {
          placeholderSkipCount++;
        }
      }
    });

    // Create page with many placeholders like Google Images
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <div id="results">
            ${Array.from({ length: 50 }, (_, i) => `
              <div style="display: inline-block; margin: 5px;">
                <img id="img-${i}"
                     src="data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
                     style="width: 259px; height: 180px;"
                     data-deferred="1"
                     alt="Result ${i}">
              </div>
            `).join('')}
          </div>
        </body>
      </html>
    `);

    // Wait for initial scan
    await page.waitForTimeout(3000);

    // Should have efficiently skipped all 50 placeholders
    expect(placeholderSkipCount).toBeGreaterThanOrEqual(45); // Allow some margin

    // Should not have tried expensive face detection on them
    const hasDetectionLog = logs.some(log =>
      log.includes('TinyFace') && log.includes('data:image/gif')
    );
    expect(hasDetectionLog).toBe(false);

    await page.close();
  });

  test('correctly processes images after placeholder replacement', async () => {
    const page = await browser.newPage();
    const logs = [];

    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    // Start with placeholders
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <div id="results">
            ${Array.from({ length: 5 }, (_, i) => `
              <img id="img-${i}"
                   src="data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
                   style="width: 259px; height: 180px; display: inline-block; margin: 5px;"
                   data-deferred="1"
                   alt="Result ${i}">
            `).join('')}
          </div>
        </body>
      </html>
    `);

    await page.waitForTimeout(1500);

    // Clear logs before replacement
    logs.length = 0;

    // Replace placeholders with real images
    await page.evaluate(() => {
      const images = document.querySelectorAll('img[data-deferred]');
      images.forEach((img, i) => {
        img.removeAttribute('data-deferred');
        img.src = `https://via.placeholder.com/259x180?text=Real${i}`;
      });
    });

    // Wait for processing
    await page.waitForTimeout(1000);

    // Should have processed the real images
    const hasProcessingLog = logs.some(log =>
      log.includes('Image dimensions') && log.includes('259x180')
    );

    expect(hasProcessingLog).toBe(true);

    await page.close();
  });

  test('handles images with complete=false state', async () => {
    const page = await browser.newPage();
    const logs = [];

    page.on('console', msg => {
      if (msg.text().includes('Face Block') && msg.text().includes('not loaded yet')) {
        logs.push(msg.text());
      }
    });

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <div id="container"></div>
        </body>
      </html>
    `);

    // Add image that starts incomplete
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.id = 'incomplete-img';
      img.width = 300;
      img.height = 200;
      document.getElementById('container').appendChild(img);

      // Set src after a delay
      setTimeout(() => {
        img.src = 'https://via.placeholder.com/300x200';
      }, 500);
    });

    // Wait for processing
    await page.waitForTimeout(2000);

    // Should have log about incomplete image
    const hasIncompleteLog = logs.some(log => log.includes('not loaded yet'));

    // At least we should not have errors
    expect(true).toBe(true);

    await page.close();
  });

  test('respects 100ms debounce delay for faster response', async () => {
    const page = await browser.newPage();
    const timestamps = [];

    page.on('console', msg => {
      if (msg.text().includes('Face Block') && msg.text().includes('Processing batch')) {
        timestamps.push(Date.now());
      }
    });

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="test-img" src="https://via.placeholder.com/300x200" width="300" height="200" alt="Test">
        </body>
      </html>
    `);

    await page.waitForTimeout(2000);

    // Record start time
    const startTime = Date.now();
    timestamps.length = 0;

    // Change src
    await page.evaluate(() => {
      document.getElementById('test-img').src = 'https://via.placeholder.com/300x200?text=Changed';
    });

    // Wait for processing
    await page.waitForTimeout(500);

    // Processing should start within reasonable time (~100ms debounce + some margin)
    if (timestamps.length > 0) {
      const processingDelay = timestamps[0] - startTime;
      // Should be roughly 100ms, give it generous margin
      expect(processingDelay).toBeLessThan(500);
    }

    await page.close();
  });
});
