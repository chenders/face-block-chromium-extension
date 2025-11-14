#!/usr/bin/env python3
"""
Web-based Interactive Image Review Tool
========================================
Review and approve/reject curated images via a web interface.

Usage:
    python web_review_curated_images.py --input test-data/trump/pending_review --output test-data/trump
"""

import os
import sys
import argparse
import json
import subprocess
import tempfile
import shutil
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import threading
import time
import platform


class ReviewServer(BaseHTTPRequestHandler):
    """HTTP server for image review interface."""

    # Class variables shared across requests
    pending_dir = None
    output_base = None
    image_files = []
    current_index = 0
    stats = {'kept': 0, 'rejected': 0}

    def do_GET(self):
        """Handle GET requests."""
        parsed_path = urlparse(self.path)

        if parsed_path.path == '/':
            # Serve main HTML interface
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(self.get_html_interface().encode())

        elif parsed_path.path == '/api/current':
            # Get current image info
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()

            if ReviewServer.current_index < len(ReviewServer.image_files):
                image_path = ReviewServer.image_files[ReviewServer.current_index]
                response = {
                    'index': ReviewServer.current_index,
                    'total': len(ReviewServer.image_files),
                    'filename': image_path.name,
                    'stats': ReviewServer.stats,
                    'remaining': len(ReviewServer.image_files) - ReviewServer.current_index
                }
            else:
                response = {
                    'complete': True,
                    'stats': ReviewServer.stats
                }

            self.wfile.write(json.dumps(response).encode())

        elif parsed_path.path == '/api/image':
            # Serve current image
            if ReviewServer.current_index < len(ReviewServer.image_files):
                image_path = ReviewServer.image_files[ReviewServer.current_index]
                try:
                    with open(image_path, 'rb') as f:
                        image_data = f.read()

                    self.send_response(200)
                    self.send_header('Content-type', 'image/jpeg')
                    self.end_headers()
                    self.wfile.write(image_data)
                except Exception as e:
                    self.send_error(404, f"Image not found: {str(e)}")
            else:
                self.send_error(404, "No more images")

        elif parsed_path.path == '/api/keep':
            # Keep current image and move to next
            self.handle_keep()

        elif parsed_path.path == '/api/reject':
            # Reject current image and move to next
            self.handle_reject()

        elif parsed_path.path == '/api/accept-all':
            # Accept all remaining images
            self.handle_accept_all()

        else:
            self.send_error(404, "Not found")

    def handle_keep(self):
        """Keep current image and move to approved directory."""
        if ReviewServer.current_index < len(ReviewServer.image_files):
            image_path = ReviewServer.image_files[ReviewServer.current_index]
            approved_dir = ReviewServer.output_base / 'source_images'
            approved_dir.mkdir(parents=True, exist_ok=True)

            dest_path = approved_dir / image_path.name
            image_path.rename(dest_path)

            ReviewServer.stats['kept'] += 1
            ReviewServer.current_index += 1

            print(f"✓ Kept: {image_path.name}")

        self.send_json_response({'success': True})

    def handle_reject(self):
        """Reject current image and move to rejected directory."""
        if ReviewServer.current_index < len(ReviewServer.image_files):
            image_path = ReviewServer.image_files[ReviewServer.current_index]
            rejected_dir = ReviewServer.output_base / 'rejected'
            rejected_dir.mkdir(parents=True, exist_ok=True)

            dest_path = rejected_dir / image_path.name
            image_path.rename(dest_path)

            ReviewServer.stats['rejected'] += 1
            ReviewServer.current_index += 1

            print(f"✗ Rejected: {image_path.name}")

        self.send_json_response({'success': True})

    def handle_accept_all(self):
        """Accept all remaining images."""
        approved_dir = ReviewServer.output_base / 'source_images'
        approved_dir.mkdir(parents=True, exist_ok=True)

        remaining = len(ReviewServer.image_files) - ReviewServer.current_index

        while ReviewServer.current_index < len(ReviewServer.image_files):
            image_path = ReviewServer.image_files[ReviewServer.current_index]
            dest_path = approved_dir / image_path.name
            image_path.rename(dest_path)
            ReviewServer.stats['kept'] += 1
            ReviewServer.current_index += 1

        print(f"✓ Accepted all {remaining} remaining images")

        self.send_json_response({'success': True, 'accepted': remaining})

    def send_json_response(self, data):
        """Send JSON response."""
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass

    @staticmethod
    def get_html_interface():
        """Generate HTML interface for image review."""
        return """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Review Tool</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #1a1a1a;
            color: #fff;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow: hidden;
        }

        .header {
            background: #2a2a2a;
            padding: 20px;
            border-bottom: 2px solid #3a3a3a;
        }

        .header h1 {
            font-size: 24px;
            margin-bottom: 10px;
        }

        .progress-bar {
            background: #3a3a3a;
            height: 8px;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
        }

        .progress-fill {
            background: linear-gradient(90deg, #4CAF50, #45a049);
            height: 100%;
            transition: width 0.3s ease;
        }

        .stats {
            display: flex;
            gap: 20px;
            font-size: 14px;
            color: #aaa;
        }

        .stats span {
            font-weight: bold;
            color: #fff;
        }

        .main-content {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            overflow: auto;
        }

        .image-container {
            max-width: 90%;
            max-height: 70vh;
            margin-bottom: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            border-radius: 8px;
            overflow: hidden;
        }

        .image-container img {
            max-width: 100%;
            max-height: 70vh;
            display: block;
        }

        .filename {
            font-size: 14px;
            color: #888;
            margin-bottom: 20px;
            font-family: monospace;
        }

        .controls {
            display: flex;
            gap: 20px;
            align-items: center;
        }

        button {
            padding: 15px 40px;
            font-size: 16px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        button:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.3);
        }

        button:active {
            transform: translateY(0);
        }

        .btn-keep {
            background: #4CAF50;
            color: white;
        }

        .btn-keep:hover {
            background: #45a049;
        }

        .btn-reject {
            background: #f44336;
            color: white;
        }

        .btn-reject:hover {
            background: #da190b;
        }

        .btn-accept-all {
            background: #2196F3;
            color: white;
        }

        .btn-accept-all:hover {
            background: #0b7dda;
        }

        .complete-message {
            text-align: center;
            padding: 60px;
        }

        .complete-message h2 {
            font-size: 48px;
            margin-bottom: 20px;
        }

        .complete-message p {
            font-size: 18px;
            color: #aaa;
        }

        .loading {
            text-align: center;
            padding: 60px;
            font-size: 18px;
            color: #aaa;
        }

        .keyboard-hint {
            font-size: 12px;
            color: #666;
            margin-top: 20px;
            text-align: center;
        }

        .keyboard-hint kbd {
            background: #3a3a3a;
            padding: 3px 8px;
            border-radius: 4px;
            font-family: monospace;
            margin: 0 5px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Image Review Tool</h1>
        <div class="progress-bar">
            <div class="progress-fill" id="progressFill" style="width: 0%"></div>
        </div>
        <div class="stats">
            <div>Progress: <span id="currentIndex">0</span> / <span id="totalImages">0</span> (<span id="percentage">0</span>%)</div>
            <div>Remaining: <span id="remaining">0</span></div>
            <div>Kept: <span id="kept">0</span></div>
            <div>Rejected: <span id="rejected">0</span></div>
        </div>
    </div>

    <div class="main-content" id="mainContent">
        <div class="loading">Loading...</div>
    </div>

    <script>
        let autoAcceptOnClose = true;

        async function loadCurrentImage() {
            try {
                const response = await fetch('/api/current');
                const data = await response.json();

                if (data.complete) {
                    showComplete(data.stats);
                    autoAcceptOnClose = false;
                    return;
                }

                updateStats(data);
                showImage(data);
            } catch (error) {
                console.error('Error loading image:', error);
            }
        }

        function updateStats(data) {
            document.getElementById('currentIndex').textContent = data.index + 1;
            document.getElementById('totalImages').textContent = data.total;
            document.getElementById('remaining').textContent = data.remaining;
            document.getElementById('kept').textContent = data.stats.kept;
            document.getElementById('rejected').textContent = data.stats.rejected;

            const percentage = Math.round(((data.index) / data.total) * 100);
            document.getElementById('percentage').textContent = percentage;
            document.getElementById('progressFill').style.width = percentage + '%';
        }

        function showImage(data) {
            const mainContent = document.getElementById('mainContent');
            mainContent.innerHTML = `
                <div class="image-container">
                    <img src="/api/image?t=${Date.now()}" alt="${data.filename}">
                </div>
                <div class="filename">${data.filename}</div>
                <div class="controls">
                    <button class="btn-reject" onclick="rejectImage()">Reject</button>
                    <button class="btn-keep" onclick="keepImage()">Keep</button>
                    <button class="btn-accept-all" onclick="acceptAll()">Accept All</button>
                </div>
                <div class="keyboard-hint">
                    Keyboard: <kbd>K</kbd> Keep · <kbd>R</kbd> Reject · <kbd>A</kbd> Accept All
                </div>
            `;
        }

        function showComplete(stats) {
            const mainContent = document.getElementById('mainContent');
            mainContent.innerHTML = `
                <div class="complete-message">
                    <h2>✓ Review Complete!</h2>
                    <p>Kept: ${stats.kept} · Rejected: ${stats.rejected}</p>
                    <p style="margin-top: 20px;">You can close this window now.</p>
                </div>
            `;
        }

        async function keepImage() {
            await fetch('/api/keep');
            await loadCurrentImage();
        }

        async function rejectImage() {
            await fetch('/api/reject');
            await loadCurrentImage();
        }

        async function acceptAll() {
            if (confirm('Accept all remaining images?')) {
                await fetch('/api/accept-all');
                await loadCurrentImage();
            }
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'k' || e.key === 'K') {
                keepImage();
            } else if (e.key === 'r' || e.key === 'R') {
                rejectImage();
            } else if (e.key === 'a' || e.key === 'A') {
                acceptAll();
            }
        });

        // Handle window close - accept remaining images
        window.addEventListener('beforeunload', async (e) => {
            if (autoAcceptOnClose) {
                // Use synchronous XHR for beforeunload (fetch may not complete)
                const xhr = new XMLHttpRequest();
                xhr.open('GET', '/api/accept-all', false);
                xhr.send();
            }
        });

        // Initial load
        loadCurrentImage();
    </script>
</body>
</html>
"""


