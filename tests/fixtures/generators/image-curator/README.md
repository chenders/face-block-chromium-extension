# Intelligent Test Image Curation

This directory contains tools for intelligently curating comprehensive test images for face recognition testing.

## Philosophy: Real Photos > Synthetic Transformations

**Key Insight**: For a public figure like Donald Trump with 40+ years of public photos, we should find **real photos** that naturally exhibit the variations we need to test, rather than synthetically creating variations from a few base images.

### Why This Approach is Superior

1. **Realistic Testing**: Real photos captured in different decades, contexts, and conditions are far more representative of actual use cases than synthetic transformations

2. **Natural Variations**: Real photos include:
   - Actual age progression over decades
   - Authentic lighting from different environments (outdoor rallies, indoor speeches, studio portraits)
   - Natural angles from various photography contexts
   - Real expressions and contexts

3. **False Positive Testing**: Critical but often overlooked - we must test against images of other people to ensure the system doesn't over-match

4. **Comprehensive Coverage**: The Wikimedia Commons API provides access to thousands of public domain images spanning decades

## What Gets Tested

### Positive Tests (Should Block Target Person)

1. **Age Variations** (Real photos across decades)
   - 1980s-1990s: Young/business era
   - 2000s: Middle age
   - 2010s-2024: Recent years
   - Tests: Does recognition work across 40+ years of aging?

2. **Lighting Variations** (Natural + synthetic)
   - Studio portraits (controlled lighting)
   - Outdoor events (natural sunlight)
   - Indoor speeches (stage lighting)
   - Synthetic: Backlit, low-light, overexposed, shadows

3. **Angle Variations** (Real photos)
   - Frontal portraits
   - 3/4 view (press photos)
   - Profile shots
   - Looking up/down (at podium)

4. **Expression Variations** (Real photos)
   - Neutral/serious
   - Smiling
   - Speaking (mouth open)
   - Various emotional states

5. **Context Variations** (Real photos)
   - Official portraits
   - Press conferences
   - Rallies and events
   - Candid photos
   - With/without others

6. **Quality Variations** (Natural + synthetic)
   - High-resolution originals
   - Distant/small faces (crowd photos)
   - Heavy JPEG compression
   - Cropped/partial faces

### Negative Tests (Should NOT Block)

**Critical for preventing false positives!**

Test against:
- Other politicians (Biden, Pence, Obama, Clinton, etc.)
- Similar-looking individuals
- Random public domain portraits
- People in similar contexts (suits, podiums, etc.)

## Tools

### `intelligent_test_curator.py` - Primary Tool

Intelligently discovers and downloads comprehensive test sets with automated validation.

**Features:**
- Searches Wikimedia Commons API for target person
- Filters to public domain only
- **Face Detection**: Validates images contain detectable faces (≥10% of image area)
- **Duplicate Detection**: Uses perceptual hashing to filter near-duplicates
- **Title Filtering**: Pre-filters non-portrait images (logos, documents, etc.)
- Categorizes by decade, context, quality
- Ensures diverse coverage across age ranges
- Downloads negative examples for false positive testing
- Creates synthetic variations where needed
- Generates comprehensive metadata

### `web_review_curated_images.py` - Interactive Web Review

Modern web-based tool for manually reviewing validated images before final approval.

**Features:**
- 🖼️ **Visual Preview**: Large image display in browser
- 📊 **Progress Tracking**: Real-time progress bar, percentage, and statistics
- ⚡ **Auto-Save**: Decisions saved immediately (no save button needed)
- ⌨️ **Keyboard Shortcuts**: K (keep), R (reject), A (accept all)
- 🎯 **Batch Operations**: "Accept All" button for bulk approval
- 🔒 **Auto-Accept on Close**: Remaining images auto-accepted when closing browser
- 🌐 **Local Web Server**: Runs on `http://localhost:8765`

**Why Use Web Review?**
- Better visual inspection than CLI tool
- Instant feedback with smooth animations
- No need to remember commands or wait for saves
- Progress tracking shows exactly how many images remain
- Graceful handling of window close (auto-accepts remaining)

**Usage:**

