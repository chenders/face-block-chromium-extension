# Testing Documentation

## Test Infrastructure

### Overview
The test suite uses Playwright to test the Face Block Chromium Extension with actual face detection and reference data.

### Key Components

#### Test Helpers (`tests/helpers/`)

**test-data-loader.js**
- `loadTestReferenceData(context, { people })` - Loads reference face images into extension storage
  - Processes images using face-api.js in page context
  - Stores multiple descriptors per person for better matching
  - Returns the test server URL

- `clearTestReferenceData(context)` - Clears all reference data from extension storage

**test-server.js**
- `startTestServer()` - Starts local HTTP server for test fixtures
- `stopTestServer()` - Stops the test server
- Serves images with proper CORS headers
- Dynamically rewrites HTML to use HTTP URLs

### Test Fixtures (`tests/fixtures/`)

**Test Images**
- `images/albert_einstein/` - 4 Einstein images (3 usable for detection, 1 profile view fails)
- `images/carl_sagan/` - 3 Sagan images (all usable)
- `images/marilyn_monroe.jpg` - Non-matching face
- `images/steven_pruitt.jpg` - Non-matching face

**Test Page** (`test-page.html`)
- Contains various image configurations:
  - Regular images (different people)
  - Tiny images (< 50px) to test size filtering
  - Inline images to test inline display
  - Multiple instances of same person

## Test Suites

### Face Detection with References (`face-detection-with-references.spec.js`)

**Test 1: Blocked person images are replaced with placeholders**
- Loads Einstein reference data only
- Verifies Einstein images are blocked (4/5 expected due to profile view)
- Verifies Sagan images are NOT blocked (no reference data)
- Verifies non-matching faces are shown

**Test 2: Multiple blocked people are all detected**
- Loads both Einstein and Sagan reference data
- Verifies both people's images are correctly blocked
- Verifies non-matching faces are shown

**Test 3: Small images are skipped and not processed**
- Verifies images with display size < 50x50 pixels are not blocked
- Uses CSS-scaled images to test offsetWidth/Height logic

**Test 4: Inline images are processed correctly**
- Verifies inline images work the same as regular images

**Test 5: No flashing occurs when blocking images**
- Uses `browser.addInitScript()` to track image visibility
- Verifies images don't flash visible before being blocked
- Expects ≤ 2 images may briefly flash due to timing

## Key Technical Details

### Face Detection Settings
- **Threshold**: 0.6 (balance between accuracy and false positives)
- **Detector**: TinyFaceDetector with `inputSize: 160, scoreThreshold: 0.5`
- **Minimum Image Size**: 50x50 pixels (display dimensions)

### Why These Settings?
- **Threshold 0.6**: Higher values (0.75+) cause false positives (e.g., Sagan matched as Einstein)
- **Display Dimensions**: Using offsetWidth/Height handles CSS-scaled thumbnails correctly
- **Multiple Descriptors**: Loading 3+ reference images per person improves matching across angles

### Known Limitations
- Profile views (> 45° from frontal) may not match with frontal reference images
- This is expected behavior to avoid false positives
- TinyFaceDetector works best with frontal faces

## Running Tests

```bash
# Run all face detection tests
npx playwright test tests/face-detection-with-references.spec.js

# Run specific test
npx playwright test tests/face-detection-with-references.spec.js:39

# Run with UI
npx playwright test tests/face-detection-with-references.spec.js --ui
```

## Common Issues

**Issue**: Test fails with "No face detected" errors
**Solution**: Some test images may fail face detection (e.g., einstein4.jpg profile view). This is expected and the code skips these images.

**Issue**: False positives (wrong person blocked)
**Solution**: Threshold may be too high. Keep at 0.6 or lower.

**Issue**: Images flash before being blocked
**Solution**: Ensure preload.js is running at document_start in manifest.json.

**Issue**: Small images are blocked
**Solution**: Check that display dimensions (offsetWidth/Height) are being used, not natural dimensions.
