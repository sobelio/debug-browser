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
            if [[ "${prev_arg:-}" == "--prefix" ]]; then
                PREFIX="$arg"
            fi
            ;;
    esac
    prev_arg="$arg"
done

echo "Uninstalling debug-browser from ${PREFIX}"
echo ""

# Remove binary
if [[ -f "${PREFIX}/bin/debug-browser" ]]; then
    echo "==> Removing ${PREFIX}/bin/debug-browser"
    rm -f "${PREFIX}/bin/debug-browser"
else
    echo "==> Binary not found at ${PREFIX}/bin/debug-browser (skipping)"
fi

# Remove daemon files
if [[ -d "${PREFIX}/share/debug-browser" ]]; then
    echo "==> Removing ${PREFIX}/share/debug-browser/"
    rm -rf "${PREFIX}/share/debug-browser"
else
    echo "==> Daemon directory not found at ${PREFIX}/share/debug-browser (skipping)"
fi

echo ""
echo "==> Uninstall complete."