def review_images_web(pending_dir: Path, output_base: Path, port: int = 8765):
    """Launch web-based review interface."""
    pending_dir = Path(pending_dir)
    output_base = Path(output_base)

    # Find all images
    image_files = sorted(list(pending_dir.glob('*.jpg')) + list(pending_dir.glob('*.png')))

    if not image_files:
        print("No images found in pending_review directory.")
        return 0

    print(f"\nFound {len(image_files)} images to review")
    print(f"Starting web server on http://localhost:{port}")
    print(f"Opening clean browser (no extensions) to prevent face blocking...")
    print(f"\nInstructions:")
    print(f"   - Click 'Keep' to approve an image")
    print(f"   - Click 'Reject' to remove an image")
    print(f"   - Click 'Accept All' to approve all remaining images")
    print(f"   - Close the browser window to auto-accept remaining images")
    print(f"   - Use keyboard shortcuts: K (keep), R (reject), A (accept all)")
    print(f"\nPress Ctrl+C to stop the server\n")

    # Set up server state
    ReviewServer.pending_dir = pending_dir
    ReviewServer.output_base = output_base
    ReviewServer.image_files = image_files
    ReviewServer.current_index = 0
    ReviewServer.stats = {'kept': 0, 'rejected': 0}

    # Start server
    server = HTTPServer(('localhost', port), ReviewServer)

    # Create temporary profile directory for clean browser
    temp_profile = tempfile.mkdtemp(prefix='face-block-review-')

    # Open browser with clean profile (no extensions)
    def open_browser():
        time.sleep(0.5)
        url = f'http://localhost:{port}'

        # Determine Chrome executable path based on platform
        chrome_paths = {
            'Darwin': [
                '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                '/Applications/Chromium.app/Contents/MacOS/Chromium',
            ],
            'Linux': [
                '/usr/bin/google-chrome',
                '/usr/bin/chromium-browser',
                '/usr/bin/chromium',
            ],
            'Windows': [
                'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            ]
        }

        system = platform.system()
        chrome_path = None

        for path in chrome_paths.get(system, []):
            if os.path.exists(path):
                chrome_path = path
                break

        if chrome_path:
            try:
                subprocess.Popen([
                    chrome_path,
                    f'--user-data-dir={temp_profile}',
                    '--no-first-run',
                    '--no-default-browser-check',
                    url
                ])
                print(f"Opened clean browser instance (no extensions)")
            except Exception as e:
                print(f"Warning: Could not launch Chrome with clean profile: {e}")
                print(f"Please open manually: {url}")
        else:
            print(f"Chrome not found. Please open manually: {url}")

    threading.Thread(target=open_browser, daemon=True).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n\nServer stopped by user")

        # Auto-accept remaining images
        remaining = len(image_files) - ReviewServer.current_index
        if remaining > 0:
            print(f"\n✓ Auto-accepting {remaining} remaining images...")
            approved_dir = output_base / 'source_images'
            approved_dir.mkdir(parents=True, exist_ok=True)

            while ReviewServer.current_index < len(image_files):
                image_path = image_files[ReviewServer.current_index]
                dest_path = approved_dir / image_path.name
                if image_path.exists():
                    image_path.rename(dest_path)
                ReviewServer.stats['kept'] += 1
                ReviewServer.current_index += 1

        print(f"\n{'='*60}")
        print(f"REVIEW SUMMARY")
        print(f"{'='*60}")
        print(f"Reviewed: {ReviewServer.current_index}/{len(image_files)}")
        print(f"  Kept: {ReviewServer.stats['kept']}")
        print(f"  Rejected: {ReviewServer.stats['rejected']}")
        print(f"{'='*60}")

        # Clean up temporary profile
        try:
            shutil.rmtree(temp_profile, ignore_errors=True)
        except:
            pass

        return 0


def main():
    parser = argparse.ArgumentParser(description='Web-based image review tool')
    parser.add_argument('--input', type=str, required=True,
                       help='Path to pending_review directory')
    parser.add_argument('--output', type=str, required=True,
                       help='Base output directory')
    parser.add_argument('--port', type=int, default=8765,
                       help='Port for web server (default: 8765)')

    args = parser.parse_args()

    pending_dir = Path(args.input)
    output_base = Path(args.output)

    if not pending_dir.exists():
        print(f"Error: Directory not found: {pending_dir}")
        return 1

    return review_images_web(pending_dir, output_base, args.port)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(0)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
