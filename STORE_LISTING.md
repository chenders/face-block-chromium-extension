# Chrome Web Store Listing Information

This file contains template information for the Chrome Web Store listing.

## Store Listing

### Name
Face Block - Privacy-Focused Image Filter

### Summary (132 characters max)
Block images of specified people for enhanced privacy using local face recognition. All processing happens on your device.

### Description (16,000 characters max)
Face Block is a privacy-focused Chrome extension that gives you control over what images you see while browsing. Using state-of-the-art face recognition technology, it automatically detects and blocks images of people you specify, all while keeping your data completely private.

**Key Features:**
- 🔒 **Complete Privacy**: All face detection and matching happens locally on your device. No data is sent to external servers.
- 🎯 **Accurate Detection**: Uses face-api.js with TinyFaceDetector and SsdMobilenetv1 for reliable face recognition
- ⚡ **Fast Performance**: Optimized offscreen document architecture loads models once at browser startup (25x faster than per-page loading)
- 🎨 **Seamless Integration**: Blocked images are replaced with color-matched placeholders that blend with the page design
- 📊 **Flexible Settings**: Adjust match threshold and detection modes to balance accuracy and performance
- 💾 **Import/Export**: Backup and restore your reference faces

**How It Works:**
1. Upload one or more photos of people you want to block
2. Browse normally - the extension automatically scans images on web pages
3. When a match is found, the image is replaced with a subtle placeholder
4. All processing happens locally using your browser's capabilities

**Technical Highlights:**
- Hybrid detection mode uses TinyFaceDetector for speed with SsdMobilenetv1 fallback for accuracy
- Smart image filtering skips small images and icons to preserve page functionality
- Efficient processing with debounced mutation observers
- CORS-aware image handling for cross-origin content

**Privacy First:**
- No external API calls or data transmission
- Reference faces stored locally using IndexedDB
- No tracking, analytics, or telemetry
- Open source codebase for transparency

**Perfect for:**
- Users seeking enhanced privacy while browsing
- Avoiding unwanted content featuring specific individuals
- Parents managing content exposure for children
- Anyone who wants more control over their browsing experience

## Category
Productivity

## Privacy Policy URL
https://github.com/YOUR_USERNAME/block-images/blob/main/PRIVACY.md
<!-- TODO: Replace YOUR_USERNAME with your actual GitHub username -->

## Language
English (United States)

## Store Assets

### Icon
- 16x16: extension/icons/icon16.png
- 48x48: extension/icons/icon48.png
- 128x128: extension/icons/icon128.png

### Screenshots (1280x800 or 640x400)
Generated screenshots are available in `store-assets/screenshots/`:
1. **01-popup-main.png** - Extension popup with settings interface
2. **02-add-person.png** - "Add Person" interface showing name input
3. **03-detector-modes.png** - Detector mode selection (Fast/Thorough/Hybrid)
4. **04-settings.png** - Match threshold configuration
5. **05-example-page.png** - Real-world usage example on Wikipedia

**Next steps:**
- Review and edit these screenshots to add annotations (arrows, highlights, text labels)
- Create a before/after comparison screenshot showing image blocking in action
- Ensure all screenshots are properly formatted at 1280x800 pixels
- See `store-assets/SCREENSHOT_GUIDE.md` for detailed editing instructions

### Promotional Images
**Small Promo Tile (440x280)**: Optional - Use `store-assets/templates/small-tile-template.html`
**Large Promo Tile (920x680)**: Optional - Use `store-assets/templates/large-tile-template.html`
**Marquee Promo Tile (1400x560)**: Required for featured placement - Use `store-assets/templates/marquee-tile-template.html`

**To create promotional images:**
1. Open the HTML templates in a web browser
2. Customize the text, colors, and content
3. Take a screenshot of the tile at the exact dimensions
4. See `store-assets/PROMO_GUIDE.md` for detailed design guidelines

## Version Information

### Version Number
1.0.0

### What's New in This Version
Initial release of Face Block:
- Local face recognition and blocking
- Hybrid detection mode with TinyFaceDetector and SsdMobilenetv1
- Adjustable match threshold
- Import/export functionality
- Color-matched image replacement
- Optimized performance with offscreen document architecture

## Permissions Justification

**storage**: Required to save reference faces and user settings locally
**declarativeNetRequest**: Required to handle CORS for image loading
**offscreen**: Required to run face detection models that need Canvas/WebGL APIs
**host_permissions**: Required to process images on all websites

## Privacy Practices

### Data Usage
- **Face Recognition Data**: Stored locally, never transmitted
- **User Settings**: Stored locally using chrome.storage.sync
- **No user data collection**: Extension does not collect, transmit, or sell any user data

### Certification
This extension does not handle user data in ways that require certification.

## Distribution

### Visibility
Public

### Regions
All regions

## Support

### Website
https://github.com/YOUR_USERNAME/block-images
<!-- TODO: Replace YOUR_USERNAME with your actual GitHub username -->

### Support URL
https://github.com/YOUR_USERNAME/block-images/issues
<!-- TODO: Replace YOUR_USERNAME with your actual GitHub username -->

### Support Email
your-email@example.com
<!-- TODO: Replace with your actual support email address -->

## Pricing

Free

## Notes for Reviewers

This extension uses face-api.js for local face recognition. All processing happens client-side:
1. Users upload reference photos through the popup interface
2. Face descriptors are extracted and stored in IndexedDB
3. As users browse, images are analyzed locally
4. Matches trigger replacement with color-matched placeholders

No external APIs or servers are used. The extension requires an offscreen document because face-api.js needs Canvas/WebGL APIs not available in service workers.

To test:
1. Open the extension popup
2. Enter a name (e.g., "Test Person")
3. Upload a photo with a clear face
4. Navigate to a page with that person's image
5. Observe the image being replaced with a placeholder

Sample test images are available in the GitHub repository under `tests/fixtures/`.
