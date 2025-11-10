#!/bin/bash
# Build script to package Chrome extension for Chrome Web Store
# Usage: ./build-for-store.sh

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Chrome Extension for Web Store...${NC}"

# Configuration (update these values before publishing)
EXTENSION_NAME="face-block-chromium-extension"
VERSION=$(node -p "require('./package.json').version")
BUILD_DIR="./build"
DIST_DIR="./dist"
ZIP_NAME="${EXTENSION_NAME}-v${VERSION}.zip"

# Create build and dist directories
echo -e "${YELLOW}Creating build directories...${NC}"
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Copy extension files
echo -e "${YELLOW}Copying extension files...${NC}"
cp -r extension/* "$BUILD_DIR/"

# Run linter to ensure code quality
echo -e "${YELLOW}Running linter...${NC}"
npm run lint

# Run formatter check
echo -e "${YELLOW}Checking code formatting...${NC}"
npm run format:check

# Remove any development files from build
echo -e "${YELLOW}Cleaning development files...${NC}"
find "$BUILD_DIR" -name "*.map" -type f -delete
find "$BUILD_DIR" -name ".DS_Store" -type f -delete

# Create ZIP file for Chrome Web Store
echo -e "${YELLOW}Creating ZIP package...${NC}"
cd "$BUILD_DIR"
zip -r "../${DIST_DIR}/${ZIP_NAME}" . -x "*.git*" -x "*node_modules*" -x "*.DS_Store"
cd ..

# Verify ZIP was created
if [ -f "${DIST_DIR}/${ZIP_NAME}" ]; then
  FILE_SIZE=$(du -h "${DIST_DIR}/${ZIP_NAME}" | cut -f1)
  echo -e "${GREEN}✓ Package created successfully!${NC}"
  echo -e "${GREEN}  File: ${DIST_DIR}/${ZIP_NAME}${NC}"
  echo -e "${GREEN}  Size: ${FILE_SIZE}${NC}"
  echo ""
  echo -e "${YELLOW}Next steps:${NC}"
  echo "1. Go to https://chrome.google.com/webstore/devconsole"
  echo "2. Click 'New Item' or select existing item to update"
  echo "3. Upload ${ZIP_NAME}"
  echo "4. Fill in store listing details (see STORE_LISTING.md for template)"
  echo "5. Submit for review"
else
  echo -e "${RED}✗ Failed to create package${NC}"
  exit 1
fi