```bash
# Quick Start - Use Makefile targets (recommended)
make curate-images              # Download and auto-validate only
make curate-images-review       # Download, validate, and launch web review

# Or run directly with poetry
cd tests/fixtures/generators/image-curator

# Basic usage (Trump + common false positives)
poetry run python intelligent_test_curator.py

# With web-based review
./curate_trump_images.sh --review

# Custom target person
poetry run python intelligent_test_curator.py --target "Barack Obama"

# Custom negative examples
poetry run python intelligent_test_curator.py --target "Donald Trump" \
  --negative-examples "Joe Biden,Mike Pence,Ron DeSantis,Ted Cruz"

# Limit number of images
poetry run python intelligent_test_curator.py --max-images 30

# Custom output directory
poetry run python intelligent_test_curator.py --output-dir my_test_images

# Review pending images only (if already downloaded)
poetry run python web_review_curated_images.py \
  --input ../../test-data/trump/pending_review \
  --output ../../test-data/trump \
  --port 8765
```

**Web Review Keyboard Shortcuts:**
- `K` - Keep/approve current image
- `R` - Reject current image
- `A` - Accept all remaining images
- Close browser window - Auto-accepts remaining images

**Output Structure:**

```
test_images/
├── source_images/           # Original downloaded images
├── age_variations/          # Categorized by age (young/middle/old)
├── lighting_variations/     # Synthetic lighting transformations
├── quality_variations/      # Size, compression, crop variations
├── false_positives/         # Other people (negative examples)
├── image_metadata.json      # Complete metadata for all images
└── CURATION_SUMMARY.md      # Human-readable summary
```

### `auto_prepare_test_images.py` - Legacy Tool

Original tool that uses hardcoded URLs and synthetic transformations.

**When to use:** When you need quick test images with specific transformations, or when target person has limited public domain photos.

## Installation

```bash
cd tests/fixtures/images/unified_downloader

# Install dependencies
poetry install

# Or with pip
pip install pillow numpy requests
```

## Running the Curator

### For Trump (Primary Use Case)

```bash
# Enter the environment
poetry shell

# Run with defaults (downloads ~50 Trump images + negative examples)
python files/intelligent_test_curator.py

# Or specify everything explicitly
python files/intelligent_test_curator.py \
  --target "Donald Trump" \
  --negative-examples "Joe Biden,Mike Pence,Barack Obama,Bill Clinton,George W Bush" \
  --output-dir test_images \
  --max-images 50
```

This will:
1. Search Wikimedia Commons for "Donald Trump"
2. Filter to ~200 public domain results
3. Categorize by decade (1980s, 1990s, 2000s, 2010s, 2020s)
4. Select diverse subset ensuring coverage across decades
5. Download images with metadata
6. Categorize by age (young/middle/old)
7. Create synthetic lighting variations
8. Create quality variations (small, compressed, cropped)
9. Download negative examples (Biden, Pence, etc.)
10. Generate comprehensive metadata and summary

### For Other Public Figures

```bash
# Any person with sufficient Wikimedia Commons coverage
python files/intelligent_test_curator.py --target "Elon Musk"
python files/intelligent_test_curator.py --target "Vladimir Putin"
python files/intelligent_test_curator.py --target "Angela Merkel"
```

## Understanding the Output

### `CURATION_SUMMARY.md`

Human-readable summary showing:
- Total images downloaded
- Distribution by age category
- Distribution by decade
- Negative examples breakdown

Example:
```markdown
## Age Distribution

- Young: 12 images (1980s-early 1990s)
- Middle: 18 images (mid 1990s-2010)
- Old: 20 images (2011-2024)

## Decade Distribution

- 1980s: 5 images
- 1990s: 8 images
- 2000s: 12 images
- 2010s: 15 images
- 2020s: 10 images

## Negative Examples

- Joe Biden: 10 images
- Mike Pence: 10 images
- Barack Obama: 10 images
```

### `image_metadata.json`

Complete metadata for each image including:
- Source URL
- Year/decade
- Estimated age category
- Context (portrait, speech, event, etc.)
- Quality metrics
- Lighting analysis
- Whether it's a negative example

This can be used programmatically in tests to select specific subsets.

## Integration with Tests

### Using Curated Images in Tests

After running the curator, move images to the test fixtures directory:

```bash
# Copy to test fixtures
cp -r test_images/age_variations ../age_variations/
cp -r test_images/lighting_variations ../lighting_variations/
cp -r test_images/false_positives ../false_positives/

# Or create symlinks
ln -s $(pwd)/test_images/age_variations ../age_variations
```

