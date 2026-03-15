# debug-browser

A Rust CLI + Claude Code skill for debugging React applications via headless browser with rich introspection capabilities.

## Features

- React component tree inspection (props, state, hooks)
- Console log / error / warning capture with inbox model
- DOM interaction (click, type, screenshot)
- Navigation and page management
- Claude Code skill for AI-assisted React debugging
- Nix flake for reproducible builds

## Quick Start

```bash
git clone https://github.com/sobelio/debug-browser
cd debug-browser
./scripts/install.sh
debug-browser navigate http://localhost:3000
debug-browser react tree
```

## Installation

### Install Script (recommended)

```bash
./scripts/install.sh
```

This installs to `~/.local` by default (`bin/` for the binary, `share/debug-browser/daemon/` for the daemon). To install to a custom location:

```bash
./scripts/install.sh --prefix /opt/debug-browser
```

Ensure the `bin/` directory is on your PATH:

```bash
export PATH="$HOME/.local/bin:$PATH"
```

### Nix

```bash
nix profile install github:sobelio/debug-browser
```

**Platform notes:**
- **Linux** — Playwright's Chromium browser is bundled automatically via the Nix wrapper.
- **macOS** — Run `npx playwright install chromium` or ensure Google Chrome is installed (Nix cannot bundle Chromium on Darwin).

### From Source

```bash
# Build the CLI
cargo build --release

# Build the daemon
cd daemon && npm install && npm run build
```

## Usage

### Navigation

```
debug-browser navigate <url>
```

Open a page in the headless browser.

### React Inspection

```
debug-browser react tree
```

Show the full component tree with component names and IDs.

```
debug-browser react inspect <id>
```

Inspect a specific component's props, state, and hooks.

### Console Capture

```
debug-browser console
```

Show all captured console messages (logs, errors, warnings). Messages accumulate across navigations until cleared.

```
debug-browser console clear
```

Clear the console inbox.

### DOM Interaction

```
debug-browser click <selector>
debug-browser type <selector> <text>
```

Interact with page elements using CSS selectors.

### Screenshots

```
debug-browser screenshot
debug-browser screenshot --output path/to/file.png
```

Capture the current page state as a PNG.

For the full command reference, see [skill/README.md](skill/README.md).

## Claude Code Skill

The `skill/` directory contains a Claude Code skill that teaches Claude about debug-browser commands, workflows, and React debugging methodology. When installed, Claude Code will automatically use debug-browser when you ask it to debug a React application.

Install the skill with a symlink:

```bash
ln -s $(pwd)/skill ~/.claude/skills/debug-browser
```

See [skill/README.md](skill/README.md) for full installation options and details.

## Architecture

The debug-browser CLI is a thin Rust client that communicates over a Unix socket with a Node.js daemon running Playwright. The daemon manages the headless browser lifecycle and exposes a JSON command protocol. The CLI handles argument parsing, connects to (or starts) the daemon, sends commands, and formats the output for human or LLM consumption.

## Development

### With Nix (recommended)

```bash
nix develop
cargo build
cd daemon && npm install && npm run build
```

### Manual setup

Requires Rust toolchain and Node.js 18+.

```bash
cargo build --release
cd daemon && npm install && npm run build
```

### Running tests

```bash
cargo test
```

## License

MIT — see [LICENSE](LICENSE) for details.
