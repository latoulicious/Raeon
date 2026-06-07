#!/bin/bash

# Release script for Raeon Discord Bot
# Creates stable releases with proper versioning and git tags

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="raeon"
GITHUB_REPO="latoulicious/Raeon"  # Update this with your actual repo

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "Not in a git repository"
        exit 1
    fi
}

# Check if working directory is clean
check_clean_workspace() {
    if ! git diff-index --quiet HEAD --; then
        log_error "Working directory is not clean. Please commit or stash changes first."
        exit 1
    fi
}

# Get current version from package.json
get_current_version() {
    node -p "require('./package.json').version"
}

# Validate version format (semver)
validate_version() {
    local version=$1
    if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        log_error "Invalid version format: $version. Expected format: X.Y.Z"
        exit 1
    fi
}

# Bump version based on type
bump_version() {
    local current_version=$1
    local bump_type=$2
    
    IFS='.' read -ra VERSION_PARTS <<< "$current_version"
    local major=${VERSION_PARTS[0]}
    local minor=${VERSION_PARTS[1]}
    local patch=${VERSION_PARTS[2]}
    
    case $bump_type in
        "patch")
            patch=$((patch + 1))
            ;;
        "minor")
            minor=$((minor + 1))
            patch=0
            ;;
        "major")
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        *)
            log_error "Invalid bump type: $bump_type. Use: patch, minor, or major"
            exit 1
            ;;
    esac
    
    echo "$major.$minor.$patch"
}

# Update package.json version
update_package_version() {
    local new_version=$1
    log_info "Updating package.json version to $new_version"
    npm version $new_version --no-git-tag-version
}

# Run tests before release
run_tests() {
    log_info "Running tests..."
    if npm test 2>/dev/null; then
        log_success "All tests passed"
    else
        log_warning "No tests found or tests failed. Continuing anyway..."
    fi
}

# Build the project
build_project() {
    log_info "Building project..."
    npm run clean
    npm run build
    log_success "Build completed"
}

# Create git commit and tag
create_git_tag() {
    local version=$1
    local tag_name="v$version"
    
    log_info "Creating git commit and tag: $tag_name"
    
    # Add updated package.json + lockfile (npm version bumps both)
    git add package.json package-lock.json
    git commit -m "chore(release): bump version to $tag_name"
    
    # Create annotated tag
    git tag -a "$tag_name" -m "Release $tag_name"
    
    log_success "Git tag $tag_name created"
}

# Push to remote
push_to_remote() {
    local version=$1
    local tag_name="v$version"
    
    log_info "Pushing commits and tags to remote..."
    git push origin main
    git push origin "$tag_name"
    log_success "Pushed to remote repository"
}

# Create GitHub release (requires gh CLI)
create_github_release() {
    local version=$1
    local tag_name="v$version"
    
    if command -v gh &> /dev/null; then
        log_info "Creating GitHub release..."
        
        # Generate release notes
        local release_notes="## Release $tag_name
        
### Changes
- Version bump to $tag_name
- Built and tested with latest dependencies

### Installation
\`\`\`bash
# Clone the repository
git clone https://github.com/$GITHUB_REPO.git
cd Raeon

# Checkout the release tag
git checkout $tag_name

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Build and run
npm run build
npm start
\`\`\`

### Docker
\`\`\`bash
# Using Docker Compose
docker-compose up -d --build
\`\`\`"

        echo "$release_notes" | gh release create "$tag_name" --title "Release $tag_name" --notes-file -
        log_success "GitHub release created"
    else
        log_warning "GitHub CLI (gh) not found. Skipping GitHub release creation."
        log_info "To install GitHub CLI: https://cli.github.com/"
    fi
}

# Main release function
perform_release() {
    local bump_type=${1:-"patch"}
    local skip_tests=${2:-false}
    local skip_build=${3:-false}
    local skip_push=${4:-false}
    
    log_info "Starting release process for $PROJECT_NAME"
    
    # Pre-release checks
    check_git_repo
    check_clean_workspace
    
    # Get current version
    local current_version=$(get_current_version)
    log_info "Current version: $current_version"
    
    # Calculate new version
    local new_version=$(bump_version "$current_version" "$bump_type")
    validate_version "$new_version"
    log_info "New version will be: $new_version"
    
    # Confirmation
    echo -n "Do you want to continue with release $new_version? (y/N): "
    read -r confirmation
    if [[ ! $confirmation =~ ^[Yy]$ ]]; then
        log_info "Release cancelled by user"
        exit 0
    fi
    
    # Run tests (unless skipped)
    if [[ "$skip_tests" != "true" ]]; then
        run_tests
    fi
    
    # Build project (unless skipped)
    if [[ "$skip_build" != "true" ]]; then
        build_project
    fi
    
    # Update version
    update_package_version "$new_version"
    
    # Create git tag
    create_git_tag "$new_version"
    
    # Push to remote (unless skipped)
    if [[ "$skip_push" != "true" ]]; then
        push_to_remote "$new_version"
        create_github_release "$new_version"
    else
        log_warning "Skipping push to remote. Don't forget to push manually:"
        log_info "  git push origin main"
        log_info "  git push origin v$new_version"
    fi
    
    log_success "Release $new_version completed successfully!"
}

# Show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] <release-type>"
    echo ""
    echo "Release types:"
    echo "  patch    - Bump patch version (1.0.0 -> 1.0.1) [default]"
    echo "  minor    - Bump minor version (1.0.0 -> 1.1.0)"
    echo "  major    - Bump major version (1.0.0 -> 2.0.0)"
    echo ""
    echo "Options:"
    echo "  --skip-tests    Skip running tests"
    echo "  --skip-build    Skip building the project"
    echo "  --skip-push     Skip pushing to remote repository"
    echo "  --help, -h      Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 patch                    # Patch release with all checks"
    echo "  $0 minor --skip-tests        # Minor release without tests"
    echo "  $0 major --skip-push         # Major release but don't push"
}

# Parse command line arguments
SKIP_TESTS=false
SKIP_BUILD=false
SKIP_PUSH=false
RELEASE_TYPE="patch"

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-push)
            SKIP_PUSH=true
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        patch|minor|major)
            RELEASE_TYPE=$1
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Run the release
perform_release "$RELEASE_TYPE" "$SKIP_TESTS" "$SKIP_BUILD" "$SKIP_PUSH"
