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
- 🚧 **v1.1 Shipping** — Phases 8-10 (in progress)

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

### 🚧 v1.1 Shipping (In Progress)

**Milestone Goal:** Make debug-browser installable and distributable — proper skill packaging, Nix flake for reproducible builds, and public repo at sobelio/debug-browser.

#### Phase 8: Skill Packaging
**Goal**: Clean up skill to standard Claude Code skill format, ensure it works when installed standalone with proper daemon/binary discovery
**Depends on**: v1.0 complete
**Research**: Unlikely (existing skill patterns)
**Plans**: TBD

Plans:
- [x] 08-01: Daemon discovery & install script (completed 2026-03-15)

#### Phase 9: Nix Flake
**Goal**: Create flake.nix that builds Rust CLI + daemon with Playwright, installable via `nix profile install` or as a flake input
**Depends on**: Phase 8
**Research**: Likely (Nix + Playwright + Node.js daemon packaging)
**Research topics**: Nix Rust builds (crane/naersk), bundling Node.js daemon + node_modules in Nix, Playwright browser binary paths in Nix, flake structure for mixed Rust+Node projects
**Plans**: TBD

Plans:
- [ ] 09-01: TBD (run /gsd:plan-phase 9 to break down)

#### Phase 10: Repo & Release
**Goal**: Create sobelio/debug-browser public repo, clean README with install/usage instructions, push code, tag v1.1 release
**Depends on**: Phase 9
**Research**: Unlikely (standard git/gh operations)
**Plans**: TBD

Plans:
- [ ] 10-01: TBD (run /gsd:plan-phase 10 to break down)

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
| 8. Skill Packaging | v1.1 | 1/? | In progress | - |
| 9. Nix Flake | v1.1 | 0/? | Not started | - |
| 10. Repo & Release | v1.1 | 0/? | Not started | - |
