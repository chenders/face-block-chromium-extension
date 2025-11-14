#!/bin/bash
# Curate comprehensive Trump test images
# This script downloads ~50 Trump images from across decades (1980s-2024)
# plus negative examples (Biden, Pence, etc.) for false positive testing

set -e

echo "=================================="
echo "Trump Test Image Curator"
echo "=================================="
echo ""
echo "This will download:"
echo "  - ~50 Trump images spanning 1980s-2024"
echo "  - ~40 negative examples (other politicians)"
echo "  - Create lighting & quality variations"
echo ""
echo "Source: Wikimedia Commons (Public Domain)"
echo "Output: tests/fixtures/test-data/trump/"
echo ""

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Error: Python 3 is required but not found"
    exit 1
fi

# Check dependencies
echo "📦 Checking dependencies..."
python3 -c "import PIL, numpy, requests" 2>/dev/null || {
    echo "⚠  Missing dependencies. Installing..."
    pip3 install pillow numpy requests
}

# Navigate to script directory
cd "$(dirname "$0")"

# Run the curator
echo ""
echo "🚀 Starting image curation..."
echo ""

python3 intelligent_test_curator.py \
    --target "Donald Trump" \
    --negative-examples "Joe Biden,Mike Pence,Barack Obama,Bill Clinton,George W Bush,Ron DeSantis,Ted Cruz,Mitch McConnell" \
    --output-dir "../../test-data/trump" \
    --max-images 50

echo ""
echo "=================================="
echo "✅ Curation Complete!"
echo "=================================="
echo ""
echo "Images saved to: tests/fixtures/test-data/trump/"
echo ""
echo "Next steps:"
echo "  1. Review CURATION_SUMMARY.md for overview"
echo "  2. Check image_metadata.json for details"
echo "  3. Manually verify a few images for quality"
echo "  4. Update test specs to use these images"
echo ""
echo "Directory structure:"
ls -lh ../../test-data/trump/ 2>/dev/null || true
echo ""
