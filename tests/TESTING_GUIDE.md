# Face Block Extension - Comprehensive Testing Guide

## Overview

This project uses **real-world test images** curated from public domain sources to ensure the face recognition system works correctly across all variations.

## Testing Philosophy

**Real Photos > Synthetic Transformations**

Instead of creating synthetic variations from a few base images, we use the **Intelligent Test Image Curator** to discover and download real photos from public domain sources spanning decades.

### Why This Matters

For blocking Trump (the primary use case):
- ✅ **60 years of photos** (1964-2024) tests real age variation
- ✅ **Natural lighting** from different contexts (rallies, portraits, events)
- ✅ **Real angles** from various photography situations
- ✅ **Critical false positive testing** (other politicians who should NOT match)

## Test Structure

### Current Test Files

```
tests/
├── trump-comprehensive.spec.js  ← Main comprehensive test suite (NEW!)
├── face-detection-with-references.spec.js
├── image-blocking.spec.js
├── detector-modes.spec.js
├── performance-profiling.spec.js
├── extension.spec.js
├── settings.spec.js
├── flashing-prevention.spec.js
└── image-types.spec.js
```

### Trump Comprehensive Test Suite

**Location**: `tests/trump-comprehensive.spec.js`

This is the **main test file** for comprehensive Trump blocking tests.

**What it tests:**

1. **Age Variation Tests**
   - Young (1964-1985): Business era
   - Middle (1999-2008): Public figure
   - Old (2015-2024): Political era
   - **Critical**: Does recognition work across 60 years?

2. **False Positive Prevention** (CRITICAL!)
   - Joe Biden - should NOT block
   - Mike Pence - should NOT block
   - Barack Obama - should NOT block
   - Other politicians - should NOT block

3. **Lighting Variation Tests**
   - Backlit (strong background light)
   - Low light (dim conditions)
   - Bright (overexposed)
   - Shadows (directional lighting)

4. **Quality Variation Tests**
   - Small faces (~200px or less)
   - Heavy JPEG compression
   - Cropped/partial faces

5. **Real-World Scenario Tests**
   - Official portraits (high quality)
   - Candid/event photos (varied quality)

6. **Coverage Report**
   - Generates comprehensive report of test coverage
   - Shows distribution by age, decade, quality
   - Lists all negative examples

## Generating Test Images

### Prerequisites

```bash
# Ensure Python 3.10+ is installed
python3 --version

# Dependencies will be installed automatically
```

### Generate Comprehensive Test Set

```bash
# Navigate to the curator tool
cd tests/fixtures/images/unified_downloader

# Run the curation script (5-10 minutes)
./curate_trump_images.sh
```

This downloads:
- **24 Trump source images** from 1964-2024
- **50 negative examples** (Biden, Pence, Obama, Clinton, Bush, Cruz, DeSantis, McConnell)
- **20 lighting variations** (backlit, lowlight, bright, shadows)
- **15 quality variations** (small, compressed, cropped)
- **Complete metadata** (`image_metadata.json` for Trump images)
- **Total: 109 test images**

### Output Structure

```
tests/fixtures/trump_test_set/
├── source_images/           # 50 original downloads
│   ├── donald_trump_1964_*.jpg
│   ├── donald_trump_1985_*.jpg
│   ├── donald_trump_2024_*.jpg
│   └── ...
│
├── age_variations/          # Categorized by age
│   ├── young_001.jpg       # 1960s-1980s
│   ├── middle_001.jpg      # 1990s-2000s
│   └── old_001.jpg         # 2010s-2020s
│
├── lighting_variations/     # Synthetic lighting
│   ├── *_backlit.jpg
│   ├── *_lowlight.jpg
│   ├── *_bright.jpg
│   └── *_shadows.jpg
│
├── quality_variations/      # Quality variations
│   ├── *_small.jpg
│   ├── *_compressed.jpg
│   └── *_cropped.jpg
│
├── false_positives/         # Other politicians (CRITICAL!)
│   ├── joe_biden_001.jpg
│   ├── mike_pence_001.jpg
│   ├── barack_obama_001.jpg
│   └── ...
│
├── image_metadata.json      # Complete metadata
└── CURATION_SUMMARY.md      # Human-readable summary
```

## Running Tests

### Run All Tests

```bash
npm test
```

### Run Trump Comprehensive Tests

```bash
npx playwright test trump-comprehensive
```

### Run with Coverage Report

```bash
npx playwright test trump-comprehensive --grep "Coverage Report"
```

This shows a detailed breakdown of:
- Total images available
- Age distribution
- Decade distribution
- Quality distribution
- Negative examples by person

### View Test Results

```bash
npx playwright show-report
```

## Test Implementation Details

### How Tests Work

The trump-comprehensive tests:

1. **Check for test images** on startup
2. **Load metadata** from `image_metadata.json`
3. **Filter images** by criteria (age, decade, person, etc.)
4. **Run tests** with appropriate images
5. **Skip gracefully** if images not available

### Helper Functions

```javascript
// Check if test images exist
function testImagesExist()

// Load metadata (Trump images only)
function loadImageMetadata()

// Get Trump images by criteria (from metadata)
function getImages({ age, decade, is_negative, person })

// Get false positive images (from directory)
function getFalsePositiveImages(personName)  // e.g., 'Joe Biden'
function getAllFalsePositives()  // Returns grouped by person

// Examples:
const youngTrump = getImages({ age: 'young', is_negative: false });
const eighties = getImages({ decade: 1980, is_negative: false });
const bidenImages = getFalsePositiveImages('Joe Biden');
const allNegatives = getAllFalsePositives();
```

