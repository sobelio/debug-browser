#!/usr/bin/env bash
set -euo pipefail

PREFIX="${HOME}/.local"

# Parse arguments
for arg in "$@"; do
    case "$arg" in
        --prefix=*)
            PREFIX="${arg#*=}"
            ;;
        --prefix)
            # handled in next iteration
            ;;
        *)
            # Check if previous arg was --prefix
            if [[ "${prev_arg:-}" == "--prefix" ]]; then
                PREFIX="$arg"
            fi
            ;;
    esac
    prev_arg="$arg"
done

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "Installing debug-browser to ${PREFIX}"
echo ""

# Step 1: Build Rust CLI
echo "==> Building Rust CLI..."
(cd "${PROJECT_DIR}" && cargo build --release)

# Step 2: Build daemon
echo "==> Building daemon..."
(cd "${PROJECT_DIR}/daemon" && npm install && npm run build)

# Step 3: Install binary
echo "==> Installing binary to ${PREFIX}/bin/"
install -d "${PREFIX}/bin"
install -m 755 "${PROJECT_DIR}/target/release/debug-browser" "${PREFIX}/bin/debug-browser"

# Step 4: Install daemon files
DAEMON_DEST="${PREFIX}/share/debug-browser/daemon"
echo "==> Installing daemon to ${DAEMON_DEST}/"

# Create directories
install -d "${DAEMON_DEST}/dist"

# Copy daemon dist (compiled JS + scripts)
cp -r "${PROJECT_DIR}/daemon/dist/" "${DAEMON_DEST}/dist/"

# Copy package.json (needed by node for module resolution)
cp "${PROJECT_DIR}/daemon/package.json" "${DAEMON_DEST}/package.json"

# Install production-only node_modules
echo "==> Installing production dependencies..."
(cd "${DAEMON_DEST}" && npm install --omit=dev --no-package-lock 2>/dev/null)

echo ""
echo "==> Installation complete!"
echo ""
echo "Binary:  ${PREFIX}/bin/debug-browser"
echo "Daemon:  ${DAEMON_DEST}/dist/daemon.js"
echo ""

# Check if PREFIX/bin is in PATH
if [[ ":${PATH}:" != *":${PREFIX}/bin:"* ]]; then
    echo "Add ${PREFIX}/bin to your PATH:"
    echo "  export PATH=\"${PREFIX}/bin:\$PATH\""
    echo ""
fi

echo "DEBUG_BROWSER_HOME is auto-discovered from the binary location."
echo "To override, set: export DEBUG_BROWSER_HOME=${PREFIX}/share/debug-browser"
