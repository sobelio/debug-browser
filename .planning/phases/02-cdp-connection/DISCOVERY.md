# Phase 2: CDP Connection — Discovery

## Discovery Level: 2 (Standard Research)

## Architectural Decision: Fork agent-browser daemon

**Decision:** Use agent-browser's daemon + Playwright architecture, NOT pure Rust CDP.

### agent-browser architecture (what we're adopting)
- **Node.js daemon** (`src/daemon.ts`) using **Playwright** for browser automation
- **Rust CLI** (`cli/src/`) as thin synchronous client over Unix socket/TCP
- Daemon auto-launches on first CLI command, persists across commands
- Communication: Rust CLI → Unix socket → Node.js daemon → Playwright → Chrome

### What we fork from agent-browser (/Users/whn/tmp/agent-browser/)

**Node.js daemon (src/):**
- `daemon.ts` — Unix socket server, command dispatch, auto-launch, shutdown
- `browser.ts` — BrowserManager: launch, navigate, evaluate, console/error capture, CDP session
- `actions.ts` — Command execution: maps CLI commands to Playwright calls
- `protocol.ts` — Zod command validation schemas
- `types.ts` — TypeScript interfaces for all commands/responses

**Rust CLI (cli/src/):**
- `connection.rs` — Daemon lifecycle, socket management, send_command()
- `commands.rs` — Command parsing, JSON construction
- `main.rs` — CLI entry point, flag handling
- `output.rs` — Response formatting (text vs JSON)
- `flags.rs` — Flag parsing

### What we strip (not needed for React debugging)
- Video/recording commands (video_start/stop, recording_*)
- HAR capture (har_start/stop)
- Tracing (trace_start/stop)
- Screencast/streaming (screencast_*, input_mouse/keyboard/touch)
- Route interception (route, unroute)
- Downloads (download, waitfordownload)
- PDF generation
- Complex locators (getbyrole, getbytext, etc.) — we use CSS selectors
- Storage state persistence (state_save/load)

### What we add (React-specific)
- `components` command — inject React DevTools hook, return fiber tree
- `hooks` command — inspect useState/useEffect for a component
- `react-init` — inject hook script before page load via addInitScript

### Dependencies
- `playwright-core` ^1.57.0 (browser automation)
- `zod` ^3.22.4 (command validation)
- `ws` ^8.19.0 (WebSocket for screencast — may not need)

### Impact on roadmap
Many original phases collapse because Playwright handles them:
- Phase 3 (Navigation) — already in daemon (navigate, back, forward, reload, waitforurl)
- Phase 4 (DOM Interaction) — already in daemon (click, type, scroll, gettext, etc.)
- Phase 5 (Console/Error Inbox) — already in daemon (console, errors commands)
- Phase 6 (Script Injection) — already in daemon (addinitscript, evaluate)
- **Only React-specific phases (7-8) and CLI/skill (9-10) remain as new work**
