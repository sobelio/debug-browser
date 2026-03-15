# Roadmap: Debug Browser

## Overview

Build a Rust CLI debugging browser for React applications, starting from CDP fundamentals and layering up through DOM interaction, console capture, script injection, and deep React introspection — culminating in a unified command interface and Claude Code skill. The approach leverages agent-browser's patterns for browser automation while adding React-specific capabilities that don't exist in any CLI tool today.

## Domain Expertise

None

## Phases

- [x] **Phase 1: Project Scaffolding** — Rust project setup, dependencies, CLI framework
- [ ] **Phase 2: CDP Connection** — Chrome DevTools Protocol client, browser launch/attach
- [ ] **Phase 3: Browser Navigation** — Page navigation, waiting strategies, page lifecycle
- [ ] **Phase 4: DOM Interaction** — Click, type, scroll, element selection, text extraction
- [ ] **Phase 5: Console & Error Inbox** — Console/error/warning capture with stateful inbox
- [ ] **Phase 6: Script Injection System** — CDP script injection at page load, injection management
- [ ] **Phase 7: React DevTools Hook** — Fiber tree capture, component hierarchy with props/state
- [ ] **Phase 8: Hook State Inspection** — useState/useEffect/custom hook drill-down
- [ ] **Phase 9: CLI Command Interface** — Unified command system, structured JSON output
- [ ] **Phase 10: Claude Code Skill** — Skill definition, LLM command mapping, integration

## Phase Details

### Phase 1: Project Scaffolding
**Goal**: Working Rust project with CLI framework, dependency management, and basic binary that launches
**Depends on**: Nothing (first phase)
**Research**: Unlikely (standard Rust project setup)
**Plans**: 2 plans

Plans:
- [x] 01-01: Cargo project init, workspace structure, core dependencies (clap, tokio, serde)
- [x] 01-02: CLI entry point with subcommand skeleton, basic config/error handling

### Phase 2: CDP Connection
**Goal**: Connect to Chrome/Chromium via CDP, launch headless browser, establish debugging session
**Depends on**: Phase 1
**Research**: Likely (CDP Rust crate evaluation, agent-browser architecture study)
**Research topics**: Rust CDP crates (chromiumoxide vs rust-headless-chrome vs raw CDP), agent-browser's CDP patterns, browser binary discovery
**Plans**: 3 plans

Plans:
- [ ] 02-01: Evaluate CDP crate options, study agent-browser's approach
- [ ] 02-02: Browser launch/discovery (find Chrome binary, launch headless with CDP enabled)
- [ ] 02-03: CDP session management (connect, create targets, handle disconnects)

### Phase 3: Browser Navigation
**Goal**: Navigate to URLs, wait for page load, handle redirects and SPAs
**Depends on**: Phase 2
**Research**: Unlikely (follows directly from CDP connection)
**Plans**: 2 plans

Plans:
- [ ] 03-01: URL navigation, page load waiting (load, DOMContentLoaded, networkIdle)
- [ ] 03-02: SPA navigation handling, history API detection, route change waiting

### Phase 4: DOM Interaction
**Goal**: Select elements, click, type, scroll — full page interaction from CLI commands
**Depends on**: Phase 3
**Research**: Unlikely (standard CDP DOM operations)
**Plans**: 3 plans

Plans:
- [ ] 04-01: Element selection (CSS selectors, XPath), element info extraction
- [ ] 04-02: Click, type, keyboard/mouse input simulation
- [ ] 04-03: Scroll, viewport management, element visibility checks

### Phase 5: Console & Error Inbox
**Goal**: Capture all console output and JS errors into a queryable, clearable inbox
**Depends on**: Phase 2
**Research**: Unlikely (CDP Runtime.consoleAPICalled and Runtime.exceptionThrown are well-documented)
**Plans**: 2 plans

