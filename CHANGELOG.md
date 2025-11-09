# Changelog

## [Unreleased]

### Added
- Test infrastructure for face detection with actual reference images
- Test helpers for loading reference data into extension storage
- Local HTTP test server for serving test fixtures
- Test fixtures with images of Einstein, Sagan, Monroe, and Pruitt
- Comprehensive test suite (`face-detection-with-references.spec.js`) with 5 test cases
- Documentation for testing (`TESTING.md`)

### Changed
- **content.js**: Modified to always process images even when no reference data exists
  - Images are now restored to visible state when no face matcher is present
  - This fixes issue where images would remain hidden forever without reference data

- **content.js**: Fixed small image detection logic
  - Now uses display dimensions (offsetWidth/Height) instead of natural dimensions
  - Properly handles CSS-scaled thumbnails and small images
  - Minimum size check: 50x50 pixels (display size)

- **test-data-loader.js**: Improved reference data loading
  - Now accumulates multiple descriptors per person before storage
  - Previous implementation was overwriting descriptors with each image
  - Uses same TinyFaceDetector options as content script for consistency
  - Gracefully skips images where face detection fails

- **test-data-loader.js**: Fixed clearTestReferenceData to use service worker context
  - Previously tried to use chrome.runtime in page context (not available)
  - Now correctly accesses extension storage via service worker.evaluate()

- **face-detection-with-references.spec.js**: Fixed test expectations
  - Uses browser.addInitScript() instead of page.evaluateOnNewDocument()
  - Correctly expects 4/5 Einstein images to be blocked (profile view doesn't match)
  - All tests now pass with threshold 0.6

### Fixed
- Image flashing issue on Wikipedia and other sites
  - Added preload.js script running at document_start
  - CSS hides images immediately before they load
  - Content script then either blocks or restores visibility

- Race condition with fast localhost responses in tests
  - Added 100ms delay in test server responses
  - Use goto() without waitUntil + waitForLoadState() pattern

- Face detection not working on file:// URLs
  - Test server serves images via HTTP with proper CORS headers
  - Dynamically rewrites HTML to use HTTP URLs

- False positives with high threshold values
  - Tested thresholds 0.6, 0.75, 0.77
  - Found that 0.75+ causes Sagan images to match Einstein
  - Kept threshold at 0.6 for best accuracy

### Technical Details

**Match Threshold**: 0.6
- Lower values (< 0.6): May miss some matches
- Higher values (> 0.6): Cause false positives
- 0.6 provides best balance

**Minimum Image Size**: 50x50 pixels (display dimensions)
- Prevents processing of tiny thumbnails and icons
- Uses offsetWidth/Height to respect CSS sizing

**Multiple Descriptors**: 3+ per person recommended
- Improves matching across different angles and lighting
- Test infrastructure accumulates descriptors before storage

**Face Detection Options**: `{ inputSize: 160, scoreThreshold: 0.5 }`
- Matches content script configuration
- Works well for frontal faces and slight angles
- Profile views (> 45°) may not be detected
