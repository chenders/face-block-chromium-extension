.PHONY: help build test lint format clean curate-images install check-test-images

# Default target
.DEFAULT_GOAL := help

## help: Show this help message
help:
	@echo "Face Block Chromium Extension - Available Commands"
	@echo ""
	@grep -E '^## ' Makefile | sed 's/## /  /' | sed 's/:/ -/' | grep -v help:
	@echo ""

## install: Install dependencies
install:
	@echo "Installing Node.js dependencies..."
	npm install
	@echo "✓ Dependencies installed"

## build: Build extension for Chrome Web Store (runs lint and format check first)
build: lint format-check
	@echo "Building extension for Chrome Web Store..."
	bash build-for-store.sh
	@echo "✓ Build complete"

## test: Run all tests (auto-generates test images if missing)
test: check-test-images
	@echo "Running tests..."
	npx playwright test

# Internal target: Check if test images exist, generate if missing
check-test-images:
	@if [ ! -d "tests/fixtures/test-data/trump/source_images" ] || [ -z "$$(ls -A tests/fixtures/test-data/trump/source_images 2>/dev/null)" ]; then \
		echo "⚠  Test images not found. Running image curator..."; \
		$(MAKE) curate-images; \
	else \
		echo "✓ Test images found"; \
	fi

## test-debug: Run tests in debug mode (auto-generates test images if missing)
test-debug: check-test-images
	@echo "Running tests in debug mode..."
	npx playwright test --debug

## test-ui: Run tests with UI (auto-generates test images if missing)
test-ui: check-test-images
	@echo "Running tests with UI..."
	npx playwright test --ui

## test-perf: Run performance profiling tests (auto-generates test images if missing)
test-perf: check-test-images perf-generate
	@echo "Running performance tests..."
	npx playwright test performance-profiling.spec.js

## perf-generate: Generate performance test page
perf-generate:
	@echo "Generating performance test page..."
	node scripts/generate-performance-test-page.js

## lint: Lint JavaScript files
lint:
	@echo "Linting code..."
	npx eslint extension/**/*.js tests/**/*.js scripts/**/*.js --no-warn-ignored

## lint-fix: Lint and fix JavaScript files
lint-fix:
	@echo "Linting and fixing code..."
	npx eslint extension/**/*.js tests/**/*.js scripts/**/*.js --fix --no-warn-ignored

## format: Format code with Prettier
format:
	@echo "Formatting code..."
	npx prettier --write "extension/**/*.{js,html,css,json}" "tests/**/*.js" "scripts/**/*.js"

## format-check: Check code formatting
format-check:
	@echo "Checking code formatting..."
	npx prettier --check "extension/**/*.{js,html,css,json}" "tests/**/*.js" "scripts/**/*.js"

## screenshots: Capture screenshots for Chrome Web Store
screenshots:
	@echo "Capturing screenshots..."
	node scripts/capture-screenshots.js

## curate-images: Run image curator to download test images
curate-images:
	@echo "Running image curator..."
	@echo "⚠ This will download ~50 Trump images + negative examples"
	@cd tests/fixtures/generators/image-curator && bash curate_trump_images.sh
	@echo "✓ Image curation complete"

## clean: Remove generated files and caches
clean:
	@echo "Cleaning generated files..."
	rm -rf test-results/
	rm -rf playwright-report/
	rm -rf .playwright/
	rm -rf .temp-profile/
	rm -rf tests/fixtures/test-data/
	rm -rf .image_cache/
	rm -f face-block-extension-*.zip
	@echo "✓ Clean complete"

## clean-all: Remove all generated files and dependencies
clean-all: clean
	@echo "Removing all dependencies..."
	rm -rf node_modules/
	@echo "✓ All clean"
