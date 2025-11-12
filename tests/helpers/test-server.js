// tests/helpers/test-server.js
// Simple HTTP server for testing

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let server = null;
let serverPort = null;

export async function startTestServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      // Add a small delay to avoid race condition with Playwright's event listeners
      setTimeout(() => {
        // Serve test images from /images/, /trump_test_set/ (legacy), or /test-data/
        if (req.url.startsWith('/images/') || req.url.startsWith('/trump_test_set/') || req.url.startsWith('/test-data/')) {
          const imagePath = path.join(__dirname, '..', 'fixtures', req.url);

          if (fs.existsSync(imagePath)) {
            const ext = path.extname(imagePath).toLowerCase();
            const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';

            res.writeHead(200, {
              'Content-Type': contentType,
              'Access-Control-Allow-Origin': '*',
            });
            fs.createReadStream(imagePath).pipe(res);
            return;
          }
        }

        // Serve test page HTML (test-page.html and performance-test-*.html)
        if (
          req.url === '/' ||
          req.url === '/test-page.html' ||
          req.url.startsWith('/performance-test-')
        ) {
          let htmlFileName = req.url === '/' ? 'test-page.html' : req.url.substring(1);
          const testPagePath = path.join(__dirname, '..', 'fixtures', 'test-pages', htmlFileName);

          if (fs.existsSync(testPagePath)) {
            // Read and modify the HTML to use HTTP URLs instead of file:// URLs
            let html = fs.readFileSync(testPagePath, 'utf-8');

            // Replace relative image paths with absolute HTTP paths
            html = html.replace(/src="\/images\//g, `src="http://localhost:${serverPort}/images/`);
            html = html.replace(/src="\/trump_test_set\//g, `src="http://localhost:${serverPort}/trump_test_set/`);
            html = html.replace(/src="\/test-data\//g, `src="http://localhost:${serverPort}/test-data/`);

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
          }
        }

        // Default response
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Test Page</title>
</head>
<body>
  <h1>Test Page for Face Block Extension</h1>
  <div id="content"></div>
</body>
</html>
        `);
      }, 100); // 100ms delay
    });

    // Find an available port
    server.listen(0, 'localhost', () => {
      serverPort = server.address().port;
      console.log(`Test server started on http://localhost:${serverPort}`);
      resolve(`http://localhost:${serverPort}`);
    });

    server.on('error', reject);
  });
}

export async function stopTestServer() {
  return new Promise(resolve => {
    if (server) {
      server.close(() => {
        console.log('Test server stopped');
        server = null;
        serverPort = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}
