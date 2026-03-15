# Roadmap: Debug Browser

## Overview

Build a Rust CLI + Node.js daemon for debugging React applications, forking agent-browser's architecture (Playwright daemon + thin Rust client). Navigation, DOM interaction, console capture, and script injection come free from Playwright. Our unique value is React-specific introspection: component tree, props/state, and hook inspection.

## Architecture Decision

**Daemon + Playwright** (forked from agent-browser):
- Node.js daemon (`daemon/src/`) using Playwright for browser automation
- Rust CLI (`src/`) as thin synchronous client over Unix socket
- Daemon auto-launches on first CLI command, persists across commands
- Communication: Rust CLI → Unix socket → Node.js daemon → Playwright → Chrome

Phases 3-6 from original roadmap (navigation, DOM, console, script injection) are **collapsed** — Playwright already handles all of these via the daemon.

## Domain Expertise

None

## Phases

- [x] **Phase 1: Project Scaffolding** — Rust project setup, dependencies, CLI framework
- [x] **Phase 2: Daemon + CLI Architecture** — Fork agent-browser daemon, convert Rust CLI to thin client, end-to-end smoke test
- [x] **Phase 3: React DevTools Hook** — Inject React DevTools global hook, capture fiber tree, component hierarchy with props/state
- [x] **Phase 4: Hook State Inspection** — useState/useEffect/custom hook drill-down per component
- [x] **Phase 5: Claude Code Skill** — Skill definition, LLM command mapping, integration
- [x] **Phase 6: Automated Testing** — End-to-end tests exercising CLI against a real React app
- [ ] **Phase 7: Context Saving & AI Token Efficiency** — State persistence, cookie/storage commands, and compact React output modes

## Phase Details

### Phase 1: Project Scaffolding
**Goal**: Working Rust project with CLI framework, dependency management, and basic binary that launches
**Depends on**: Nothing (first phase)
**Research**: Unlikely (standard Rust project setup)
**Plans**: 2 plans

Plans:
- [x] 01-01: Cargo project init, workspace structure, core dependencies (clap, tokio, serde)
- [x] 01-02: CLI entry point with subcommand skeleton, basic config/error handling

### Phase 2: Daemon + CLI Architecture
**Goal**: Fork agent-browser's Node.js daemon + Playwright architecture, wire Rust CLI as thin client, prove full pipeline works
**Depends on**: Phase 1
**Research**: Complete (agent-browser architecture study done in DISCOVERY.md)
**Plans**: 3 plans

Plans:
- [x] 02-01: Fork agent-browser daemon (daemon.ts, browser.ts, actions.ts, protocol.ts, types.ts), strip unneeded commands, set up package.json
- [x] 02-02: Convert Rust CLI to thin synchronous client (connection.rs, commands.rs), remove tokio, wire to daemon
- [x] 02-03: End-to-end smoke test (navigate, evaluate, console), add --connect flag for existing Chrome

### Phase 3: React DevTools Hook
**Goal**: Inject React DevTools global hook, capture fiber tree, expose component hierarchy with props and state
**Depends on**: Phase 2
**Research**: Likely (React internals, fiber tree traversal)
**Research topics**: `__REACT_DEVTOOLS_GLOBAL_HOOK__` API, fiber tree structure, React version detection, component name resolution, props/state extraction from fibers
**Plans**: 3 plans

Plans:
- [x] 03-01: React DevTools hook injection script, React version detection
- [x] 03-02: Fiber tree traversal, component hierarchy extraction (names, types, keys)
- [x] 03-03: Props and state extraction per component, tree serialization for CLI output

### Phase 4: Hook State Inspection
**Goal**: Inspect useState values, useEffect deps, and custom hooks for any component
**Depends on**: Phase 3
**Research**: Likely (hook internals in fiber nodes)
**Research topics**: Hook linked list in fiber memoizedState, hook type identification, useEffect cleanup/deps, custom hook naming via useDebugValue
**Plans**: 2 plans

Plans:
- [x] 04-01: Hook list extraction from fiber memoizedState, hook type identification (state, effect, memo, ref, etc.)
- [x] 04-02: Hook value formatting, useEffect dep tracking, custom hook grouping via useDebugValue

### Phase 5: Claude Code Skill
**Goal**: Claude Code skill definition that lets Claude use debug-browser for React debugging
**Depends on**: Phase 4
**Research**: Likely (Claude Code skill format)
**Research topics**: Claude Code skill definition spec, command documentation for LLM consumption, skill installation
**Plans**: 2 plans

Plans:
- [x] 05-01: Skill definition file, command documentation optimized for LLM usage
- [x] 05-02: Integration testing, example workflows, skill installation instructions

### Phase 6: Automated Testing
**Goal**: End-to-end tests that exercise the full CLI + daemon pipeline against a real React app, verifying all commands produce correct output
**Depends on**: Phase 5
**Research**: Unlikely (standard test harness setup)
**Plans**: 3 plans

Plans:
- [x] 06-01: Test fixture React app with known component tree, hooks, console output
- [x] 06-02: Test harness script + core command tests (navigate, detect, components, hooks, close)
- [x] 06-03: Interaction command tests (click, type, eval) + console capture + JSON output

### Phase 7: Context Saving & AI Token Efficiency
**Goal**: State persistence (save/load auth state, persistent profiles), cookie/storage commands for auth debugging, and compact output modes for React component tree and hooks to reduce AI token usage
**Depends on**: Phase 6
**Research**: Complete (agent-browser state/cookie/storage implementation studied)
**Plans**: 3 plans

Plans:
- [x] 07-01: Cookie & storage commands (cookies get/set/clear, storage local/session get/set/clear)
- [x] 07-02: State persistence (state save/load, --state flag, --profile flag)
- [ ] 07-03: Compact React output modes + E2E tests for all Phase 7 features

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Project Scaffolding | 2/2 | Complete | 2026-03-15 |
| 2. Daemon + CLI Architecture | 3/3 | Complete | 2026-03-15 |
| 3. React DevTools Hook | 3/3 | Complete | 2026-03-15 |
| 4. Hook State Inspection | 2/2 | Complete | 2026-03-15 |
| 5. Claude Code Skill | 2/2 | Complete | 2026-03-15 |
| 6. Automated Testing | 3/3 | Complete | 2026-03-15 |
| 7. Context Saving & AI Token Efficiency | 2/3 | In progress | - |
