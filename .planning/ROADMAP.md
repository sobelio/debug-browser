# Roadmap: Debug Browser

## Overview

Build a Rust CLI + Node.js daemon for debugging React applications, forking agent-browser's architecture (Playwright daemon + thin Rust client). Navigation, DOM interaction, console capture, and script injection come free from Playwright. Our unique value is React-specific introspection: component tree, props/state, and hook inspection.

## Architecture Decision

**Daemon + Playwright** (forked from agent-browser):
- Node.js daemon (`daemon/src/`) using Playwright for browser automation
- Rust CLI (`src/`) as thin synchronous client over Unix socket
- Daemon auto-launches on first CLI command, persists across commands
- Communication: Rust CLI → Unix socket → Node.js daemon → Playwright → Chrome

## Milestones

- ✅ **[v1.0 MVP](milestones/v1.0-ROADMAP.md)** — Phases 1-7 (shipped 2026-03-15)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-7) — SHIPPED 2026-03-15</summary>

- [x] Phase 1: Project Scaffolding (2/2 plans) — completed 2026-03-15
- [x] Phase 2: Daemon + CLI Architecture (3/3 plans) — completed 2026-03-15
- [x] Phase 3: React DevTools Hook (3/3 plans) — completed 2026-03-15
- [x] Phase 4: Hook State Inspection (2/2 plans) — completed 2026-03-15
- [x] Phase 5: Claude Code Skill (2/2 plans) — completed 2026-03-15
- [x] Phase 6: Automated Testing (3/3 plans) — completed 2026-03-15
- [x] Phase 7: Context Saving & AI Token Efficiency (3/3 plans) — completed 2026-03-15

</details>

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|---------------|--------|-----------|
| 1. Project Scaffolding | v1.0 | 2/2 | Complete | 2026-03-15 |
| 2. Daemon + CLI Architecture | v1.0 | 3/3 | Complete | 2026-03-15 |
| 3. React DevTools Hook | v1.0 | 3/3 | Complete | 2026-03-15 |
| 4. Hook State Inspection | v1.0 | 2/2 | Complete | 2026-03-15 |
| 5. Claude Code Skill | v1.0 | 2/2 | Complete | 2026-03-15 |
| 6. Automated Testing | v1.0 | 3/3 | Complete | 2026-03-15 |
| 7. Context Saving & AI Token Efficiency | v1.0 | 3/3 | Complete | 2026-03-15 |
