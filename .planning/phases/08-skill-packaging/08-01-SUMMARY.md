---
phase: 08-skill-packaging
plan: 01
status: complete
start: 2026-03-15T13:17:51Z
end: 2026-03-15T13:25:00Z
duration: ~7min
tasks_completed: 2
tasks_total: 2
deviations: 0
---

# Plan 08-01 Summary: Daemon Discovery & Install Script

## Objective
Fix daemon discovery so debug-browser works when installed standalone, and create an install script for standard layout.

## Tasks Completed

### Task 1: Rewrite find_daemon_js() with runtime-only discovery
- Removed `env!("CARGO_MANIFEST_DIR")` compile-time path from `src/connection.rs`
- New 6-step discovery order: DEBUG_BROWSER_DAEMON_PATH env, DEBUG_BROWSER_HOME env, exe-relative co-located, Nix/FHS share/, FHS lib/, cargo target/ dev layout
- Error message now mentions both env var options
- Verified: `cargo build --release` succeeds, 0 CARGO_MANIFEST_DIR references

### Task 2: Create install and uninstall scripts
- Created `scripts/install.sh` with `--prefix` support (default `~/.local`)
- Builds Rust CLI + daemon, installs to FHS layout: `bin/` + `share/debug-browser/daemon/`
- Production-only node_modules via `npm install --omit=dev`
- Created `scripts/uninstall.sh` for clean removal
- Verified: full install/run/uninstall cycle at `/tmp/debug-browser-test`

## Deviations
None.

## Issues Found
None.

## Commits
- `cad8c06` feat(08-01): rewrite find_daemon_js() with runtime-only discovery
- `cd94336` feat(08-01): add install and uninstall scripts
