#!/usr/bin/env node
/**
 * Generate performance test HTML pages with Trump test images
 * Usage: node generate-performance-pages.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get Trump test images
const trumpSourceDir = path.join(__dirname, '..', 'test-data', 'trump', 'source');
const trumpImages = fs.readdirSync(trumpSourceDir)
  .filter(f => f.endsWith('.jpg') || f.endsWith('.png'))
  .map(f => `/test-data/trump/source/${f}`);

console.log(`Found ${trumpImages.length} Trump images`);

if (trumpImages.length === 0) {
  console.error('No Trump test images found! Run: cd tests/fixtures/generators/image-curator && ./curate_trump_images.sh');
  process.exit(1);
}

// Function to generate HTML for a given number of images
function generateHTML(imageCount) {
  // Create image tags by repeating the available Trump images
  let imageHTML = '';
  for (let i = 0; i < imageCount; i++) {
    const imageSrc = trumpImages[i % trumpImages.length];
    imageHTML += `            <img src="${imageSrc}" alt="Trump ${i + 1}" class="test-image" id="img-${i + 1}">\n`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test - ${imageCount} Images</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #666;
            padding-bottom: 10px;
        }
        .info {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .image-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            padding: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .test-image {
            width: 100%;
            height: 200px;
            object-fit: cover;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        #status {
            padding: 10px;
            background: #e8f4f8;
            border-radius: 4px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    <h1>Face Block Performance Test - ${imageCount} Images</h1>

    <div class="info">
        <p><strong>Test Configuration:</strong></p>
        <ul>
            <li>Total Images: ${imageCount}</li>
            <li>Image Source: Trump test set (cycling through ${trumpImages.length} unique images)</li>
            <li>Purpose: Measure face detection and blocking performance</li>
        </ul>
        <div id="status">Page loaded. Extension processing images...</div>
    </div>

    <div class="image-grid">
${imageHTML}    </div>

    <script>
        // Performance tracking
        const startTime = performance.now();
        let processedCount = 0;

        // Log when page is fully loaded
        window.addEventListener('load', () => {
            const loadTime = performance.now() - startTime;
            console.log(\`Page loaded with ${imageCount} images in \${loadTime.toFixed(2)}ms\`);

            // Update status
            document.getElementById('status').innerHTML =
                \`Page loaded in \${loadTime.toFixed(0)}ms. Extension processing ${imageCount} images...\`;

            // Count how many images are actually loaded
            const imgs = document.querySelectorAll('.test-image');
            let loadedImages = 0;
            imgs.forEach(img => {
                if (img.complete) loadedImages++;
            });
            console.log(\`\${loadedImages}/\${imgs.length} images loaded\`);
        });

        // Listen for extension processing
        document.addEventListener('faceBlockProcessingComplete', (e) => {
            const totalTime = performance.now() - startTime;
            console.log(\`Extension processing complete in \${totalTime.toFixed(2)}ms\`);
            console.log(\`Processed: \${e.detail.processed}, Blocked: \${e.detail.blocked}\`);

            document.getElementById('status').innerHTML =
                \`✅ Complete! Processed \${e.detail.processed} images in \${totalTime.toFixed(0)}ms (Blocked: \${e.detail.blocked})\`;
        });
    </script>
</body>
</html>
`;
}

// Generate all performance test pages
const configs = [50, 100, 200, 500];

for (const count of configs) {
  const filename = path.join(__dirname, `performance-test-${count}.html`);
  const html = generateHTML(count);
  fs.writeFileSync(filename, html);
  console.log(`✓ Generated ${filename} (${count} images)`);
}

console.log('\n✅ All performance test pages generated successfully!');
