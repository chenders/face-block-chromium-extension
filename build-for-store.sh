#!/bin/bash
# Build script to package browser extensions for distribution
# Usage: ./build-for-store.sh [chrome|firefox|all]

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
EXTENSION_NAME="face-block"
VERSION=$(node -p "require('./package.json').version")
TARGET=${1:-all}

echo -e "${GREEN}Building Face Block Extension v${VERSION}...${NC}"

# Clean previous builds
echo -e "${YELLOW}Cleaning previous builds...${NC}"
rm -rf .output/

# Run linter to ensure code quality
echo -e "${YELLOW}Running linter...${NC}"
npm run lint

# Run formatter check
echo -e "${YELLOW}Checking code formatting...${NC}"
npm run format:check

# Build based on target
case "$TARGET" in
  chrome)
    echo -e "${YELLOW}Building for Chrome...${NC}"
    npm run build
    npm run zip
    echo -e "${GREEN}✓ Chrome build complete: .output/${EXTENSION_NAME}-${VERSION}-chrome.zip${NC}"
    ;;
  firefox)
    echo -e "${YELLOW}Building for Firefox...${NC}"
    npm run build:firefox
    npm run zip:firefox
    echo -e "${GREEN}✓ Firefox build complete: .output/${EXTENSION_NAME}-${VERSION}-firefox.zip${NC}"
    ;;
  all)
    echo -e "${YELLOW}Building for all browsers...${NC}"
    npm run build:all
    npm run zip
    npm run zip:firefox
    echo -e "${GREEN}✓ Chrome build complete: .output/${EXTENSION_NAME}-${VERSION}-chrome.zip${NC}"
    echo -e "${GREEN}✓ Firefox build complete: .output/${EXTENSION_NAME}-${VERSION}-firefox.zip${NC}"
    ;;
  *)
    echo -e "${RED}Invalid target: $TARGET${NC}"
    echo "Usage: ./build-for-store.sh [chrome|firefox|all]"
    exit 1
    ;;
esac

echo -e "${GREEN}Build complete!${NC}"

# Show file sizes
echo -e "${YELLOW}Build sizes:${NC}"
if [ -f ".output/${EXTENSION_NAME}-${VERSION}-chrome.zip" ]; then
  ls -lh ".output/${EXTENSION_NAME}-${VERSION}-chrome.zip" | awk '{print "  Chrome:  " $5}'
fi
if [ -f ".output/${EXTENSION_NAME}-${VERSION}-firefox.zip" ]; then
  ls -lh ".output/${EXTENSION_NAME}-${VERSION}-firefox.zip" | awk '{print "  Firefox: " $5}'
fi