# Contributing to Face Block Extension

Thank you for your interest in contributing to Face Block! This guide will help you get started with development.

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Git
- Chrome and/or Firefox browser for testing

### Installation

1. Clone the repository:
```bash
git clone https://github.com/chenders/face-block-browser-extension.git
cd face-block-browser-extension
```

2. Install dependencies:
```bash
npm install
```

## Development Workflow

### Running in Development Mode

For Chrome development with hot reload:
```bash
npm run dev
```

For Firefox development with hot reload:
```bash
npm run dev:firefox
```

### Building for Production

Build for both browsers:
```bash
npm run build:all
```

Build for Chrome only:
```bash
npm run build
```

Build for Firefox only:
```bash
npm run build:firefox
```

### Testing

Run all tests:
```bash
npm test
```

Run tests with UI:
```bash
npm run test:ui
```

Run tests in debug mode:
```bash
npm run test:debug
```

## Project Structure

```
src/
├── entrypoints/        # WXT entry points
│   ├── background.ts   # Background script (cross-browser)
│   ├── content.ts      # Main content script
│   ├── content-preload.ts # Early CSS injection
│   └── popup/          # Extension popup UI
│       ├── index.html
│       ├── main.ts
│       └── style.css
├── public/             # Static assets (copied as-is)
│   ├── models/         # Face-api.js ML models
│   ├── libs/           # External libraries
│   ├── offscreen.*     # Chrome-specific files
│   └── icons/          # Extension icons
└── utils/              # Shared utilities
    ├── config.ts       # Configuration
    ├── storage.ts      # Storage management
    ├── photo-quality.ts # Photo quality checking
    └── firefox-face-detection.ts # Firefox-specific face detection
```

## Code Style

This project uses ESLint and Prettier for code formatting:

```bash
# Check linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## Making Changes

1. Create a new branch for your feature:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes following the code style guidelines

3. Test your changes in both Chrome and Firefox:
```bash
npm run build:all
# Load .output/chrome-mv3 in Chrome
# Load .output/firefox-mv2 in Firefox
```

4. Run tests to ensure nothing is broken:
```bash
npm test
```

5. Commit your changes with a descriptive message:
```bash
git add .
git commit -m "feat: add new feature description"
```

## Browser-Specific Considerations

### Chrome (Manifest V3)
- Uses service workers (no DOM access in background)
- Requires offscreen documents for Canvas/WebGL operations
- Output directory: `.output/chrome-mv3/`

### Firefox (Manifest V2)
- Uses event pages (has DOM access in background)
- Can run face-api.js directly in background
- Output directory: `.output/firefox-mv2/`

## Common Tasks

### Adding a New Feature

1. Identify if the feature needs browser-specific code
2. Add shared logic to `src/utils/`
3. Update content script if needed: `src/entrypoints/content.ts`
4. Update popup if UI changes needed: `src/entrypoints/popup/`
5. Handle browser differences in `src/entrypoints/background.ts`

### Updating Face Detection Models

Models are stored in `src/public/models/`. To update:
1. Download new models from face-api.js repository
2. Place them in `src/public/models/`
3. Test thoroughly as model changes can affect detection accuracy

### Debugging

#### Chrome
1. Open `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked from `.output/chrome-mv3/`
4. Click "Inspect" on background service worker
5. Use Chrome DevTools

#### Firefox
1. Open `about:debugging`
2. Click "This Firefox"
3. Load temporary add-on from `.output/firefox-mv2/`
4. Click "Inspect" button
5. Use Firefox Developer Tools

## Submitting Pull Requests

1. Ensure all tests pass
2. Update documentation if needed
3. Add tests for new features
4. Create a pull request with:
   - Clear description of changes
   - Screenshots if UI changes
   - Test results from both browsers

## Getting Help

- Check existing issues: [GitHub Issues](https://github.com/chenders/face-block-browser-extension/issues)
- Read the documentation: [README.md](README.md)
- Review architecture: [FIREFOX_MIGRATION_SUMMARY.md](FIREFOX_MIGRATION_SUMMARY.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.