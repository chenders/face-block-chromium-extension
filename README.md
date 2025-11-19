# Face Block Browser Extension

[![CI](https://github.com/chenders/face-block-chromium-extension/workflows/CI/badge.svg)](https://github.com/chenders/face-block-chromium-extension/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
![Chrome](https://img.shields.io/badge/Chrome-✓-brightgreen)
![Firefox](https://img.shields.io/badge/Firefox-✓-brightgreen)

A privacy-focused browser extension for Chrome and Firefox that automatically blocks images of specified people on web pages using client-side face recognition. Matched images are replaced with blank placeholders.

## Features

- **100% Local Processing** - All face recognition happens in your browser, no cloud services
- **Privacy First** - Face data stored as irreversible 128-dimensional mathematical descriptors
- **Smart Color Matching** - Replaced images blend seamlessly with page background colors
- **Multiple Reference Photos** - Upload 3-5 photos per person for better accuracy
- **Dynamic Content Support** - Automatically handles infinite scroll, SPAs, and lazy-loaded images
- **Seamless Experience** - Images briefly hidden during detection to prevent flashing

## Installation

### For Chrome

1. **Clone or download this repository:**
   ```bash
   git clone https://github.com/chenders/face-block-chromium-extension.git
   ```

2. **Build the extension:**
   ```bash
   npm install
   npm run build
   ```

3. **Load in Chrome:**
   - Open `chrome://extensions/`
   - Enable **"Developer mode"** (top right)
   - Click **"Load unpacked"**
   - Select the `.output/chrome-mv3` folder
   - Extension icon appears in toolbar

### For Firefox

1. **Clone or download this repository:**
   ```bash
   git clone https://github.com/chenders/face-block-chromium-extension.git
   ```

2. **Build the Firefox version:**
   ```bash
   npm install
   npm run build:firefox
   ```

3. **Load in Firefox:**
   - Open `about:debugging`
   - Click **"This Firefox"** (left sidebar)
   - Click **"Load Temporary Add-on"**
   - Navigate to `.output/firefox-mv2` folder
   - Select any file in that folder (e.g., `manifest.json`)
   - Extension icon appears in toolbar

   **Note:** Temporary add-ons in Firefox are removed when you close the browser. For permanent installation, the extension needs to be signed by Mozilla.

### Quick Setup

After installation in either browser:
1. Click extension icon
2. Enter person's name
3. Upload 3-5 clear photos of their face
4. Browse the web - matched images are automatically replaced

**Requirements:**
- Chrome 88+ or any Chromium-based browser (Edge, Brave, etc.)
- Firefox 121+ (for Manifest V2 support)

## Usage

### Adding People

1. Click the extension icon
2. Enter a name
3. Choose 3-5 clear, well-lit photos (different angles work best)
4. Click "Add Person"
5. Wait a few seconds for processing

### How It Works

When you visit a webpage:
1. Extension scans all `<img>` elements
2. Briefly hides each image while detecting faces
3. Detects faces using your selected detection mode (Fast, Thorough, or Hybrid)
4. Compares faces against your stored references
5. Replaces matches with color-matched placeholders that blend into the page background
6. Restores non-matching images immediately

Replaced images automatically match the surrounding background color with a subtle border for a seamless appearance. The brief hiding prevents any flash of the original image.

**Hybrid Mode**: For best results, the extension tries the fast TinyFaceDetector first. If no faces are found, it automatically retries with the more thorough SsdMobilenet detector, ensuring maximum coverage of both frontal and profile images.

### Settings

- **Face Detection Mode**: Choose detection method based on your needs
  - **Fast Mode (TinyFaceDetector)**: Fastest detection, best for frontal images. May miss profile views.
  - **Thorough Mode (SsdMobilenet)**: Slower, better at detecting profiles and angled faces. May miss some frontal images.
  - **Hybrid Mode (Recommended)**: Tries Fast mode first, falls back to Thorough if no faces found. Best overall coverage but uses more resources.

- **Match Threshold** (0.3-0.8): Controls matching strictness
  - **0.5-0.55**: Very strict (fewer false positives)
  - **0.6**: Default (recommended)
  - **0.65-0.75**: More lenient (catches more variations)

### Data Management

- **Export**: Backup face descriptors as JSON
- **Import**: Restore previously exported data
- **Clear All**: Delete all data (cannot be undone)

## Known Limitations

### CORS-Restricted Images
Some websites have strict security policies preventing image access. These images are **silently skipped** (browser security limitation, not a bug).

**Affected sites:** ESPN, Getty Images, some CDNs, authenticated content

### Not Supported
- CSS `background-image` properties
- Video frames (`<video>` elements)
- Animated GIFs (only first frame)
- Canvas-rendered content
- Very small faces (<50x50 pixels)

### Performance
- Pages with 100+ images: 3-5 seconds to process
- Each additional person: +10-20% processing time
- Desktop: ~50-200ms per image

**Best performance on:** Wikipedia, news sites, general web browsing

## Privacy & Security

### What Makes It Private?

- **Zero data transmission** - Nothing ever leaves your computer
- **Irreversible descriptors** - Photos converted to mathematical vectors that can't reconstruct the original
- **Local storage only** - Data in browser's IndexedDB (~512 bytes per photo)
- **No tracking** - No analytics or telemetry
- **Open source** - All code is auditable

### What's Stored?

| Data | Location | Size | Can Reconstruct Photo? |
|------|----------|------|----------------------|
| Face descriptors | IndexedDB | ~512 bytes/photo | ❌ No |
| Person names | IndexedDB | ~20 bytes/person | N/A |
| Settings | chrome.storage | ~4 bytes | N/A |
| **Original photos** | ❌ Never stored | 0 bytes | N/A |

### GDPR Compliance

- ✅ All processing happens locally on your device
- ✅ No data controllers or third parties involved
- ✅ Full control: export, import, or delete anytime
- ✅ Operates with explicit consent

## Troubleshooting

### No Faces Detected

**Possible causes:**
- Image is CORS-restricted (check console for CORS errors)
- Face too small (<50x50 pixels)
- Poor lighting or low quality
- Face obscured (sunglasses, mask, etc.)
- Profile or extreme angle (>45° from camera)

**Solutions:**
- Use clear, well-lit reference photos
- Try different photos from various angles
- Switch to **Hybrid Mode** or **Thorough Mode** in settings for better profile detection
- Check browser console (F12) for errors

### Images Not Being Replaced

**Check:**
1. Do you have people added? (Click icon → "Stored People")
2. Check console logs for distance values:
   ```
   Face 1: PersonName (distance: 0.650, threshold: 0.600)
   ```
3. If distance > threshold: Increase "Match Threshold" and refresh

**Debug:**
- Open DevTools (F12) → Console tab
- Look for "Face Blur Extension" messages
- Check if images are being skipped due to CORS

### Performance Issues

**If extension is slow:**
- Reduce number of blocked people
- Use fewer reference photos (3-5 is optimal)
- Close unused tabs
- Expected: 1-3 seconds for 50 images is normal

## Technical Details

### Core Technologies

- **Face Recognition:** [face-api.js](https://github.com/justadudewhohacks/face-api.js) (TensorFlow.js)
- **Detection Models:**
  - TinyFaceDetector (~190KB) - Fast, optimized for frontal faces
  - SsdMobilenetv1 (~5.4MB) - Thorough, better for profiles and angled faces
- **Recognition Model:** FaceNet embeddings (128-dimensional)
- **Storage:** IndexedDB + chrome.storage.sync
- **Manifest:** Version 3

### Browser Compatibility

- **Chrome:** Uses Manifest V3 with offscreen documents for face detection
- **Firefox:** Uses Manifest V2 with direct background page processing
- **Architecture:** Built with WXT framework for automatic cross-browser adaptation

### Development

```bash
# Install dependencies
npm install

# Development mode
npm run dev           # Chrome development
npm run dev:firefox   # Firefox development

# Production builds
npm run build         # Build for Chrome
npm run build:firefox # Build for Firefox
npm run build:all     # Build for both browsers

# Package for distribution
npm run zip           # Create Chrome Web Store package
npm run zip:firefox   # Create Firefox Add-ons package
```

### Project Structure

```
src/
├── entrypoints/
│   ├── background.ts      # Cross-browser background script
│   ├── content.ts         # Main content script
│   ├── content-preload.ts # Early CSS injection
│   └── popup/             # Extension UI
├── public/
│   ├── offscreen.js       # Chrome offscreen document
│   ├── models/            # Pre-trained ML models
│   └── libs/              # face-api.js library
└── utils/
    └── firefox-face-detection.ts # Firefox-specific implementation

.output/
├── chrome-mv3/            # Chrome build output
└── firefox-mv2/           # Firefox build output
```

## Testing

The project includes comprehensive Playwright tests to verify functionality. See **[docs/TESTING.md](docs/TESTING.md)** for full testing documentation.

**Quick Start:**
```bash
make install
make test
```

**Note**: Tests run with a visible browser (headed mode) for accurate extension testing, but the browser is configured to not steal focus or interrupt your workflow.

## Contributing

Contributions welcome! Ways to help:

- Report bugs
- Suggest features
- Improve documentation
- Submit pull requests

### Development Setup

1. **Clone repository:**
   ```bash
   git clone https://github.com/chenders/face-block-chromium-extension.git
   cd face-block-chromium-extension
   ```

2. **Install dependencies:**
   ```bash
   make install
   ```

3. **Development workflow:**
   ```bash
   # Run linter
   make lint

   # Auto-fix linting issues
   make lint-fix

   # Format code
   make format

   # Check formatting
   make format-check

   # Run tests
   make test

   # Run tests with debugger
   make test-debug

   # Run tests with UI
   make test-ui
   ```

4. **Make changes in `extension/` directory**

5. **Test manually in Chrome:**
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `extension` folder

6. **Before submitting PR:**
   ```bash
   make lint          # Must pass
   make format        # Format all code
   make test          # All tests must pass
   ```

### Code Quality

This project uses:
- **ESLint** for code linting (enforces code standards)
- **Prettier** for code formatting (consistent style)
- **Playwright** for end-to-end testing

All code is automatically checked for style and quality. Run `make lint-fix` and `make format` before committing.

### Building for Chrome Web Store

To package the extension for distribution:

```bash
make build
```

This will:
1. Run linter and formatter checks
2. Copy extension files to `build/` directory
3. Remove development artifacts
4. Create ZIP file ready for Chrome Web Store

The packaged ZIP file will be created in the root directory.

See **[STORE_LISTING.md](STORE_LISTING.md)** for Chrome Web Store submission guidelines.

**Test on:** Wikipedia (works well), news sites, check console for errors.

## License

MIT License

## Acknowledgments

- [face-api.js](https://github.com/justadudewhohacks/face-api.js) by Vincent Mühler
- TensorFlow.js team

---

**⭐ If you find this useful, please star the repository!**
