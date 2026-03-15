---
phase: 06-automated-testing
plan: 02
subsystem: testing
tags: [bash, e2e, shell-test, vite, playwright]

# Dependency graph
requires:
  - phase: 06-automated-testing
    provides: Test fixture React app with known component tree
provides:
  - Shell test harness with setup/teardown
  - E2E tests for core commands (navigate, detect, components, hooks, close)
affects: [06-03]

# Tech tracking
tech-stack:
  added: []
  patterns: [bash-test-harness, assert-contains-pattern, trap-cleanup]

key-files:
  created: [tests/run-tests.sh]
  modified: []

key-decisions:
  - "Dev server instead of production build for tests — minification destroys component names"
  - "No jq dependency — grep/sed for JSON field extraction"
  - "|| true guards on CLI calls to prevent set -e from aborting before assertions"

patterns-established:
  - "test_X() function grouping for each command domain"
  - "assert_contains/assert_json_field as minimal bash assertion framework"

issues-created: []

# Metrics
duration: 6min
completed: 2026-03-15
---

# Phase 6 Plan 2: Test Harness & Core Command Tests Summary

**Bash E2E test harness with 21 passing tests covering navigate, React detect, components tree/filter, hooks inspection, and daemon close**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-15T09:57:45Z
- **Completed:** 2026-03-15T10:04:12Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Shell test harness with automated setup (build CLI, build fixture, start dev server) and trap-based teardown
- 21 E2E assertions covering full CLI → daemon → Playwright → browser pipeline
- Core command coverage: navigate, react detect, components (full tree, filtered, structural), hooks (Counter, TodoList, JSON), close

## Task Commits

Each task was committed atomically:

1. **Task 1: Create test harness script** - `3533690` (feat)
2. **Task 2: Write core command tests** - `7e62008` (feat)

## Files Created/Modified
- `tests/run-tests.sh` — Executable bash test harness with setup/teardown and 21 E2E test assertions

## Decisions Made
- Used Vite dev server (`npm run serve-test`) instead of production build+preview — minification destroys React component names, making assertions impossible
- Added daemon rebuild step to setup — stale `dist/scripts/` files from previous builds caused issues
- Adjusted assertions to match actual CLI output format (JSON fields in text mode, not human-readable strings)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Dev server instead of production build**
- **Found during:** Task 2 (core command tests)
- **Issue:** `npm run build + preview` minifies component names (App→Wf, Counter→Af), making all component/hook assertions fail
- **Fix:** Switched to `npm run serve-test` (Vite dev server) which preserves original component names
- **Files modified:** tests/run-tests.sh
- **Verification:** All 21 tests pass with dev server

**2. [Rule 1 - Bug] Daemon stale build files**
- **Found during:** Task 1 (setup)
- **Issue:** Daemon `dist/scripts/` had stale nested files from previous build
- **Fix:** Added daemon clean rebuild step to harness setup
- **Files modified:** tests/run-tests.sh
- **Verification:** Clean daemon build in each test run

**3. [Rule 2 - Missing Critical] Assertion guards for set -e**
- **Found during:** Task 2 (test execution)
- **Issue:** `set -euo pipefail` aborts script on CLI non-zero exits before assertions can report
- **Fix:** Added `|| true` guards on all CLI calls within test functions
- **Files modified:** tests/run-tests.sh
- **Verification:** Failed CLI commands report assertion failures instead of aborting

**4. [Rule 1 - Bug] Assertions matched plan text, not actual CLI output**
- **Found during:** Task 2 (test writing)
- **Issue:** Plan assumed human-readable output ("Navigated", "React", "OK") but CLI outputs JSON fields in text mode
- **Fix:** Updated assertions to match actual output format
- **Files modified:** tests/run-tests.sh
- **Verification:** All 21 assertions pass against actual CLI output

---

**Total deviations:** 4 auto-fixed (3 bugs, 1 missing critical), 0 deferred
**Impact on plan:** All fixes necessary for tests to work against actual CLI behavior. No scope creep.

## Issues Encountered
None

## Next Phase Readiness
- Test harness ready for extension with interaction/console/JSON tests
- Ready for 06-03-PLAN.md (interaction and output format tests)

---
*Phase: 06-automated-testing*
*Completed: 2026-03-15*
