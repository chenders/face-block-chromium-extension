#!/bin/bash
# Curate comprehensive Trump test images
# This script downloads ~50 Trump images from across decades (1980s-2024)
# plus negative examples (Biden, Pence, etc.) for false positive testing
#
# Usage:
#   ./curate_trump_images.sh          # Download and validate (auto-filter)
#   ./curate_trump_images.sh --review # Download, validate, and launch interactive review

set -e

# Parse arguments
REVIEW_MODE=0
if [[ "$1" == "--review" ]]; then
    REVIEW_MODE=1
fi

echo "=================================="
echo "Trump Test Image Curator"
echo "=================================="
echo ""
echo "This will:"
echo "  - Download ~50 Trump images (1980s-2024)"
echo "  - Download ~40 negative examples"
echo "  - Auto-filter non-portrait & duplicate images"
echo "  - Validate with face detection"
if [[ $REVIEW_MODE -eq 1 ]]; then
    echo "  - Launch interactive review tool"
fi
echo ""
echo "Source: Wikimedia Commons (Public Domain)"
echo "Output: tests/fixtures/test-data/trump/"
echo ""

# Check if poetry is available
if ! command -v poetry &> /dev/null; then
    echo "❌ Error: poetry is required but not found"
    echo ""
    echo "Install poetry:"
    echo "  curl -sSL https://install.python-poetry.org | python3 -"
    echo ""
    echo "Or visit: https://python-poetry.org/docs/#installation"
    exit 1
fi

# Check dependencies
echo "📦 Checking dependencies..."
poetry run python -c "import PIL, numpy, requests, face_recognition, imagehash, cv2" 2>/dev/null || {
    echo "⚠  Missing dependencies. Installing..."
    poetry install
}

# Navigate to script directory
cd "$(dirname "$0")"

# Run the curator
echo ""
echo "🚀 Starting image curation..."
echo ""

poetry run python intelligent_test_curator.py \
    --target "Donald Trump" \
    --negative-examples "Joe Biden,Mike Pence,Barack Obama,Bill Clinton,George W Bush,Ron DeSantis,Ted Cruz,Mitch McConnell" \
    --output-dir "../../test-data/trump" \
    --max-images 50

echo ""
echo "=================================="
echo "✅ Download & Validation Complete!"
echo "=================================="
echo ""

# Launch review tool if requested
if [[ $REVIEW_MODE -eq 1 ]]; then
    echo "🖼️  Launching interactive review tool..."
    echo ""
    poetry run python review_curated_images.py \
        --input "../../test-data/trump/pending_review" \
        --output "../../test-data/trump"

    echo ""
    echo "=================================="
    echo "✅ Review Complete!"
    echo "=================================="
    echo ""
fi

echo "Images in: tests/fixtures/test-data/trump/"
echo ""
echo "Next steps:"
if [[ $REVIEW_MODE -eq 0 ]]; then
    echo "  1. Run './curate_trump_images.sh --review' to manually review images"
    echo "  2. Or check pending_review/ directory and manually move approved images"
fi
echo "  Review CURATION_SUMMARY.md for overview"
echo "  Check image_metadata.json for details"
echo ""
echo "Directory structure:"
ls -lh ../../test-data/trump/ 2>/dev/null || true
echo ""
