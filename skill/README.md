# debug-browser Skill — Installation

## Prerequisites

- **Rust toolchain** — `cargo` available on PATH
- **Node.js 18+** and `npm` — required by the daemon process

## Quick Install

The install script builds the CLI and daemon, then installs to a standard FHS layout:

```bash
git clone <repo-url>
cd debug-browser
./scripts/install.sh
```

This installs to `~/.local` by default (`bin/` for the binary, `share/debug-browser/daemon/` for the daemon). To install to a custom location:

```bash
./scripts/install.sh --prefix /opt/debug-browser
```

Ensure the `bin/` directory is on your PATH:

```bash
export PATH="~/.local/bin:$PATH"
```

## Nix Install

If you have Nix with flakes enabled, you can install directly:

```bash
# From the flake (once repo is public)
nix profile install github:sobelio/debug-browser

# Or build from a local clone
git clone <repo-url>
cd debug-browser
nix build
./result/bin/debug-browser --help
```

**Platform notes:**
- **Linux** — Playwright's Chromium browser is bundled automatically via the Nix wrapper.
- **macOS** — Run `npx playwright install chromium` or ensure Google Chrome is installed (Nix cannot bundle Chromium on Darwin).

### Development Shell

For contributors, `nix develop` provides Rust and Node.js toolchains:

```bash
nix develop
cargo build
cd daemon && npm install && npm run build
```

### Flake Input

To use debug-browser as a dependency in another flake:

```nix
{
  inputs.debug-browser.url = "github:sobelio/debug-browser";
}
```

Then reference `inputs.debug-browser.packages.${system}.default` in your outputs.

## Development Install

For contributors working on the source:

```bash
# Build the CLI
cargo build --release

# Build the daemon
cd daemon && npm install && npm run build
```

In development, the binary auto-discovers the daemon via the `cargo target/` layout — no extra configuration needed.

## Claude Code Skill Install

The skill teaches Claude Code about debug-browser commands. The CLI binary must already be on PATH.

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

## Environment Variables

- `DEBUG_BROWSER_HOME` — Root of the install (contains `daemon/dist/daemon.js`). Auto-discovered from the binary location when installed via the install script.
- `DEBUG_BROWSER_DAEMON_PATH` — Explicit path to `daemon.js`. Overrides all other discovery methods.

## Uninstall

```bash
./scripts/uninstall.sh
```

Or specify the prefix used during install:

```bash
./scripts/uninstall.sh --prefix /opt/debug-browser
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
