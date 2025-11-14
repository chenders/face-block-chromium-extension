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

## test-smoke: Run smoke tests only (fast subset for CI, auto-generates test images if missing)
test-smoke: check-test-images
	@echo "Running smoke tests..."
	SMOKE_TESTS=1 npx playwright test

# Internal target: Check if test images exist, generate if missing
check-test-images:
	@if [ ! -d "tests/fixtures/test-data/trump/source" ] || [ -z "$$(ls -A tests/fixtures/test-data/trump/source 2>/dev/null)" ]; then \
		echo "⚠  Test images not found. Running image curator..."; \
		CI=true $(MAKE) curate-images; \
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

# Internal target: Check image curator dependencies
check-curator-deps:
	@echo "Checking dependencies..."
	@# Check if poetry is installed
	@if ! command -v poetry >/dev/null 2>&1; then \
		echo ""; \
		echo "❌ Error: poetry is not installed"; \
		echo ""; \
		echo "poetry is required to manage Python dependencies"; \
		echo ""; \
		echo "Install poetry:"; \
		echo "  curl -sSL https://install.python-poetry.org | python3 -"; \
		echo ""; \
		echo "Or visit: https://python-poetry.org/docs/#installation"; \
		echo ""; \
		exit 1; \
	fi
	@echo "✓ poetry found"
	@# Check if Python packages are installed
	@cd tests/fixtures/generators/image-curator && \
	if ! poetry run python -c "import face_recognition, imagehash, cv2" >/dev/null 2>&1; then \
		echo ""; \
		echo "⚠️  Required Python packages not found"; \
		echo ""; \
		echo "To curate images with face detection and duplicate filtering,"; \
		echo "we need to install the following libraries:"; \
		echo "  - face-recognition (face detection)"; \
		echo "  - imagehash (duplicate detection)"; \
		echo "  - opencv-python (image processing)"; \
		echo ""; \
		echo "This will download and compile ~200MB of dependencies."; \
		echo "⏱️  This may take 3-5 minutes but only happens once."; \
		echo ""; \
		read -p "Press any key to continue or Ctrl+C to cancel..." -n1 -s; \
		echo ""; \
		echo ""; \
	fi
	@if ! command -v cmake >/dev/null 2>&1; then \
		echo ""; \
		echo "❌ Error: cmake is not installed"; \
		echo ""; \
		echo "cmake is required to build face-recognition (dlib dependency)"; \
		echo ""; \
		if [ "$$(uname)" = "Darwin" ]; then \
			echo "Install on macOS:"; \
			echo "  brew install cmake"; \
		elif [ "$$(uname)" = "Linux" ]; then \
			if command -v apt-get >/dev/null 2>&1; then \
				echo "Install on Ubuntu/Debian:"; \
				echo "  sudo apt-get update && sudo apt-get install cmake"; \
			elif command -v yum >/dev/null 2>&1; then \
				echo "Install on RedHat/CentOS:"; \
				echo "  sudo yum install cmake"; \
			elif command -v dnf >/dev/null 2>&1; then \
				echo "Install on Fedora:"; \
				echo "  sudo dnf install cmake"; \
			elif command -v pacman >/dev/null 2>&1; then \
				echo "Install on Arch Linux:"; \
				echo "  sudo pacman -S cmake"; \
			else \
				echo "Install cmake using your Linux package manager"; \
			fi; \
		else \
			echo "Please install cmake for your operating system"; \
			echo "Visit: https://cmake.org/download/"; \
		fi; \
		echo ""; \
		exit 1; \
	fi
	@echo "✓ cmake found"

## curate-images: Run image curator to download test images (auto-approves in CI/non-interactive mode)
curate-images: check-curator-deps
	@echo ""
	@echo "Running image curator..."
	@echo "⚠ This will download ~50 Trump images + negative examples"
	@cd tests/fixtures/generators/image-curator && bash curate_trump_images.sh --review
	@echo "✓ Image curation complete"

## curate-images-review: Run image curator with interactive review
curate-images-review: check-curator-deps
	@echo ""
	@echo "Running image curator with interactive review..."
	@echo "⚠ This will download ~50 Trump images + negative examples"
	@cd tests/fixtures/generators/image-curator && bash curate_trump_images.sh --review
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
