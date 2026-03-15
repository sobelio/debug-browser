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
- [ ] **Phase 2: Daemon + CLI Architecture** — Fork agent-browser daemon, convert Rust CLI to thin client, end-to-end smoke test
- [ ] **Phase 3: React DevTools Hook** — Inject React DevTools global hook, capture fiber tree, component hierarchy with props/state
- [ ] **Phase 4: Hook State Inspection** — useState/useEffect/custom hook drill-down per component
- [ ] **Phase 5: Claude Code Skill** — Skill definition, LLM command mapping, integration

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
- [ ] 02-01: Fork agent-browser daemon (daemon.ts, browser.ts, actions.ts, protocol.ts, types.ts), strip unneeded commands, set up package.json
- [ ] 02-02: Convert Rust CLI to thin synchronous client (connection.rs, commands.rs), remove tokio, wire to daemon
- [ ] 02-03: End-to-end smoke test (navigate, evaluate, console), add --connect flag for existing Chrome

### Phase 3: React DevTools Hook
**Goal**: Inject React DevTools global hook, capture fiber tree, expose component hierarchy with props and state
**Depends on**: Phase 2
**Research**: Likely (React internals, fiber tree traversal)
**Research topics**: `__REACT_DEVTOOLS_GLOBAL_HOOK__` API, fiber tree structure, React version detection, component name resolution, props/state extraction from fibers
**Plans**: 3 plans

Plans:
- [ ] 03-01: React DevTools hook injection script, React version detection
- [ ] 03-02: Fiber tree traversal, component hierarchy extraction (names, types, keys)
- [ ] 03-03: Props and state extraction per component, tree serialization for CLI output

### Phase 4: Hook State Inspection
**Goal**: Inspect useState values, useEffect deps, and custom hooks for any component
**Depends on**: Phase 3
**Research**: Likely (hook internals in fiber nodes)
**Research topics**: Hook linked list in fiber memoizedState, hook type identification, useEffect cleanup/deps, custom hook naming via useDebugValue
**Plans**: 2 plans

Plans:
- [ ] 04-01: Hook list extraction from fiber memoizedState, hook type identification (state, effect, memo, ref, etc.)
- [ ] 04-02: Hook value formatting, useEffect dep tracking, custom hook grouping via useDebugValue

### Phase 5: Claude Code Skill
**Goal**: Claude Code skill definition that lets Claude use debug-browser for React debugging
**Depends on**: Phase 4
**Research**: Likely (Claude Code skill format)
**Research topics**: Claude Code skill definition spec, command documentation for LLM consumption, skill installation
**Plans**: 2 plans

Plans:
- [ ] 05-01: Skill definition file, command documentation optimized for LLM usage
- [ ] 05-02: Integration testing, example workflows, skill installation instructions

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Project Scaffolding | 2/2 | Complete | 2026-03-15 |
| 2. Daemon + CLI Architecture | 0/3 | Not started | - |
| 3. React DevTools Hook | 0/3 | Not started | - |
| 4. Hook State Inspection | 0/2 | Not started | - |
| 5. Claude Code Skill | 0/2 | Not started | - |
