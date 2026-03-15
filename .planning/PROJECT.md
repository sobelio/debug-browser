# Debug Browser

## What This Is

A Rust CLI and Claude Code skill that gives developers (and Claude) a headless debugging browser purpose-built for React applications. Navigate sites, inspect the React component tree with props and state, examine hook state for all standard React hook types, capture console logs and errors, manage cookies and storage, persist auth state across sessions — all through a command-based interface optimized for LLM interaction.

## Core Value

Inspect a running React app's component tree with props and state from the command line — the one capability that makes everything else valuable.

## Requirements

### Validated

- ✓ Headless browser navigation and interaction (click, type, navigate) — v1.0
- ✓ React component tree inspection (hierarchy, props, state per component) — v1.0
- ✓ Hook state inspection (useState values, useEffect deps, custom hooks) — v1.0
- ✓ Console log/error/warning capture with stateful inbox (accumulate, query, clear) — v1.0
- ✓ JavaScript error capture and surfacing — v1.0
- ✓ Script injection system for loading React DevTools hooks and custom introspection scripts — v1.0
- ✓ Command-based CLI interface (all operations as commands, no TUI) — v1.0
- ✓ Claude Code skill integration (skill definition that Claude can use for React debugging) — v1.0
- ✓ DOM inspection and element selection (CSS selectors, text content) — v1.0
- ✓ Cookie and storage management (get/set/clear for cookies, localStorage, sessionStorage) — v1.0
- ✓ State persistence (save/load auth state, --profile for persistent browser context) — v1.0
- ✓ Compact output modes for AI token efficiency (--compact on components/hooks) — v1.0

### Active

(None — v1.0 shipped. Define in next milestone.)

### Out of Scope

- Visual page rendering / screenshots — not needed, component tree and DOM are sufficient
- Performance profiling / flame graphs — deferred to future milestone
- TUI / interactive terminal panels — command-based only, optimized for LLM usage
- Network request/response inspection (HAR capture) — may add later
- Windows/TCP support — Unix-only for now

## Context

Shipped v1.0 with ~5,756 LOC across Rust CLI (1,612), Node.js daemon (2,668), tests (442), and skill docs (1,034).
Tech stack: Rust (clap, serde_json, thiserror 2), Node.js (Playwright, Zod), Vite test fixture.
Architecture: Forked from agent-browser — Node.js daemon with Playwright for browser automation, Rust CLI as thin synchronous client over Unix socket.
56 E2E test assertions covering all commands.

## Constraints

- **Language**: Rust CLI + Node.js daemon — Rust for performance/reliability, Node.js for Playwright ecosystem
- **Browser Automation**: Playwright (via forked agent-browser daemon) — not raw CDP
- **Interface**: Command-based only — no TUI, no interactive mode. Every operation is a discrete command with structured output. Non-negotiable for LLM compatibility.
- **React Hook Injection**: Must inject before React initializes — script injection at page load time
- **Platform**: Unix-only (macOS/Linux) — no Windows support

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rust for CLI | Developer preference, performance | ✓ Good — 1,612 LOC, fast sync client |
| Fork agent-browser daemon | Leverage Playwright automation | ✓ Good — collapsed 4 phases into 1 |
| Command-based only (no TUI) | LLM-first design | ✓ Good — Claude skill works well |
| Stateful inbox for logs/errors | LLMs check at discrete points | ✓ Good — accumulate/query/clear model |
| React DevTools hook injection | Standard fiber tree access | ✓ Good — full component/hook inspection |
| Daemon + Playwright over pure Rust CDP | Playwright handles navigation/DOM/console | ✓ Good — massive scope reduction |
| Unix socket only (no TCP) | Simpler, local-only use case | ✓ Good — no Windows needed yet |
| _debugHookTypes for hook identification | Authoritative in React 18.3+ | ✓ Good — heuristic fallback for older |
| Dev server for E2E tests | Minification destroys component names | ✓ Good — reliable test fixture |

---
*Last updated: 2026-03-15 after v1.0 milestone*
