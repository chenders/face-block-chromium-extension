// scripts/generate-performance-test-page.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generates an HTML test page with a specified number of images
 * @param {number} imageCount - Number of images to include
 * @param {string} outputPath - Path to save the HTML file
 */
function generatePerformanceTestPage(imageCount, outputPath) {
  const testImages = [
    'albert_einstein/einstein1.jpg',
    'albert_einstein/einstein2.jpg',
    'albert_einstein/einstein3.jpg',
    'albert_einstein/einstein4.jpg',
    'carl_sagan/carl_sagan1.jpg',
    'carl_sagan/carl_sagan2.jpg',
    'carl_sagan/carl_sagan3.jpg',
    'marilyn_monroe.jpg',
    'steven_pruitt.jpg',
  ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Performance Test - ${imageCount} Images</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            max-width: 1400px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #666;
            padding-bottom: 10px;
        }
        .stats {
            background: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .stats strong {
            color: #e74c3c;
        }
        .image-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }
        .image-container {
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
            background: #fff;
        }
        .image-container img {
            width: 100%;
            height: 200px;
            object-fit: cover;
            display: block;
        }
        .image-label {
            padding: 8px;
            font-size: 12px;
            color: #666;
            background: #fafafa;
            border-top: 1px solid #eee;
        }
        #performance-stats {
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.95);
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            min-width: 250px;
            z-index: 1000;
        }
        #performance-stats h3 {
            margin: 0 0 10px 0;
            color: #333;
            font-size: 16px;
        }
        #performance-stats .stat-row {
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 14px;
        }
        #performance-stats .stat-label {
            color: #666;
        }
        #performance-stats .stat-value {
            color: #e74c3c;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div id="performance-stats">
        <h3>⏱️ Performance Stats</h3>
        <div class="stat-row">
            <span class="stat-label">Total Images:</span>
            <span class="stat-value" id="stat-total">0</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Processed:</span>
            <span class="stat-value" id="stat-processed">0</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Blocked:</span>
            <span class="stat-value" id="stat-blocked">0</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Processing Time:</span>
            <span class="stat-value" id="stat-time">-</span>
        </div>
        <div class="stat-row">
            <span class="stat-label">Avg per Image:</span>
            <span class="stat-value" id="stat-avg">-</span>
        </div>
    </div>

    <h1>Performance Test Page</h1>

    <div class="stats">
        <p><strong>${imageCount} images</strong> on this page for performance testing.</p>
        <p>Watch the performance stats in the top-right corner.</p>
    </div>

    <div class="image-grid" id="image-grid">
${generateImageElements(imageCount, testImages)}
    </div>

    <script>
        const startTime = performance.now();
        const totalImages = ${imageCount};

        document.getElementById('stat-total').textContent = totalImages;

        // Monitor for processed images
        const observer = new MutationObserver(() => {
            updateStats();
        });

        // Observe all images
        const images = document.querySelectorAll('.test-image');
        images.forEach(img => {
            observer.observe(img, {
                attributes: true,
                attributeFilter: ['data-face-block-processed', 'alt', 'src']
            });
        });

        function updateStats() {
            const processedImages = document.querySelectorAll('[data-face-block-processed="true"]');
            const blockedImages = document.querySelectorAll('[alt="Image blocked by Face Block Chromium Extension"]');

            const processed = processedImages.length;
            const blocked = blockedImages.length;

            document.getElementById('stat-processed').textContent = processed;
            document.getElementById('stat-blocked').textContent = blocked;

            if (processed === totalImages) {
                const endTime = performance.now();
                const totalTime = ((endTime - startTime) / 1000).toFixed(2);
                const avgTime = ((endTime - startTime) / totalImages).toFixed(0);

                document.getElementById('stat-time').textContent = totalTime + 's';
                document.getElementById('stat-avg').textContent = avgTime + 'ms';

                console.log('PERFORMANCE_COMPLETE:', {
                    totalImages,
                    processed,
                    blocked,
                    totalTimeSeconds: totalTime,
                    avgTimePerImageMs: avgTime
                });
            }
        }

        // Initial update
        setTimeout(updateStats, 100);

        // Periodic updates
        const interval = setInterval(() => {
            updateStats();
            if (document.querySelectorAll('[data-face-block-processed="true"]').length === totalImages) {
                clearInterval(interval);
            }
        }, 500);

        console.log('Test page loaded with', totalImages, 'images');
    </script>
</body>
</html>`;

  fs.writeFileSync(outputPath, html);
  console.log(`Generated test page with ${imageCount} images: ${outputPath}`);
}

function generateImageElements(count, testImages) {
  let html = '';
  for (let i = 0; i < count; i++) {
    const imageIndex = i % testImages.length;
    const imagePath = testImages[imageIndex];
    const imageId = `perf-img-${i}`;

    html += `        <div class="image-container">
            <img class="test-image"
                 id="${imageId}"
                 src="/images/${imagePath}"
                 alt="Test image ${i}">
            <div class="image-label">#${i + 1}</div>
        </div>\n`;
  }
  return html;
}

// Generate test pages with different image counts
const fixturesDir = path.join(__dirname, '..', 'tests', 'fixtures');
const counts = [50, 100, 200, 500];

console.log('Generating performance test pages...\n');

counts.forEach(count => {
  const outputPath = path.join(fixturesDir, `performance-test-${count}.html`);
  generatePerformanceTestPage(count, outputPath);
});

console.log('\nPerformance test pages generated successfully!');
console.log('Location: tests/fixtures/');
console.log('Files:', counts.map(n => `performance-test-${n}.html`).join(', '));
