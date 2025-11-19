# Testing Documentation

## Test Infrastructure

### Overview
The test suite uses Playwright to test the Face Block Browser Extension with actual face detection and reference data using a comprehensive Trump-based test image set.

### Key Components

#### Test Helpers (`tests/helpers/`)

**test-data-loader.js**
- `loadTestReferenceData(context, { people })` - Loads reference face images into extension storage
  - Supports Trump test images: use `people: ['trump']` or `people: ['donald_trump']`
  - Processes images using face-api.js in page context
  - Stores multiple descriptors per person for better matching across age variations
  - Returns the test server URL
  - Example: `await loadTestReferenceData(context, { people: ['trump'] })`

- `clearTestReferenceData(context)` - Clears all reference data from extension storage

**test-server.js**
- `startTestServer()` - Starts local HTTP server for test fixtures
- `stopTestServer()` - Stops the test server
- Serves images from `/images/` and `/trump_test_set/` paths
- Provides proper CORS headers
- Dynamically rewrites HTML to use HTTP URLs

### Test Fixtures (`tests/fixtures/`)

**Trump Test Set** (`test-data/trump/`)
- **source/** - 22 original Trump images from 1964-2024
- **by-age/** - 24 images categorized by age (young/middle/old)
- **by-lighting/** - 20 synthetic lighting variations
- **by-quality/** - 15 quality variations (small, compressed, cropped)
- **false_positives/** - 50 images of other politicians (Biden, Obama, Pence, etc.)
- **image_metadata.json** - Complete metadata for all Trump images
- **CURATION_SUMMARY.md** - Human-readable summary

**Test Pages**
- `test-page.html` - Comprehensive test page with Trump and false positive images
- `performance-test-{50,100,200,500}.html` - Performance test pages with varying image counts
- `generate-performance-pages.js` - Generator script for performance test pages

### Generating Test Images

Before running tests, generate the Trump test set:

```bash
cd tests/fixtures/generators/image-curator
./curate_trump_images.sh
```

This downloads ~109 test images including:
- 22+ Trump source images (1964-2024)
- 50 false positive images (other politicians)
- All synthetic variations

## Test Suites

### Trump Comprehensive Tests (`trump-comprehensive.spec.js`)

The main test suite for comprehensive Trump blocking across all variations.

**Age Variation Tests**
- Tests recognition across 60 years (1964-2024)
- Young Trump (1960s-1980s)
- Middle-aged Trump (1990s-2000s)
- Old Trump (2010s-2024)

**False Positive Prevention** (CRITICAL)
- Verifies Joe Biden is NOT blocked
- Verifies Mike Pence is NOT blocked
- Verifies Barack Obama is NOT blocked
- And other politicians

**Lighting Variation Tests**
- Backlit images
- Low light images
- Bright/overexposed images
- Strong shadows

**Quality Variation Tests**
- Small faces (<200px)
- Heavy JPEG compression
- Cropped/partial faces

### Face Detection with References (`face-detection-with-references.spec.js`)

**Test 1: Blocked person images are replaced with placeholders**
- Loads Trump reference data
- Verifies Trump images are blocked
- Verifies false positives (Obama, Biden) are NOT blocked
- Verifies images are marked as processed

**Test 2: All Trump images are detected and blocked**
- Clears previous reference data
- Loads Trump reference data
- Verifies comprehensive blocking
- Verifies false positives remain visible

**Test 3: Inline images are processed correctly**
- Loads Trump reference data
- Verifies inline Trump images are blocked
- Verifies inline false positives are NOT blocked

### Performance Profiling (`performance-profiling.spec.js`)

Tests extension performance at scale with Trump reference data:
- 50 images baseline
- 100 images test
- 200 images test
- 500 images test
- Detector mode comparisons (TinyFace, SSD, Hybrid)

## Key Technical Details

### Face Detection Settings
- **Threshold**: 0.6 (balance between accuracy and false positives)
- **Detector**: Hybrid mode (TinyFaceDetector + SsdMobilenetv1 fallback)
- **Minimum Image Size**: 50x50 pixels (display dimensions)

### Why These Settings?
- **Threshold 0.6**: Higher values reduce false positives while maintaining good matching across age variations
- **Display Dimensions**: Using offsetWidth/Height handles CSS-scaled thumbnails correctly
- **Multiple Descriptors**: Loading 20+ reference images per person improves matching across:
  - 60 years of age variation
  - Different lighting conditions
  - Various angles and contexts

### Known Limitations
- **Extreme age gaps (40+ years)**: Matching accuracy decreases with larger age differences
- **Profile views** (> 45° from frontal): May not match with frontal reference images
- **Very low quality** images: May fail face detection
- This is expected behavior to avoid false positives

### Test Coverage

Current test image coverage:
- **Positive examples**: ~80 Trump images
- **Negative examples**: 50 other politician images
- **Age span**: 60 years (1964-2024)
- **Decades covered**: 6 (1960s through 2020s)
- **Total coverage**: 109+ test images

## Running Tests

```bash
# Run all tests
npm test

# Run Trump comprehensive tests
npx playwright test trump-comprehensive

# Run with coverage report
npx playwright test trump-comprehensive --grep "Coverage Report"

# Run face detection tests
npx playwright test face-detection-with-references

# Run performance tests
npx playwright test performance-profiling

# Run specific test
npx playwright test trump-comprehensive.spec.js:42

# Run with UI
npx playwright test --ui
```

## Common Issues

**Issue**: Test fails with "Test images not found"
**Solution**: Generate test images first:
```bash
cd tests/fixtures/generators/image-curator
./curate_trump_images.sh
```

**Issue**: No faces detected in Trump images
**Solution**: This can happen with some images (e.g., profile views). The test data loader skips these and continues with other images.

**Issue**: False positives (wrong person blocked)
**Solution**: This is a critical failure. Check threshold settings and reference data quality. Should be very rare with threshold 0.6.

**Issue**: Images flash before being blocked
**Solution**: Ensure preload.js is running at document_start in manifest.json.

**Issue**: Small images are blocked
**Solution**: Check that display dimensions (offsetWidth/Height) are being used, not natural dimensions.

**Issue**: Poor matching across age variations
**Solution**: Ensure reference data includes images from multiple decades. The more age-varied reference images, the better cross-age matching.

## Documentation

For more detailed information:
- `tests/TESTING_GUIDE.md` - Comprehensive testing guide
- `tests/fixtures/test-data/trump/TEST_IMAGE_SUMMARY.md` - Test image summary
- `tests/fixtures/images/INTELLIGENT_CURATION_GUIDE.md` - Curation philosophy
- `tests/fixtures/generators/image-curator/README.md` - Curator tool documentation
