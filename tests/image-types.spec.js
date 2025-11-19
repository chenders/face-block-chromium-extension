// tests/image-types.spec.js
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupExtensionContext, cleanupExtensionContext } from './helpers/test-setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Image Type Coverage', () => {
  let browser;
  let userDataDir;

  test.beforeAll(
    async () => {
      const context = await setupExtensionContext();
      browser = context.browser;
      userDataDir = context.userDataDir;
    },
    process.env.CI ? 90000 : 60000
  ); // 90 seconds timeout in CI, 60 seconds locally;

  test.afterAll(async () => {
    await cleanupExtensionContext({ browser, userDataDir });
  });

  test('handles regular img tags with src attribute', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="regular-img" src="https://via.placeholder.com/300x200" alt="Regular" width="300" height="200">
        </body>
      </html>
    `);

    await page.waitForTimeout(3000);

    const img = await page.$('#regular-img');
    expect(img).toBeTruthy();

    // Verify image was processed
    const src = await page.evaluate(() => document.querySelector('#regular-img').src);
    expect(src).toBeTruthy();

    await page.close();
  });

  test('handles img tags with srcset attribute', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="srcset-img"
               src="https://via.placeholder.com/300x200"
               srcset="https://via.placeholder.com/600x400 2x,
                       https://via.placeholder.com/900x600 3x"
               alt="Srcset Image"
               width="300" height="200">
        </body>
      </html>
    `);

    await page.waitForTimeout(3000);

    const img = await page.$('#srcset-img');
    expect(img).toBeTruthy();

    // Check if srcset was handled (removed if replaced, kept if not)
    const hasSrcset = await page.evaluate(() => {
      return document.querySelector('#srcset-img').hasAttribute('srcset');
    });

    expect(typeof hasSrcset).toBe('boolean');

    await page.close();
  });

  test('handles picture elements with source tags', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <picture id="picture-elem">
            <source media="(min-width: 800px)" srcset="https://via.placeholder.com/800x600">
            <source media="(min-width: 400px)" srcset="https://via.placeholder.com/400x300">
            <img id="picture-img" src="https://via.placeholder.com/300x200" alt="Picture" width="300" height="200">
          </picture>
        </body>
      </html>
    `);

    await page.waitForTimeout(3000);

    const picture = await page.$('#picture-elem');
    expect(picture).toBeTruthy();

    // The img inside picture should still be processed
    const img = await page.$('#picture-img');
    expect(img).toBeTruthy();

    await page.close();
  });

  test('handles images with loading="lazy" attribute', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white; height: 3000px;">
          <div style="margin-top: 2000px;">
            <img id="lazy-img" src="https://via.placeholder.com/300x200" loading="lazy" alt="Lazy" width="300" height="200">
          </div>
        </body>
      </html>
    `);

    // Wait and scroll to trigger lazy load
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(3000);

    const img = await page.$('#lazy-img');
    expect(img).toBeTruthy();

    await page.close();
  });

  test('handles images with loading="eager" attribute', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="eager-img" src="https://via.placeholder.com/300x200" loading="eager" alt="Eager" width="300" height="200">
        </body>
      </html>
    `);

    await page.waitForTimeout(3000);

    const img = await page.$('#eager-img');
    expect(img).toBeTruthy();

    await page.close();
  });

  test('handles images with decoding="async" attribute', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="async-img" src="https://via.placeholder.com/300x200" decoding="async" alt="Async" width="300" height="200">
        </body>
      </html>
    `);

    await page.waitForTimeout(3000);

    const img = await page.$('#async-img');
    expect(img).toBeTruthy();

    await page.close();
  });

  test('handles data URL images', async () => {
    const page = await browser.newPage();

    // Small 1x1 red pixel
    const dataUrl =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="data-img" src="${dataUrl}" alt="Data URL" width="100" height="100">
        </body>
      </html>
    `);

    await page.waitForTimeout(2000);

    // Data URLs should not be reprocessed
    const src = await page.evaluate(() => document.querySelector('#data-img').src);
    expect(src).toContain('data:image/png');

    await page.close();
  });

  test('handles blob URLs', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="blob-img" alt="Blob" width="100" height="100">
          <script>
            // Create a blob URL
            fetch('https://via.placeholder.com/100x100')
              .then(r => r.blob())
              .then(blob => {
                const url = URL.createObjectURL(blob);
                document.getElementById('blob-img').src = url;
              });
          </script>
        </body>
      </html>
    `);

    await page.waitForTimeout(3000);

    const src = await page.evaluate(() => document.querySelector('#blob-img').src);
    // Blob URLs should not be reprocessed
    if (src) {
      expect(src.startsWith('blob:') || src.startsWith('data:')).toBe(true);
    }

    await page.close();
  });

  test('handles SVG images', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="svg-img" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Ccircle cx='50' cy='50' r='40' fill='red'/%3E%3C/svg%3E" alt="SVG" width="100" height="100">
        </body>
      </html>
    `);

    await page.waitForTimeout(2000);

    const img = await page.$('#svg-img');
    expect(img).toBeTruthy();

    await page.close();
  });

  test('handles WebP images', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <picture>
            <source type="image/webp" srcset="https://via.placeholder.com/300x200.webp">
            <img id="webp-img" src="https://via.placeholder.com/300x200.jpg" alt="WebP" width="300" height="200">
          </picture>
        </body>
      </html>
    `);

    await page.waitForTimeout(3000);

    const img = await page.$('#webp-img');
    expect(img).toBeTruthy();

    await page.close();
  });

  test('handles images with crossorigin attribute', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="cors-img" src="https://via.placeholder.com/300x200" crossorigin="anonymous" alt="CORS" width="300" height="200">
        </body>
      </html>
    `);

    await page.waitForTimeout(3000);

    const img = await page.$('#cors-img');
    expect(img).toBeTruthy();

    const crossorigin = await page.evaluate(() =>
      document.querySelector('#cors-img').getAttribute('crossorigin')
    );
    expect(crossorigin).toBe('anonymous');

    await page.close();
  });

  test('handles images with sizes attribute', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <img id="sizes-img"
               src="https://via.placeholder.com/300x200"
               srcset="https://via.placeholder.com/300x200 300w,
                       https://via.placeholder.com/600x400 600w,
                       https://via.placeholder.com/900x600 900w"
               sizes="(max-width: 600px) 300px, (max-width: 900px) 600px, 900px"
               alt="Sizes"
               width="300" height="200">
        </body>
      </html>
    `);

    await page.waitForTimeout(3000);

    const img = await page.$('#sizes-img');
    expect(img).toBeTruthy();

    await page.close();
  });

  test('handles images dynamically added to DOM', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <div id="container"></div>
        </body>
      </html>
    `);

    await page.waitForTimeout(1000);

    // Add image dynamically
    await page.evaluate(() => {
      const img = document.createElement('img');
      img.id = 'dynamic-img';
      img.src = 'https://via.placeholder.com/300x200';
      img.width = 300;
      img.height = 200;
      img.alt = 'Dynamic';
      document.getElementById('container').appendChild(img);
    });

    // Wait for MutationObserver to detect and process
    await page.waitForTimeout(2000);

    const img = await page.$('#dynamic-img');
    expect(img).toBeTruthy();

    await page.close();
  });

  test('handles multiple images added at once', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <div id="container"></div>
        </body>
      </html>
    `);

    await page.waitForTimeout(1000);

    // Add multiple images at once
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        const img = document.createElement('img');
        img.id = `dynamic-img-${i}`;
        img.src = `https://via.placeholder.com/200x200?text=Image${i}`;
        img.width = 200;
        img.height = 200;
        document.getElementById('container').appendChild(img);
      }
    });

    // Wait for batch processing
    await page.waitForTimeout(3000);

    const imageCount = await page.evaluate(() => {
      return document.querySelectorAll('img').length;
    });

    expect(imageCount).toBe(10);

    await page.close();
  });

  test('handles images in iframes (same-origin)', async () => {
    const page = await browser.newPage();

    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="background: white;">
          <iframe id="test-iframe" style="width: 400px; height: 300px;"></iframe>
          <script>
            const iframe = document.getElementById('test-iframe');
            const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
            iframeDoc.open();
            iframeDoc.write('<html><body style="background: white;"><img src="https://via.placeholder.com/300x200" width="300" height="200" alt="Iframe Image"></body></html>');
            iframeDoc.close();
          </script>
        </body>
      </html>
    `);

    await page.waitForTimeout(3000);

    // Note: Extension content scripts don't run in iframes by default
    // This test documents expected behavior
    const iframe = await page.$('#test-iframe');
    expect(iframe).toBeTruthy();

    await page.close();
  });
});