### Test Implementation

```javascript
// tests/comprehensive-matching.spec.js

test.describe('Age Variation Testing', () => {
  test('matches across decades (1980s → 2020s)', async () => {
    // Load 1980s image as reference
    const testPageUrl = await loadTestReferenceData(browser, {
      people: ['donald_trump_1985']
    });

    // Test with 2024 image
    // Should still match despite 40 years of aging
  });
});

test.describe('False Positive Testing', () => {
  test('does not match Joe Biden', async () => {
    // Load Trump as reference
    const testPageUrl = await loadTestReferenceData(browser, {
      people: ['donald_trump']
    });

    // Test page with Biden images
    // Should NOT block Biden
  });
});
```

## Advanced Usage

### Programmatic Access

```python
from intelligent_test_curator import IntelligentTestCurator

# Create curator
curator = IntelligentTestCurator(
    target_person="Donald Trump",
    output_dir="my_tests"
)

# Curate target
target_images = curator.curate_target_person(
    min_per_decade=5,
    max_total=50
)

# Curate negatives
negatives = curator.curate_negative_examples(
    people=["Joe Biden", "Mike Pence"],
    per_person=10
)

# Create variations
curator.create_lighting_variations(target_images)
curator.create_quality_variations(target_images)

# Save
curator.save_metadata()
```

### Filtering Metadata

```python
import json

# Load metadata
with open('test_images/image_metadata.json') as f:
    metadata = json.load(f)

# Find all 1980s images
eighties = [m for m in metadata if 1980 <= m['year'] < 1990]

# Find all high-quality frontals
hq_frontals = [
    m for m in metadata
    if m['quality'] == 'high' and m['angle'] == 'frontal'
]

# Find all negative examples
negatives = [m for m in metadata if m['is_negative']]
```

## Troubleshooting

### "Not enough public domain images found"

- Try different search terms: "Donald J Trump", "President Trump", etc.
- Check Wikimedia Commons manually: https://commons.wikimedia.org
- Consider supplementing with other sources (NASA, Library of Congress)

### "API rate limiting"

The script includes automatic delays. If you still hit limits:
- Reduce `--max-images`
- Run in multiple sessions with different date ranges
- Wait 15 minutes between runs

### "Images don't download"

- Check internet connection
- Verify Wikimedia Commons is accessible
- Check cache directory permissions
- Try clearing cache: `rm -rf .image_cache`

## Comparison: Intelligent vs. Legacy Approach

| Aspect | Intelligent Curator | Legacy Auto-Prepare |
|--------|-------------------|---------------------|
| Image Source | API search (100s available) | Hardcoded URLs (5-10) |
| Age Variation | Real photos across decades | Same photo, no variation |
| Angle Variation | Real photos at different angles | Synthetic perspective transforms |
| Lighting | Real + synthetic | Synthetic only |
| Negative Testing | Yes (other people) | No |
| Coverage | Comprehensive (50+ images) | Limited (20-30 images) |
| Realism | High (real-world photos) | Medium (transformations visible) |
| Automation | Fully automated search | Manual URL collection needed |

## Best Practices

1. **Always include negative examples** - Critical for preventing false positives
2. **Ensure age diversity** - Test across full career/life span
3. **Use real photos primarily** - Only use synthetic for extreme conditions
4. **Document metadata** - Track what each image tests
5. **Update periodically** - Add new photos as they become available
6. **Test edge cases** - Small faces, poor quality, partial views
7. **Validate results** - Manually inspect downloaded images for quality

## Future Enhancements

- [ ] Add more image sources (Library of Congress API, etc.)
- [ ] Implement face detection to auto-categorize angles
- [ ] Add expression detection (smiling vs. serious)
- [ ] Include video frame extraction
- [ ] Add similarity scoring between images
- [ ] Create test result correlation with image metadata
- [ ] Implement active learning (prioritize images that expose weaknesses)

## License and Attribution

All downloaded images are public domain or compatible licenses from Wikimedia Commons. Attribution is automatically tracked in `image_metadata.json` and included in `CURATION_SUMMARY.md`.

When using these test images:
1. Keep attribution metadata intact
2. Don't distribute images without license information
3. Respect any usage terms specified in metadata
4. Contribute improvements back to this toolkit
