#!/bin/bash
# Curate comprehensive Trump test images
# This script downloads ~50 Trump images from across decades (1980s-2024)
# plus negative examples (Biden, Pence, etc.) for false positive testing
#
# Usage:
#   ./curate_trump_images.sh          # Download and validate (auto-filter)
#   ./curate_trump_images.sh --review # Download, validate, and launch interactive review
#
# CI/Husky Mode:
#   When CI=true, HUSKY=1, or running in non-interactive terminal (git hooks),
#   automatically removes existing images and auto-approves all

set -e

# Detect CI environment, Husky git hook, or non-interactive terminal
IS_CI=0
if [[ -n "${CI:-}" ]] || [[ -n "${GITHUB_ACTIONS:-}" ]] || [[ -n "${GITLAB_CI:-}" ]] || [[ -n "${CIRCLECI:-}" ]] || [[ -n "${TRAVIS:-}" ]] || [[ -n "${HUSKY:-}" ]] || [[ "$HUSKY" == "1" ]] || [[ ! -t 0 ]]; then
    IS_CI=1
fi

# Parse arguments
REVIEW_MODE=0
if [[ "$1" == "--review" ]]; then
    REVIEW_MODE=1
fi

echo "=================================="
echo "Trump Test Image Curator"
if [[ $IS_CI -eq 1 ]]; then
    echo "(CI Mode - Auto-removing & Auto-approving)"
fi
echo "=================================="
echo ""
echo "This will:"
echo "  - Download ~50 Trump images (1980s-2024)"
echo "  - Download ~40 negative examples"
echo "  - Auto-filter non-portrait & duplicate images"
echo "  - Validate with face detection"
if [[ $REVIEW_MODE -eq 1 ]]; then
    if [[ $IS_CI -eq 1 ]]; then
        echo "  - Auto-approve all images (CI mode)"
    else
        echo "  - Launch web-based interactive review tool"
    fi
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

# Check for existing test images
OUTPUT_DIR="../../test-data/trump"
PENDING_DIR="$OUTPUT_DIR/pending_review"
SOURCE_DIR="$OUTPUT_DIR/source_images"
REJECTED_DIR="$OUTPUT_DIR/rejected"

# Count existing images
pending_count=0
source_count=0
rejected_count=0

if [[ -d "$PENDING_DIR" ]]; then
    pending_count=$(find "$PENDING_DIR" -type f \( -name "*.jpg" -o -name "*.png" \) 2>/dev/null | wc -l | tr -d ' ')
fi

if [[ -d "$SOURCE_DIR" ]]; then
    source_count=$(find "$SOURCE_DIR" -type f \( -name "*.jpg" -o -name "*.png" \) 2>/dev/null | wc -l | tr -d ' ')
fi

if [[ -d "$REJECTED_DIR" ]]; then
    rejected_count=$(find "$REJECTED_DIR" -type f \( -name "*.jpg" -o -name "*.png" \) 2>/dev/null | wc -l | tr -d ' ')
fi

total_existing=$((pending_count + source_count + rejected_count))

# If existing images found, prompt user (or auto-remove in CI)
if [[ $total_existing -gt 0 ]]; then
    echo ""
    echo "⚠️  Existing test images found:"
    [[ $pending_count -gt 0 ]] && echo "   - pending_review: $pending_count images"
    [[ $source_count -gt 0 ]] && echo "   - source_images: $source_count images"
    [[ $rejected_count -gt 0 ]] && echo "   - rejected: $rejected_count images"
    echo ""

    if [[ $IS_CI -eq 1 ]]; then
        echo "CI environment detected: Automatically removing existing images..."
        choice=1
    else
        echo "What would you like to do?"
        echo "  1) Remove all existing images and start fresh"
        echo "  2) Keep existing images and add new ones"
        echo "  3) Cancel"
        echo ""
        read -p "Choice [1-3]: " choice
    fi

    case $choice in
        1)
            echo ""
            echo "Removing existing images..."
            [[ -d "$PENDING_DIR" ]] && rm -rf "$PENDING_DIR"
            [[ -d "$SOURCE_DIR" ]] && rm -rf "$SOURCE_DIR"
            [[ -d "$REJECTED_DIR" ]] && rm -rf "$REJECTED_DIR"
            # Also remove metadata files
            [[ -f "$OUTPUT_DIR/image_metadata.json" ]] && rm "$OUTPUT_DIR/image_metadata.json"
            [[ -f "$OUTPUT_DIR/CURATION_SUMMARY.md" ]] && rm "$OUTPUT_DIR/CURATION_SUMMARY.md"
            echo "✓ Removed $total_existing images"
            echo ""
            ;;
        2)
            echo ""
            echo "Keeping existing images, will add new ones..."
            echo ""
            ;;
        3)
            echo ""
            echo "Cancelled by user"
            exit 0
            ;;
        *)
            echo ""
            echo "Invalid choice. Cancelled."
            exit 1
            ;;
    esac
fi

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

# Launch review tool if requested (or auto-approve in CI)
if [[ $REVIEW_MODE -eq 1 ]]; then
    if [[ $IS_CI -eq 1 ]]; then
        echo "CI environment detected: Auto-approving all images..."
        echo ""

        # Auto-approve all images by moving them from pending_review
        # We'll use the curator's logic to categorize them appropriately
        if [[ -d "$OUTPUT_DIR/pending_review" ]] && [[ -n "$(ls -A "$OUTPUT_DIR/pending_review" 2>/dev/null)" ]]; then
            # Create category directories
            mkdir -p "$OUTPUT_DIR/source"

            # Move all pending images to source
            mv "$OUTPUT_DIR/pending_review"/* "$OUTPUT_DIR/source/" 2>/dev/null || true

            # Remove empty pending_review directory
            rmdir "$OUTPUT_DIR/pending_review" 2>/dev/null || true

            echo "✓ Auto-approved all images"
        else
            echo "No images to approve"
        fi

        echo ""
        echo "=================================="
        echo "✅ Auto-Approval Complete!"
        echo "=================================="
        echo ""
    else
        echo "🖼️  Launching web-based review tool..."
        echo ""
        poetry run python web_review_curated_images.py \
            --input "../../test-data/trump/pending_review" \
            --output "../../test-data/trump"

        echo ""
        echo "=================================="
        echo "✅ Review Complete!"
        echo "=================================="
        echo ""
    fi
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
