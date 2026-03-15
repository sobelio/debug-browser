---
phase: 02-cdp-connection
plan: 01
subsystem: daemon
tags: [node, typescript, playwright, daemon, unix-socket]
status: complete
---

# 02-01 Summary: Node.js Daemon Fork from agent-browser

## Performance

- **Duration:** ~15 minutes
- **Tasks:** 6/6 completed
- **Files created:** 6
- **Files modified:** 1

## Accomplishments

- Created `daemon/` directory with full Node.js TypeScript project
- Forked and stripped agent-browser's daemon architecture to ~27 core commands
- Daemon compiles cleanly with `npx tsc` (zero errors)
- Daemon starts, creates Unix socket at `~/.debug-browser/default.sock`
- Socket and PID files cleaned up properly on SIGTERM
- Console message and page error capture working via Playwright event listeners

## Task Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | Create daemon directory with package.json and tsconfig | `1a9ab8e` |
| 2 | Fork daemon.ts and types.ts from agent-browser | `fe24e2c` |
| 3 | Fork protocol.ts with Zod schemas for core commands | `9a17d6d` |
| 4 | Fork browser.ts with simplified BrowserManager | `b6e05d2` |
| 5 | Fork actions.ts with command dispatcher | `c8c3d41` |
| 6 | Build daemon, verify startup, update .gitignore | `57d10db` |

## Files Created

- `daemon/package.json` -- Project config with playwright-core + zod deps
- `daemon/tsconfig.json` -- TypeScript config targeting ES2022/ESNext
- `daemon/package-lock.json` -- Lock file
- `daemon/src/daemon.ts` -- Unix socket server with auto-launch
- `daemon/src/types.ts` -- 27 command interfaces + response types
- `daemon/src/protocol.ts` -- Zod validation schemas + parse/serialize
- `daemon/src/browser.ts` -- Simplified BrowserManager (launch, close, navigate, evaluate, console/error capture)
- `daemon/src/actions.ts` -- Command dispatcher with 27 action handlers

## Files Modified

- `.gitignore` -- Added daemon/dist/ and daemon/node_modules/

## Decisions Made

1. **Dropped `ws` dependency** -- No screencast streaming needed for React debugging
2. **Unix-only sockets** -- Stripped Windows TCP fallback (macOS/Linux target)
3. **Single page model** -- Stripped multi-tab/window support from BrowserManager
4. **Chromium only** -- Stripped Firefox/WebKit launcher selection
5. **No cloud providers** -- Stripped Browserbase and BrowserUse CDP connection code
6. **No RefMap/snapshot system** -- Used basic DOM walk for snapshot instead of agent-browser's enhanced snapshot with refs
7. **No persistent context** -- Stripped extension loading and profile support

## Deviations from Plan

1. **Snapshot handler fix** -- `page.accessibility.snapshot()` was removed in playwright-core ^1.57.0. Replaced with a DOM walk that produces an aria-role tree via `page.evaluate()`. This is a critical auto-fix since the build would not compile otherwise.

## Issues Encountered

- Playwright removed the `accessibility` property from `Page` in recent versions. Resolved by implementing a custom DOM walker that produces similar output.

## Next Phase Readiness

The daemon is ready for:
- **02-02:** Rust CLI can spawn this daemon and communicate over the Unix socket
- **02-03:** React-specific init scripts can be injected via `addinitscript` command
- The `evaluate` command provides the foundation for all React DevTools hook inspection
