# Release Guide

This document explains how to create stable releases for the Raeon.

## Automated Release Script

We provide an automated release script that handles the entire release process:

### Quick Usage

```bash
# Patch release (1.0.0 -> 1.0.1)
npm run release:patch

# Minor release (1.0.0 -> 1.1.0)  
npm run release:minor

# Major release (1.0.0 -> 2.0.0)
npm run release:major
```

### What the script does

1. **Pre-release checks**
   - Ensures you're in a git repository
   - Verifies working directory is clean
   - Validates version format

2. **Build & Test**
   - Runs tests (if they exist)
   - Cleans and builds the project
   - Updates package.json version

3. **Git Operations**
   - Creates commit with version bump
   - Creates annotated git tag (vX.Y.Z)
   - Pushes to remote repository

4. **GitHub Release** (optional)
   - Creates GitHub release with notes
   - Requires GitHub CLI (`gh`) to be installed

### Advanced Options

```bash
# Skip tests (useful for hotfixes)
npm run release:patch-skip-tests

# Or use the script directly with more options
./scripts/release.sh minor --skip-tests --skip-build

# Available options:
# --skip-tests    Skip running tests
# --skip-build    Skip building the project  
# --skip-push     Skip pushing to remote (for testing)
# --help          Show all options
```

## Manual Release Process

If you prefer to do releases manually:

1. **Update version**

   ```bash
   npm version patch  # or minor/major
   ```

2. **Build project**

   ```bash
   npm run clean
   npm run build
   ```

3. **Create git tag**

   ```bash
   git tag -a v1.0.1 -m "Release v1.0.1"
   ```

4. **Push to remote**

   ```bash
   git push origin main
   git push origin v1.0.1
   ```

5. **Create GitHub release** (optional)

   ```bash
   gh release create v1.0.1 --title "Release v1.0.1"
   ```

## Prerequisites

### Required

- Clean git working directory
- Node.js and npm installed
- Git configured with remote origin

### Optional (for GitHub releases)

- GitHub CLI installed: <https://cli.github.com/>
- Authenticated with `gh auth login`

## Version Strategy

- **Patch (X.Y.Z)**: Bug fixes, small improvements
- **Minor (X.Y.Z)**: New features, breaking changes to internal APIs
- **Major (X.Y.Z)**: Breaking changes to public APIs, major rewrites

## Hotfix Process

For urgent hotfixes to production:

```bash
# Create hotfix branch from latest tag
git checkout -b hotfix/quick-fix v1.0.1

# Make your fix...
git commit -m "fix: urgent bug fix"

# Release hotfix
npm run release:patch-skip-tests
```

## Troubleshooting

### "Working directory is not clean"

```bash
# Either commit your changes
git add .
git commit -m "WIP"

# Or stash them temporarily
git stash
npm run release:patch
git stash pop
```

### "GitHub CLI not found"

Install GitHub CLI or skip GitHub release creation:

```bash
./scripts/release.sh patch --skip-push
# Then manually push and create release on GitHub
```

### Tests fail

Either fix the tests or skip them for hotfixes:

```bash
npm run release:patch-skip-tests
```