Plans:
- [ ] 05-01: Console message capture (log, warn, error, info), JS exception capture
- [ ] 05-02: Inbox data structure, query/filter commands (by level, pattern), clear/count operations

### Phase 6: Script Injection System
**Goal**: Inject arbitrary scripts before page loads via CDP, manage injection lifecycle
**Depends on**: Phase 2
**Research**: Likely (injection timing, agent-browser patterns)
**Research topics**: CDP Page.addScriptToEvaluateOnNewDocument, injection ordering, persistence across navigations, agent-browser's injection approach
**Plans**: 2 plans

Plans:
- [ ] 06-01: CDP script injection (addScriptToEvaluateOnNewDocument), injection before React loads
- [ ] 06-02: Script management (register, list, remove injections), bundled vs custom scripts

### Phase 7: React DevTools Hook
**Goal**: Inject React DevTools global hook, capture fiber tree, expose component hierarchy with props and state
**Depends on**: Phase 6
**Research**: Likely (React internals, fiber tree traversal)
**Research topics**: `__REACT_DEVTOOLS_GLOBAL_HOOK__` API, fiber tree structure, React version detection, component name resolution, props/state extraction from fibers
**Plans**: 3 plans

Plans:
- [ ] 07-01: React DevTools hook injection script, React version detection
- [ ] 07-02: Fiber tree traversal, component hierarchy extraction (names, types, keys)
- [ ] 07-03: Props and state extraction per component, tree serialization for CLI output

### Phase 8: Hook State Inspection
**Goal**: Inspect useState values, useEffect deps, and custom hooks for any component
**Depends on**: Phase 7
**Research**: Likely (hook internals in fiber nodes)
**Research topics**: Hook linked list in fiber memoizedState, hook type identification, useEffect cleanup/deps, custom hook naming via useDebugValue
**Plans**: 2 plans

Plans:
- [ ] 08-01: Hook list extraction from fiber memoizedState, hook type identification (state, effect, memo, ref, etc.)
- [ ] 08-02: Hook value formatting, useEffect dep tracking, custom hook grouping via useDebugValue

### Phase 9: CLI Command Interface
**Goal**: Unified command system where every capability is a discrete command with structured JSON output
**Depends on**: Phases 1-8
**Research**: Unlikely (internal CLI design, patterns established)
**Plans**: 3 plans

Plans:
- [ ] 09-01: Command registry, dispatch system, structured output format (JSON + human-readable)
- [ ] 09-02: Navigation commands (goto, back, forward, reload, wait)
- [ ] 09-03: Inspection commands (components, hooks, console, dom), help system

### Phase 10: Claude Code Skill
**Goal**: Claude Code skill definition that lets Claude use debug-browser for React debugging
**Depends on**: Phase 9
**Research**: Likely (Claude Code skill format)
**Research topics**: Claude Code skill definition spec, command documentation for LLM consumption, skill installation
**Plans**: 2 plans

Plans:
- [ ] 10-01: Skill definition file, command documentation optimized for LLM usage
- [ ] 10-02: Integration testing, example workflows, skill installation instructions

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

Note: Phases 3-4 (navigation/DOM) and Phase 5 (console inbox) can potentially run in parallel after Phase 2.

| Phase | Plans Complete | Status | Completed |
|-------|---------------|--------|-----------|
| 1. Project Scaffolding | 2/2 | Complete | 2026-03-15 |
| 2. CDP Connection | 0/3 | Not started | - |
| 3. Browser Navigation | 0/2 | Not started | - |
| 4. DOM Interaction | 0/3 | Not started | - |
| 5. Console & Error Inbox | 0/2 | Not started | - |
| 6. Script Injection | 0/2 | Not started | - |
| 7. React DevTools Hook | 0/3 | Not started | - |
| 8. Hook State Inspection | 0/2 | Not started | - |
| 9. CLI Command Interface | 0/3 | Not started | - |
| 10. Claude Code Skill | 0/2 | Not started | - |
