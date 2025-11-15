# Test Fixtures Guide

**Note:** This project has migrated from Einstein/Sagan test images to a comprehensive Trump-based test set.

## Current Test Infrastructure

The test infrastructure now uses real-world public domain images of Donald Trump spanning 60 years (1964-2024) to test face recognition across age variations, lighting conditions, and quality variations.

### Documentation

For complete information about the current test infrastructure, see:

- **[tests/TESTING_GUIDE.md](../TESTING_GUIDE.md)** - Comprehensive testing guide
- **[test-data/trump/README.md](test-data/trump/README.md)** - Complete test data reference and usage
- **[generators/image-curator/CURATION_PHILOSOPHY.md](generators/image-curator/CURATION_PHILOSOPHY.md)** - Philosophy behind test image curation
- **[generators/image-curator/README.md](generators/image-curator/README.md)** - Image curator tool documentation

### Quick Start

To generate test images:

```bash
cd tests/fixtures/generators/image-curator
./curate_trump_images.sh
```

This downloads:
- 22+ Trump source images from 1964-2024
- 50 negative examples (Biden, Obama, Pence, etc.)
- 20 lighting variations
- 15 quality variations
- **Total: 109+ test images**

### Test Structure

```
tests/fixtures/
├── generators/
│   └── image-curator/          - Tool for downloading and curating test images
│       ├── curate_trump_images.sh
│       ├── intelligent_test_curator.py
│       ├── README.md
│       └── CURATION_PHILOSOPHY.md
├── test-data/
│   └── trump/                  - Trump test images and metadata
│       ├── source/             (22 files) - Original downloads spanning 60 years
│       ├── by-age/             (24 files) - Categorized by age (young/middle/old)
│       ├── by-lighting/        (20 files) - Backlit, lowlight, bright, shadows
│       ├── by-quality/         (15 files) - Small, compressed, cropped
│       ├── false_positives/    (50 files) - Other politicians (critical for testing)
│       ├── image_metadata.json - Complete metadata for Trump images
│       ├── CURATION_SUMMARY.md - Generated summary
│       └── README.md           - Complete test data reference
└── test-pages/                 - HTML test pages
    ├── test-page.html
    ├── performance-test-50.html
    ├── performance-test-100.html
    ├── performance-test-200.html
    ├── performance-test-500.html
    └── generate-performance-pages.js
```

### Running Tests

```bash
# Run all tests
npm test

# Run comprehensive Trump tests
npx playwright test trump-comprehensive

# Run with coverage report
npx playwright test trump-comprehensive --grep "Coverage Report"
```

## Historical Note

The previous test infrastructure (documented in `TEST_FIXTURES_GUIDE.md.OLD`) used Einstein and Sagan images, but this approach had limitations:
- Only a few reference images per person
- Limited age variation coverage
- Insufficient false positive testing

The new Trump-based system provides:
- 60 years of age variation (1964-2024)
- Real-world lighting and quality variations
- Comprehensive false positive testing (50 negative examples)
- Automated generation and updates
- Complete metadata for analysis

See the files mentioned above for detailed information about the current system.
