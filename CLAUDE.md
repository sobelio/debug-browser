# Debug Browser

A Rust CLI + Claude Code skill for debugging React applications via headless browser with rich introspection capabilities.

## Project Structure

- `.planning/` — Project planning docs (PROJECT.md, config.json, roadmaps, plans)
- Source code TBD — Rust project will be initialized during first implementation phase

## Key Concepts

- **Command-based interface** — All interaction is via CLI commands, optimized for LLM consumption (no TUI)
- **React-first** — Component tree inspection and hook state are the core value
- **Dual-mode** — Works as standalone CLI and as a Claude Code skill
- **Stateful inbox** — Console logs, errors, alerts accumulate and can be queried/cleared via commands
