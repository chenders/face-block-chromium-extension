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
        // Serve test images
        if (req.url.startsWith('/images/')) {
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

        // Serve test page HTML
        if (req.url === '/' || req.url === '/test-page.html') {
          const testPagePath = path.join(__dirname, '..', 'fixtures', 'test-page.html');

          // Read and modify the HTML to use HTTP URLs instead of file:// URLs
          let html = fs.readFileSync(testPagePath, 'utf-8');

          // Replace relative image paths with absolute HTTP paths
          html = html.replace(/src="images\//g, `src="http://localhost:${serverPort}/images/`);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(html);
          return;
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
