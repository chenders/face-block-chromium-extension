// scripts/capture-screenshots.js
// Automated screenshot capture for Chrome Web Store listing

import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCREENSHOT_DIR = path.join(__dirname, '../store-assets/screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

async function captureScreenshots() {
  console.log('🎬 Starting screenshot capture...\n');

  // Launch browser with extension
  const pathToExtension = path.join(__dirname, '../extension');
  const userDataDir = path.join(__dirname, '../.temp-profile');

  // Clean up old profile
  if (fs.existsSync(userDataDir)) {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--window-size=1280,800',
    ],
    viewport: { width: 1280, height: 800 },
  });

  // Get extension ID
  await new Promise(resolve => setTimeout(resolve, 2000));
  let extensionId = null;
  for (const worker of context.serviceWorkers()) {
    if (worker.url().includes('chrome-extension://')) {
      extensionId = new URL(worker.url()).host;
      break;
    }
  }

  if (!extensionId) {
    console.error('❌ Could not find extension ID');
    await context.close();
    return;
  }

  console.log(`✅ Extension loaded: ${extensionId}\n`);

  try {
    // Screenshot 1: Extension popup - main view
    console.log('📸 Capturing screenshot 1: Popup main view...');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForTimeout(1000);
    await popupPage.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-popup-main.png'),
      fullPage: true,
    });
    console.log('   ✓ Saved: 01-popup-main.png\n');

    // Screenshot 2: Add person interface
    console.log('📸 Capturing screenshot 2: Add person interface...');
    await popupPage.fill('#personName', 'Example Person');
    await popupPage.screenshot({
      path: path.join(SCREENSHOT_DIR, '02-add-person.png'),
      fullPage: true,
    });
    console.log('   ✓ Saved: 02-add-person.png\n');

    // Screenshot 3: Detector mode selection
    console.log('📸 Capturing screenshot 3: Detector modes...');
    await popupPage.click('input[name="detector"][value="tinyFaceDetector"]');
    await popupPage.waitForTimeout(500);
    await popupPage.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-detector-modes.png'),
      fullPage: true,
    });
    console.log('   ✓ Saved: 03-detector-modes.png\n');

    // Screenshot 4: Match threshold setting
    console.log('📸 Capturing screenshot 4: Settings...');
    await popupPage.fill('#matchThreshold', '0.7');
    await popupPage.waitForTimeout(500);
    await popupPage.screenshot({
      path: path.join(SCREENSHOT_DIR, '04-settings.png'),
      fullPage: true,
    });
    console.log('   ✓ Saved: 04-settings.png\n');

    await popupPage.close();

    // Screenshot 5: Example webpage (before/after comparison setup)
    console.log('📸 Capturing screenshot 5: Example usage...');
    const examplePage = await context.newPage();
    await examplePage.goto('https://en.wikipedia.org/wiki/Albert_Einstein');
    await examplePage.waitForTimeout(3000);
    await examplePage.screenshot({
      path: path.join(SCREENSHOT_DIR, '05-example-page.png'),
      fullPage: false,
    });
    console.log('   ✓ Saved: 05-example-page.png\n');
    await examplePage.close();

    console.log('✅ All screenshots captured successfully!');
    console.log(`📁 Screenshots saved to: ${SCREENSHOT_DIR}\n`);
    console.log('📋 Next steps:');
    console.log('   1. Review screenshots in store-assets/screenshots/');
    console.log('   2. Edit/annotate as needed (add arrows, highlights, etc.)');
    console.log('   3. Ensure dimensions are 1280x800 or 640x400');
    console.log('   4. Create before/after comparison images');
    console.log('   5. Add to Chrome Web Store listing\n');
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
  } finally {
    await context.close();
    // Clean up temp profile
    if (fs.existsSync(userDataDir)) {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  }
}

captureScreenshots().catch(console.error);
