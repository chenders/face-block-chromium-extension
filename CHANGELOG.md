# Changelog

All notable changes to the Face Block Chrome Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- ESLint and Prettier for code quality and consistent formatting
- Chrome Web Store packaging script (`npm run build`)
- Comprehensive privacy policy (PRIVACY.md)
- Chrome Web Store listing template (STORE_LISTING.md)
- Development documentation in README
- This CHANGELOG file

### Changed
- Formatted entire codebase with Prettier
- Updated README with development workflow and build instructions
- Improved code quality standards

## [1.0.0] - 2025-11-10

### Added
- Initial release of Face Block Chrome Extension
- Local face recognition using face-api.js
- Three detection modes: Fast (TinyFaceDetector), Thorough (SsdMobilenet), and Hybrid
- Adjustable match threshold (0.3-0.8)
- Multiple reference photo support per person
- Color-matched image replacement
- Seamless flashing prevention
- Dynamic content support (infinite scroll, SPAs, lazy loading)
- Import/export functionality for face data
- Comprehensive Playwright test suite
- Offscreen document architecture for 25x faster performance

### Features
- 100% local processing - no cloud services
- Privacy-first design with irreversible face descriptors
- Smart color matching for replaced images
- Automatic CORS handling
- Small image filtering to preserve page functionality
- Responsive image support (srcset)
- Real-time settings changes without page reload

### Technical Details
- Chrome Manifest V3
- IndexedDB for face descriptor storage
- chrome.storage.sync for settings
- Debounced mutation observers for efficient DOM watching
- Background service worker for CORS and messaging
- Offscreen document for Canvas/WebGL-dependent face detection

### Supported
- Chrome 88+ and Chromium-based browsers
- All standard `<img>` elements
- Dynamic content (SPA frameworks, infinite scroll)
- Lazy-loaded images
- Responsive images with srcset

### Known Limitations
- CORS-restricted images are skipped (browser security)
- CSS background-image not supported
- Video frames not supported
- Animated GIFs (only first frame analyzed)
- Canvas-rendered content not supported
- Very small faces (<50x50 pixels) may not be detected

## Version Number Format

This project uses Semantic Versioning (MAJOR.MINOR.PATCH):
- **MAJOR**: Breaking changes, major architecture updates
- **MINOR**: New features, enhancements (backward compatible)
- **PATCH**: Bug fixes, documentation updates

## Categories

Changes are grouped by:
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security fixes

---

[Unreleased]: https://github.com/chenders/face-block-chromium-extension/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/chenders/face-block-chromium-extension/releases/tag/v1.0.0
