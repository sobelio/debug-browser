# debug-browser Skill — Installation

## Prerequisites

- **Rust toolchain** — `cargo` available on PATH
- **Node.js 18+** and `npm` — required by the daemon process

## Build the CLI

```bash
cd /path/to/debug-browser
cargo build --release

# Option A: add to PATH
export PATH="$PWD/target/release:$PATH"

# Option B: install globally
cargo install --path .
```

## Install Daemon Dependencies

```bash
cd daemon
npm install
```

## Install the Skill in Claude Code

Choose one method:

**Symlink (recommended for development):**

```bash
ln -s $(pwd)/skill ~/.claude/skills/debug-browser
```

**Copy (for stable installs):**

```bash
cp -r skill ~/.claude/skills/debug-browser
```

**Project-scoped (for a specific repo):**

```bash
cp -r skill /path/to/your/project/.claude/skills/debug-browser
```

## Verify

Start Claude Code and ask:

> Debug my React app at http://localhost:3000

The skill should trigger automatically based on the SKILL.md description.

## Skill Contents

```
skill/
  SKILL.md              — Skill definition and debugging methodology
  references/
    commands.md         — Full command reference (all flags, output formats)
    workflows.md        — End-to-end debugging scenario recipes
```
