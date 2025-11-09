// tests/test-helpers.js
/**
 * Helper utilities for testing the Face Block Chromium Extension
 */

/**
 * Wait for extension to process images on a page
 * @param {import('@playwright/test').Page} page
 * @param {number} timeout - Timeout in milliseconds
 */
export async function waitForExtensionProcessing(page, timeout = 3000) {
  await page.waitForTimeout(timeout);
}

/**
 * Get the extension ID from the browser context
 * @param {import('@playwright/test').BrowserContext} browser
 * @returns {Promise<string>} Extension ID
 */
export async function getExtensionId(browser) {
  let extensionId = null;

  for (const worker of browser.serviceWorkers()) {
    if (worker.url().includes('chrome-extension://')) {
      extensionId = new URL(worker.url()).host;
      break;
    }
  }

  if (!extensionId) {
    throw new Error('Extension not found');
  }

  return extensionId;
}

/**
 * Count images on a page that have been replaced by the extension
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
export async function countReplacedImages(page) {
  return await page.evaluate(() => {
    const images = document.querySelectorAll('img');
    let replacedCount = 0;

    images.forEach(img => {
      // Check if image was replaced (src is a data URL with SVG)
      if (img.src.startsWith('data:image/svg+xml')) {
        replacedCount++;
      }
    });

    return replacedCount;
  });
}

/**
 * Count images with the face-blurred class
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<number>}
 */
export async function countBlockedImages(page) {
  return await page.evaluate(() => {
    return document.querySelectorAll('img.face-blurred').length;
  });
}

/**
 * Get console logs matching a pattern
 * @param {import('@playwright/test').Page} page
 * @param {string|RegExp} pattern
 * @returns {Promise<string[]>}
 */
export async function getConsoleLogs(page, pattern) {
  const logs = [];

  page.on('console', msg => {
    const text = msg.text();
    if (pattern instanceof RegExp) {
      if (pattern.test(text)) {
        logs.push(text);
      }
    } else {
      if (text.includes(pattern)) {
        logs.push(text);
      }
    }
  });

  return logs;
}

/**
 * Create a test page with specified number of images
 * @param {import('@playwright/test').Page} page
 * @param {number} imageCount
 * @param {object} options
 */
export async function createTestPage(page, imageCount = 5, options = {}) {
  const {
    backgroundColor = '#ffffff',
    imageWidth = 200,
    imageHeight = 200,
  } = options;

  const images = Array.from({ length: imageCount }, (_, i) => {
    const color = Math.floor(Math.random() * 16777215).toString(16);
    return `<img src="https://via.placeholder.com/${imageWidth}x${imageHeight}/${color}/FFFFFF?text=Image+${i + 1}" alt="Test ${i + 1}">`;
  }).join('\n');

  await page.setContent(`
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body {
            background-color: ${backgroundColor};
            padding: 20px;
          }
          img {
            margin: 10px;
            border: 1px solid #ddd;
          }
        </style>
      </head>
      <body>
        ${images}
      </body>
    </html>
  `);
}

/**
 * Check if an image has been processed by the extension
 * @param {import('@playwright/test').Page} page
 * @param {string} selector - Image selector
 * @returns {Promise<boolean>}
 */
export async function isImageProcessed(page, selector) {
  return await page.evaluate((sel) => {
    const img = document.querySelector(sel);
    if (!img) return false;

    // Check for replacement or original src storage
    return img.src.startsWith('data:image/svg+xml') ||
           img.dataset.originalSrc !== undefined;
  }, selector);
}

/**
 * Get background color of an element
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 * @returns {Promise<string>}
 */
export async function getBackgroundColor(page, selector) {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return null;

    return window.getComputedStyle(element).backgroundColor;
  }, selector);
}

/**
 * Simulate adding a person to the extension
 * (Note: This requires actual face images, so it's a placeholder)
 * @param {import('@playwright/test').Page} popupPage
 * @param {string} name
 * @param {string[]} imagePaths
 */
export async function addPersonToExtension(popupPage, name, imagePaths) {
  // This is a placeholder - actual implementation would require
  // uploading real face images through the file input
  await popupPage.fill('#personName', name);
  // File upload would go here
  // await popupPage.setInputFiles('#photoInput', imagePaths);
  // await popupPage.click('#addPersonBtn');
  console.log('addPersonToExtension is a placeholder - requires real face images');
}
