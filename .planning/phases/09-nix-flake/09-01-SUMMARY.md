---
phase: 09-nix-flake
plan: 01
subsystem: infra
tags: [nix, flake, crane, buildNpmPackage, makeWrapper, importNpmLock]

# Dependency graph
requires:
  - phase: 08-skill-packaging
    provides: daemon discovery via DEBUG_BROWSER_DAEMON_PATH env var
provides:
  - flake.nix with three derivations (daemon, CLI, wrapper)
  - nix build producing wrapped debug-browser binary
  - nix profile install support
affects: [10-repo-publish]

# Tech tracking
tech-stack:
  added: [crane, flake-utils, importNpmLock, makeWrapper]
  patterns: [separate-derivations-composed-via-wrapper, platform-conditional-browser-wrapping]

key-files:
  created: [flake.nix, flake.lock]
  modified: [.gitignore]

key-decisions:
  - "Used importNpmLock instead of npmDepsHash for zero-maintenance dependency resolution"
  - "Platform-conditional PLAYWRIGHT_BROWSERS_PATH: Linux only, macOS uses system Chrome"
  - "buildNpmPackage runs npm build (tsc) rather than dontNpmBuild since daemon/dist/ is gitignored"

patterns-established:
  - "Three-derivation composition: daemon (buildNpmPackage) + cli (crane) + wrapper (symlinkJoin + makeWrapper)"
  - "Platform-conditional wrapping: PLAYWRIGHT_BROWSERS_PATH on Linux, nothing on Darwin"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-03-15
---

# Phase 9 Plan 1: Nix Flake Summary

**Nix flake with crane for Rust CLI, buildNpmPackage for TypeScript daemon, and makeWrapper composing both with node and platform-conditional Playwright browser**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-15T14:12:08Z
- **Completed:** 2026-03-15T14:15:31Z
- **Tasks:** 2
- **Files modified:** 2 (created: flake.nix, flake.lock; modified: .gitignore)

## Accomplishments
- Created flake.nix with three derivations: daemon (buildNpmPackage + importNpmLock), CLI (crane with incremental caching), and composed wrapper (symlinkJoin + makeWrapper)
- nix build succeeds, producing a wrapped binary that finds daemon via DEBUG_BROWSER_DAEMON_PATH and has node on PATH
- Platform-conditional: PLAYWRIGHT_BROWSERS_PATH set on Linux only (macOS has no Chromium in nixpkgs)
- nix flake check passes; devShell provides nodejs for development

## Task Commits

Each task was committed atomically:

1. **Task 1: Create flake.nix with three derivations** - `a195dc2` (feat)
2. **Task 2: Build and verify the flake** - `ac2c823` (chore)

## Files Created/Modified
- `flake.nix` - Three-derivation Nix flake: daemon, CLI, and composed wrapper
- `flake.lock` - Auto-generated Nix lockfile pinning nixpkgs, crane, flake-utils
- `.gitignore` - Added `result` symlink from nix build

## Decisions Made
- Used importNpmLock instead of npmDepsHash -- reads integrity hashes from package-lock.json directly, no manual hash maintenance
- Platform-conditional PLAYWRIGHT_BROWSERS_PATH: only set on Linux where playwright-driver.browsers is available; macOS relies on system Chrome via executablePath
- Let buildNpmPackage run `npm run build` (tsc + copy scripts) rather than using dontNpmBuild, since daemon/dist/ is gitignored and must be built in the derivation
- Added `result` to .gitignore to prevent nix build output symlink from being tracked

## Deviations from Plan

None - plan executed exactly as written. The build succeeded on the first attempt with no fixes needed.

## Issues Encountered
- Custom nix binary cache (cache.n49.whn.xyz) was unreachable; bypassed by specifying `--option substituters "https://cache.nixos.org"` for the build command. This is an environment issue, not a flake issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Flake builds and produces working binary on macOS (aarch64-darwin)
- Ready for Phase 10 (repo publishing) -- flake.nix can be referenced as a flake input
- Linux builds untested locally but derivation structure is correct (uses standard nixpkgs patterns)

---
*Phase: 09-nix-flake*
*Completed: 2026-03-15*
