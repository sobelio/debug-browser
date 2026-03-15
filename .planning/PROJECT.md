# Debug Browser

## What This Is

A Rust CLI and Claude Code skill that gives developers (and Claude) a headless debugging browser purpose-built for React applications. Navigate sites, inspect the React component tree, examine hook state, capture console logs and errors — all through a command-based interface optimized for LLM interaction.

## Core Value

Inspect a running React app's component tree with props and state from the command line — the one capability that makes everything else valuable.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Headless browser navigation and interaction (click, type, scroll, navigate)
- [ ] React component tree inspection (hierarchy, props, state per component)
- [ ] Hook state inspection (useState values, useEffect deps, custom hooks)
- [ ] Console log/error/warning capture with stateful inbox (accumulate, query, clear)
- [ ] JavaScript error capture and surfacing
- [ ] Script injection system for loading React DevTools hooks and custom introspection scripts
- [ ] Command-based CLI interface (all operations as commands, no TUI)
- [ ] Claude Code skill integration (skill definition that Claude can use for React debugging)
- [ ] DOM inspection and element selection (CSS selectors, text content)

### Out of Scope

- Visual page rendering / screenshots — not needed, component tree and DOM are sufficient
- Performance profiling / flame graphs — deferred to future milestone
- TUI / interactive terminal panels — command-based only, optimized for LLM usage
- Network request/response inspection (HAR capture) — may add later but not v1

## Context

- Inspired by and likely forking/importing code from `vercel-labs/agent-browser`
- agent-browser provides headless browser automation via CDP (Chrome DevTools Protocol) — we extend this with deep React introspection
- React DevTools exposes a global hook (`__REACT_DEVTOOLS_GLOBAL_HOOK__`) that can be injected before React loads to capture the fiber tree, component instances, hook state, etc.
- The inbox model: console messages, errors, and React warnings accumulate like an inbox that commands can query, filter, and clear — critical for LLM workflows where you check state at discrete points rather than watching a stream
- Dual-mode: standalone CLI for developers + Claude Code skill so Claude can autonomously debug React apps

## Constraints

- **Language**: Rust — for performance, reliability, and developer preference
- **Browser Protocol**: CDP (Chrome DevTools Protocol) — industry standard, same as agent-browser uses
- **Interface**: Command-based only — no TUI, no interactive mode. Every operation is a discrete command with structured output. This is non-negotiable for LLM compatibility.
- **React Hook Injection**: Must inject before React initializes — requires script injection at page load time via CDP

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Rust for CLI | Developer preference, performance for browser automation | — Pending |
| Fork/import agent-browser code | Leverage existing CDP automation, don't reinvent the wheel | — Pending |
| Command-based only (no TUI) | LLM-first design — Claude and other LLMs need structured command I/O | — Pending |
| Stateful inbox for logs/errors | LLMs check state at discrete points, not via streams | — Pending |
| React DevTools hook injection | Standard approach for component tree access, same as React DevTools extension | — Pending |

---
*Last updated: 2026-03-15 after initialization*
