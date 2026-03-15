# Phase 2: CDP Connection — Discovery

## Discovery Level: 2 (Standard Research)

## Agent-Browser Architecture (corrected)

agent-browser (vercel-labs/agent-browser) does NOT use raw CDP from Rust. Its actual architecture:

- **Node.js daemon** (`src/daemon.ts`) manages a **Playwright** BrowserManager (`src/browser.ts`)
- **Rust CLI** (`cli/src/`) is a thin synchronous client — no tokio, no WebSocket, no CDP
- Communication: Rust CLI → Unix socket/TCP → Node.js daemon → Playwright → Chrome

### Reference files (at /Users/whn/tmp/agent-browser/):
- `cli/src/connection.rs` — Daemon lifecycle, socket management, send_command()
- `cli/src/commands.rs` — Command parsing, JSON command construction
- `cli/src/main.rs` — CLI entry point, flag handling, response printing
- `cli/src/output.rs` — Response formatting (text + JSON modes)
- `src/browser.ts` — BrowserManager with Playwright (launch, navigate, CDP session, console capture)
- `src/daemon.ts` — Unix socket server, command dispatch, auto-launch
- `src/protocol.ts` — Zod command validation schemas
- `src/actions.ts` — Command execution (maps commands to Playwright calls)

### Key patterns to adopt:
1. **Session management** — daemon with PID files, socket dir discovery (`connection.rs:86-108`)
2. **Command protocol** — JSON commands with `{id, action, ...params}` pattern
3. **Output formatting** — text vs JSON modes, colorized output (`output.rs`)
4. **Error handling** — ParseError enum with contextual messages (`commands.rs:7-51`)
5. **Flag parsing** — session, headed, executable-path, extensions (`flags.rs`)

## Question: Which CDP approach for Rust?

### Options Evaluated

**1. chromiumoxide (v0.9.1)**
- Fully typed CDP bindings generated from Chrome PDL spec
- Async/tokio, launch + connect-to-existing, all CDP domains
- Active maintenance (pushed Feb 2026)
- Handles WebSocket transport, message correlation, event demuxing internally
- Supports `Page.addScriptToEvaluateOnNewDocument` as a typed command
- Trade-off: Heavy compile time (~60K generated lines)

**2. headless_chrome (v1.0.21)**
- Synchronous API — fundamental mismatch with our async architecture
- **Eliminated**

**3. Raw WebSocket**
- Build CDP transport from tokio-tungstenite
- Total control, fast compile, ~300 lines of infrastructure
- Must handle message correlation, event routing, reconnection ourselves
- No typed CDP bindings — all raw JSON

## Recommendation

**chromiumoxide** — for these reasons:
1. Mature, actively maintained, async/tokio-native
2. Typed CDP bindings for ALL domains (Page, Runtime, DOM, etc.)
3. Built-in browser launch + connect-to-existing-Chrome
4. Handles all WebSocket transport complexity
5. `Page.addScriptToEvaluateOnNewDocument` is a first-class typed command
6. We avoid reinventing CDP transport (~300 lines of tricky async code)
7. The compile time trade-off is acceptable for correctness and productivity

### Why not daemon architecture like agent-browser?
- agent-browser uses Playwright (Node.js) — adds a runtime dependency we don't want
- Our tool is React-specific: we need custom CDP interactions for fiber tree inspection
- Pure Rust = single binary, no Node.js dependency, simpler deployment
- chromiumoxide gives us the same capabilities directly

## Dependencies Needed

- `chromiumoxide` — async CDP client with typed bindings
- `futures-util` — stream combinators for CDP events
