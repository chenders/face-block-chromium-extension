# CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing, building, and releasing the Face Block Chrome Extension.

## Workflows

### Core CI/CD

#### `ci.yml` - Continuous Integration
**Triggers**: Push to `main` or `dev` branches, Pull requests to `main` or `dev`

Runs on every push and PR to ensure code quality:
- **Lint Job**: Runs ESLint and Prettier format checks
- **Test Job**: Runs Playwright tests with xvfb (virtual display for extension testing)
- **Build Job**: Creates extension package ZIP file

**Key Features**:
- Uses `xvfb-run` to provide virtual display for Chrome extension tests
- Uploads test results and build artifacts
- Build job only runs if lint and test jobs pass

#### `test.yml` - Legacy Test Workflow
**Triggers**: Push to `main`, Pull requests to `main`

Similar to CI workflow but focused only on testing. Runs tests with 60-minute timeout.

---

### Release Management

#### `release.yml` - Automated Releases
**Triggers**: Push of version tags (e.g., `v1.0.0`)

Automates the release process when you tag a new version:

```bash
# Create and push a new release
git tag v1.0.0
git push origin v1.0.0
```

**Release Steps**:
1. ✅ Validates version consistency across:
   - `package.json`
   - `extension/manifest.json`
   - Git tag
2. 🧪 Runs lint, format check, and full test suite
3. 📦 Builds extension package
4. 🔍 Validates package size (< 128MB Chrome Web Store limit)
5. 🚀 Creates GitHub release with ZIP file attached
6. 📤 Uploads release artifact

---

### Code Quality

#### `pr-labeler.yml` - Auto-label Pull Requests
**Triggers**: PR opened, synchronized, or reopened

Automatically adds labels to PRs based on changed files:
- `extension` - Changes to extension code
- `tests` - Changes to test files
- `documentation` - Changes to markdown/docs
- `ci-cd` - Changes to GitHub Actions or Husky
- `configuration` - Changes to config files
- `dependencies` - Changes to package.json
- `build` - Changes to build scripts
- `store-assets` - Changes to Chrome Web Store assets

Configuration in `.github/labeler.yml`

#### `stale.yml` - Stale Issue Management
**Triggers**: Daily at midnight UTC, Manual dispatch

Helps maintain issue and PR hygiene:
- **Issues**: Marked stale after 60 days, closed after 7 more days
- **PRs**: Marked stale after 30 days, closed after 7 more days
- **Exemptions**: `pinned`, `security`, `enhancement`, `bug`, `work-in-progress`

---

### Dependency Management

#### `dependabot.yml` - Automated Dependency Updates
**Schedule**: Weekly on Mondays at 9am UTC

Automatically creates PRs to update dependencies:

**NPM Dependencies**:
- Groups minor and patch updates together
- Separate groups for dev and production dependencies
- Labels: `dependencies`, `automated`
- Max 10 open PRs

**GitHub Actions**:
- Updates action versions
- Labels: `dependencies`, `github-actions`, `automated`
- Max 5 open PRs

---

## Pre-Push Hook

The project uses Husky for Git hooks. Before every push, it automatically:

1. ✨ Runs ESLint
2. 🎨 Checks Prettier formatting
3. 🧪 Runs full test suite

This ensures no broken code reaches the repository.

**Note**: If tests take too long, you can skip the hook with:
```bash
git push --no-verify origin branch-name
```
(Not recommended for main/dev branches)

---

## Testing in CI

### Why xvfb?

Chrome extensions **cannot** run in headless mode - they require a visible browser window. CI environments don't have displays, so we use `xvfb-run` to provide a virtual X server.

```yaml
run: xvfb-run --auto-servernum --server-args="-screen 0 1280x960x24" npm test
```

This creates a virtual 1280x960 display with 24-bit color for the tests to run in.

---

## Release Process

### Versioning

The project uses semantic versioning (MAJOR.MINOR.PATCH):
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

### Creating a Release

1. Update version in both files:
   ```bash
   npm version patch  # or minor, or major
   # This updates both package.json and creates a git tag
   ```

2. Update manifest.json manually:
   ```json
   {
     "version": "1.0.1"
   }
   ```

3. Commit and tag:
   ```bash
   git add extension/manifest.json
   git commit -m "chore: bump version to 1.0.1"
   git push origin dev
   git push origin v1.0.1
   ```

4. Release workflow automatically:
   - Validates versions match
   - Runs all tests
   - Creates GitHub release
   - Attaches extension ZIP

---

## Artifacts

### Test Results
- **Retention**: 30 days
- **Contents**: Playwright test results and reports
- **Access**: Available in GitHub Actions run summary

### Built Packages
- **Retention**: 90 days
- **Contents**: Extension ZIP file ready for Chrome Web Store
- **Access**: Attached to GitHub releases and CI runs

### Release Packages
- **Retention**: Indefinite (attached to releases)
- **Contents**: Production-ready extension ZIP
- **Access**: GitHub Releases page

---

## Monitoring

### Dependencies
- Review Dependabot PRs: Pull Requests tab (filtered by `dependencies` label)

### Build Status
- All workflows visible: Repository → Actions tab
- Status badges can be added to README

### Test Coverage
- Test results uploaded as artifacts
- View in Actions run summary

---

## Troubleshooting

### Tests failing in CI but passing locally?
- Ensure local tests use the xvfb command (if on Linux)
- Check for timing issues (CI may be slower)
- Review test timeout settings in `playwright.config.js`

### Release workflow failing on version check?
```
Error: Version mismatch between package.json and manifest.json
```
- Update both `package.json` and `extension/manifest.json` to same version
- Ensure git tag matches versions (e.g., tag `v1.0.0` for version `1.0.0`)

### Dependabot PRs failing tests?
- Dependencies may have breaking changes
- Review changelog of updated packages
- Update code to match new API if needed
- Can close the PR to skip the update

---

## Future Enhancements

Potential additions:
- [ ] Test coverage reporting with Codecov
- [ ] Performance benchmarking workflow
- [ ] Automatic Chrome Web Store submission
- [ ] Changelog generation from commits
- [ ] Release notes from PR descriptions