**Important**: False positive images are NOT in the metadata file. Use `getFalsePositiveImages()` or `getAllFalsePositives()` to access them from the `false_positives/` directory.

### Adding New Tests

```javascript
test('my new test', async () => {
  if (!testImagesExist()) test.skip();

  const metadata = loadImageMetadata();
  const targetImages = getImages({ /* criteria */ });

  // Your test logic here
});
```

## Interpreting Results

### Expected Match Rates

**Positive Tests (Should Block Trump):**

| Scenario | Expected Match Rate |
|----------|---------------------|
| Same decade, similar context | >95% |
| Adjacent decades (10 years) | >90% |
| Two decades apart (20 years) | >80% |
| Three decades apart (30 years) | 60-80% |
| Four decades apart (40 years) | 40-70% |

**Negative Tests (Should NOT Block):**

| Person | Expected Match Rate |
|--------|---------------------|
| Joe Biden | <30% |
| Mike Pence | <30% |
| Barack Obama | <30% |

**If match rate >30% for negatives → System is over-matching (BAD!)**

### Coverage Goals

Minimum acceptable coverage:
- ✅ At least 10 Trump images (current: 24 source images)
- ✅ At least 3 decades represented (current: 6 decades: 1960s-2020s)
- ✅ At least 10 negative examples (current: 50 across 8 politicians)
- ✅ Lighting variations present (current: 20 variations)
- ✅ Quality variations present (current: 15 variations)

**Current Total Coverage: 109 test images**

## Continuous Testing

### When to Re-Generate Images

- **Periodically** (monthly): New photos become public domain
- **After curator updates**: When new sources are added
- **For new people**: When testing with different targets

### Re-Generate Command

```bash
cd tests/fixtures/images/unified_downloader
./curate_trump_images.sh
```

This will:
- Download newest public domain photos
- Update metadata
- Regenerate all variations

## Troubleshooting

### "Test images not found"

**Problem**: Tests skip because test images don't exist

**Solution**:
```bash
cd tests/fixtures/images/unified_downloader
./curate_trump_images.sh
```

### "Few images downloaded"

**Problem**: Only downloaded 5-10 images instead of 50

**Solution**: Check internet connection and Wikimedia Commons access
- The script uses category-based API which should work
- If it fails, check the console output for specific errors

### "No negative examples"

**Problem**: False positive tests are skipped

**Solution**: Run curator with negative examples:
```bash
python3 files/intelligent_test_curator.py \
  --target "Donald Trump" \
  --negative-examples "Joe Biden,Mike Pence,Barack Obama,Bill Clinton"
```

### "Tests fail on recognition"

**Problem**: Trump images not being recognized/blocked

**Possible causes**:
1. Reference images not loaded correctly
2. Face detection threshold too strict
3. Age gap too large (40+ years is challenging)
4. Image quality too low

**Debug**:
- Check detector mode (Hybrid works best)
- Adjust similarity threshold
- Review which specific images fail
- Check age gap between reference and test images

## Adding Support for Other People

To test blocking other people (e.g., Elon Musk, Putin):

1. **Add to PERSON_CATEGORIES** in `intelligent_test_curator.py`:
```python
"Elon Musk": {
    "main": "Elon_Musk",
    "birth_year": 1971
}
```

2. **Generate images**:
```bash
python3 files/intelligent_test_curator.py --target "Elon Musk"
```

3. **Create test file** (copy `trump-comprehensive.spec.js` and adapt)

## Best Practices

1. ✅ **Always test false positives** - Critical for preventing over-matching
2. ✅ **Test across age ranges** - Ensure recognition works over time
3. ✅ **Test poor quality** - Real-world images aren't always perfect
4. ✅ **Document failures** - Track which scenarios don't work
5. ✅ **Update periodically** - New photos become available
6. ✅ **Verify manually** - Spot-check a few images before running tests

## CI/CD Integration

### Pre-Test Setup

```yaml
# .github/workflows/test.yml
- name: Generate Test Images
  run: |
    cd tests/fixtures/images/unified_downloader
    ./curate_trump_images.sh

- name: Run Tests
  run: npm test
```

**Note**: Consider caching downloaded images to speed up CI:

```yaml
- uses: actions/cache@v3
  with:
    path: tests/fixtures/images/trump_test_set
    key: test-images-${{ hashFiles('tests/fixtures/images/unified_downloader/files/intelligent_test_curator.py') }}
```

## Further Reading

- `tests/fixtures/images/INTELLIGENT_CURATION_GUIDE.md` - Detailed curation philosophy
- `tests/fixtures/images/unified_downloader/README.md` - Curator tool documentation
- `tests/fixtures/images/IMAGE_SOURCES.md` - Image source information

## Summary

The new testing approach provides:
- ✅ **Realistic testing** with real photos across decades
- ✅ **Comprehensive coverage** of age, lighting, quality variations
- ✅ **Critical false positive testing** to prevent over-matching
- ✅ **Automated generation** with one command
- ✅ **Complete metadata** for analysis and debugging
- ✅ **Reproducible** and updatable test sets

This ensures your extension works correctly in real-world scenarios!
