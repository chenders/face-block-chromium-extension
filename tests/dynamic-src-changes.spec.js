// tests/dynamic-src-changes.spec.js
// Tests for dynamic src attribute changes and re-processing logic
import { test, expect, chromium } from '@playwright/test';
import path from 'path';
import os from 'os';
import fs from 'fs';

test.describe('Dynamic Src Changes', () => {
  let browser;
  let extensionId;
  let userDataDir;

  test.beforeAll(async () => {
    // Create temporary directory for user data
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-dynamic-'));

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

  test('image with changed src is re-processed', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="test-img" src="https://via.placeholder.com/300x200?text=Image1" width="300" height="200" alt="Test">
        </body>
      </html>
    `);

    // Wait for initial processing
    await page.waitForTimeout(2000);

    // Clear logs
    logs.length = 0;

    // Change src attribute
    await page.evaluate(() => {
      document.getElementById('test-img').src = 'https://via.placeholder.com/300x200?text=Image2';
    });

    // Wait for re-processing (with 100ms debounce)
    await page.waitForTimeout(500);

    // Verify image was re-processed
    const hasProcessingLog = logs.some(log =>
      log.includes('Processing') || log.includes('Scanning')
    );

    expect(hasProcessingLog).toBe(true);

    await page.close();
  });

  test('image with same src is not re-processed', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block') && msg.text().includes('Processing')) {
        logs.push(msg.text());
      }
    });

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="test-img" src="https://via.placeholder.com/300x200?text=Same" width="300" height="200" alt="Test">
        </body>
      </html>
    `);

    // Wait for initial processing
    await page.waitForTimeout(2000);

    // Count processing logs
    const initialCount = logs.length;

    // Clear logs
    logs.length = 0;

    // Set the same src again (should not trigger re-processing)
    await page.evaluate(() => {
      const img = document.getElementById('test-img');
      img.src = img.src; // Same URL
    });

    // Wait
    await page.waitForTimeout(500);

    // Should not have new processing logs
    expect(logs.length).toBe(0);

    await page.close();
  });

  test('image srcset changes trigger re-processing', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="test-img"
               src="https://via.placeholder.com/300x200"
               srcset="https://via.placeholder.com/600x400 2x"
               width="300" height="200" alt="Test">
        </body>
      </html>
    `);

    // Wait for initial processing
    await page.waitForTimeout(2000);

    // Clear logs
    logs.length = 0;

    // Change srcset attribute
    await page.evaluate(() => {
      document.getElementById('test-img').srcset = 'https://via.placeholder.com/900x600 2x';
    });

    // Wait for re-processing
    await page.waitForTimeout(500);

    // Verify image was detected for re-processing
    const hasLog = logs.length > 0;
    expect(hasLog).toBe(true);

    await page.close();
  });

  test('multiple rapid src changes are debounced', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block') && msg.text().includes('Processing')) {
        logs.push(msg.text());
      }
    });

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

    // Clear logs
    logs.length = 0;

    // Make rapid src changes (within debounce window)
    await page.evaluate(() => {
      const img = document.getElementById('test-img');
      img.src = 'https://via.placeholder.com/300x200?text=Change1';
      setTimeout(() => {
        img.src = 'https://via.placeholder.com/300x200?text=Change2';
      }, 20);
      setTimeout(() => {
        img.src = 'https://via.placeholder.com/300x200?text=Change3';
      }, 40);
    });

    // Wait for debounced processing (100ms debounce + some margin)
    await page.waitForTimeout(300);

    // Should have processed in batches, not 3 separate times
    // Allow some flexibility in log counting
    expect(logs.length).toBeLessThan(6); // Should not have 3 full processing cycles

    await page.close();
  });

  test('incomplete images get re-processed when loaded', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block') &&
          (msg.text().includes('not loaded yet') || msg.text().includes('Processing'))) {
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

    // Add an image that won't load immediately
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.id = 'late-img';
      img.width = 300;
      img.height = 200;
      // Set src after adding to DOM to simulate incomplete state
      document.getElementById('container').appendChild(img);
      // Set src asynchronously
      setTimeout(() => {
        img.src = 'https://via.placeholder.com/300x200?text=Late';
      }, 100);
    });

    // Wait for image to load and be processed
    await page.waitForTimeout(3000);

    // Should have logs about incomplete image and then processing
    const hasIncompleteLog = logs.some(log => log.includes('not loaded yet'));
    const hasProcessingLog = logs.some(log => log.includes('Processing'));

    // At least one of these should be true (depends on timing)
    expect(hasIncompleteLog || hasProcessingLog).toBe(true);

    await page.close();
  });

  test('images changing from placeholder to real image are processed', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    // Google Images-style lazy loading
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="lazy-img"
               src="data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
               width="300" height="200"
               data-deferred="1"
               alt="Test">
        </body>
      </html>
    `);

    // Wait a moment
    await page.waitForTimeout(1000);

    // Clear logs
    logs.length = 0;

    // Simulate Google Images updating the src
    await page.evaluate(() => {
      const img = document.getElementById('lazy-img');
      img.removeAttribute('data-deferred');
      img.src = 'https://via.placeholder.com/300x200?text=Real';
    });

    // Wait for processing
    await page.waitForTimeout(500);

    // Should have processed the real image
    const hasProcessingLog = logs.some(log =>
      log.includes('Processing') || log.includes('Scanning')
    );

    expect(hasProcessingLog).toBe(true);

    await page.close();
  });

  test('1x1 placeholder images are skipped based on natural dimensions', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block') && msg.text().includes('too small')) {
        logs.push(msg.text());
      }
    });

    // 1x1 GIF scaled to 46x46 (Google Images style)
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="placeholder"
               src="data:image/gif;base64,R0lGODlhAQABAIAAAP///////yH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
               style="width: 46px; height: 46px;"
               alt="Test">
        </body>
      </html>
    `);

    // Wait for processing
    await page.waitForTimeout(2000);

    // Should have log about skipping due to natural dimensions
    const hasSkipLog = logs.some(log =>
      log.includes('too small') && log.includes('natural:1x1')
    );

    expect(hasSkipLog).toBe(true);

    await page.close();
  });

  test('real images with correct dimensions are processed', async () => {
    const page = await browser.newPage();
    const logs = [];
    page.on('console', msg => {
      if (msg.text().includes('Face Block')) {
        logs.push(msg.text());
      }
    });

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="real-img"
               src="https://via.placeholder.com/300x200"
               width="300" height="200"
               alt="Real Image">
        </body>
      </html>
    `);

    // Wait for processing
    await page.waitForTimeout(3000);

    // Should have processing logs, not "too small" logs
    const hasProcessingLog = logs.some(log =>
      log.includes('Processing') || log.includes('Image dimensions')
    );
    const hasSkipLog = logs.some(log =>
      log.includes('too small')
    );

    expect(hasProcessingLog).toBe(true);
    expect(hasSkipLog).toBe(false);

    await page.close();
  });
});
