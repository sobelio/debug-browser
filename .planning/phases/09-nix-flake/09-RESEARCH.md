# Phase 9: Nix Flake - Research

**Researched:** 2026-03-15
**Domain:** Nix flakes for mixed Rust + Node.js project with Playwright browser dependency
**Confidence:** HIGH

<research_summary>
## Summary

Researched the Nix ecosystem for packaging a mixed Rust CLI + Node.js daemon that depends on Playwright for browser automation. The standard approach uses **crane** for Rust builds, **`buildNpmPackage`/`importNpmLock`** for Node.js daemon packaging, and **`makeWrapper`** to compose everything at runtime.

The critical finding is that **Chromium is NOT available in nixpkgs on macOS (Darwin)** — `playwright-driver.browsers` only works on Linux. This means the flake must use platform-conditional browser handling: `playwright-driver.browsers` on Linux, system Chrome on macOS.

**Primary recommendation:** Build Rust with crane, bundle daemon with `buildNpmPackage` + `dontNpmBuild`, wrap binary with `makeWrapper` to inject `node`, daemon path, and (on Linux) Playwright browser path. On macOS, rely on system Chrome via `executablePath`.
</research_summary>

<standard_stack>
## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| crane | 0.23.x | Rust builds in Nix | Most actively maintained, incremental dep caching, composable derivations |
| buildNpmPackage | (nixpkgs) | Node.js packaging | Built into nixpkgs, actively maintained, standard approach |
| importNpmLock | (nixpkgs) | npm lockfile → Nix deps | No manual hash computation needed, reads package-lock.json directly |
| makeWrapper | (nixpkgs) | Binary wrapping | Standard Nix pattern for injecting runtime deps/env vars |
| playwright-driver.browsers | (nixpkgs) | Chromium for Playwright | Linux-only — provides Chromium in Playwright's expected directory structure |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| flake-utils | latest | Multi-system helpers | `eachDefaultSystem` for cross-platform flakes |
| libiconv | (nixpkgs) | macOS Rust builds | Required `buildInput` on Darwin for Rust linking |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| crane | naersk | Simpler but less maintained, no incremental dep caching |
| crane | rustPlatform.buildRustPackage | Built-in but less flexible, no dep/source split |
| buildNpmPackage | dream2nix | Experimental, unstable APIs |
| buildNpmPackage | node2nix | Legacy, maintenance-heavy |
| buildNpmPackage | stdenv.mkDerivation + npm ci | Breaks sandbox, less reproducible |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Flake Structure

```
flake.nix              # Top-level: inputs + outputs
flake.lock             # Auto-generated lockfile
daemon/
  package.json
  package-lock.json    # REQUIRED for importNpmLock
  dist/                # Pre-built TypeScript output
  src/                 # TypeScript source (not needed at runtime)
src/                   # Rust source
Cargo.toml
Cargo.lock             # REQUIRED for crane/Nix
```

### Pattern 1: Separate Derivations Composed via makeWrapper

**What:** Build daemon and CLI as independent Nix derivations, then compose them in a wrapper.
**When to use:** Always — this is the standard Nix pattern for multi-language projects.

```nix
let
  # Derivation 1: Node.js daemon + node_modules
  daemon = pkgs.buildNpmPackage {
    pname = "debug-browser-daemon";
    src = ./daemon;
    npmDeps = pkgs.importNpmLock { npmRoot = ./daemon; };
    npmConfigHook = pkgs.importNpmLock.npmConfigHook;
    dontNpmBuild = true;  # Ship pre-built dist/
    installPhase = ''
      mkdir -p $out/lib/daemon
      cp -r dist node_modules package.json $out/lib/daemon/
    '';
  };

  # Derivation 2: Rust CLI
  cli = craneLib.buildPackage {
    src = craneLib.cleanCargoSource ./.;
    cargoArtifacts = craneLib.buildDepsOnly { ... };
  };

  # Derivation 3: Composed wrapper
  wrapped = pkgs.symlinkJoin {
    name = "debug-browser";
    paths = [ cli ];
    nativeBuildInputs = [ pkgs.makeWrapper ];
    postBuild = ''
      wrapProgram $out/bin/debug-browser \
        --prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.nodejs ]} \
        --set DEBUG_BROWSER_DAEMON_PATH "${daemon}/lib/daemon/dist/daemon.js"
    '';
  };
in wrapped
```

### Pattern 2: Platform-Conditional Browser Setup

**What:** Use Nix-managed Chromium on Linux, system Chrome on macOS.
**When to use:** Always for Playwright projects targeting both platforms.

```nix
# Linux: wrap with playwright-driver.browsers
wrapProgram $out/bin/debug-browser \
  --set PLAYWRIGHT_BROWSERS_PATH "${pkgs.playwright-driver.browsers}" \
  --set PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS "true"

# macOS: no browser wrapping — user provides Chrome
# The daemon already supports executablePath in launch options
```

### Pattern 3: Crane Incremental Caching

**What:** Split Rust build into deps-only and full build for cache efficiency.
**When to use:** Always with crane.

```nix
commonArgs = {
  src = craneLib.cleanCargoSource ./.;
  strictDeps = true;
  buildInputs = pkgs.lib.optionals pkgs.stdenv.isDarwin [ pkgs.libiconv ];
};

# Phase 1: Build only Cargo.lock dependencies (cached)
cargoArtifacts = craneLib.buildDepsOnly commonArgs;

# Phase 2: Build source using cached deps
cli = craneLib.buildPackage (commonArgs // { inherit cargoArtifacts; });
```

### Anti-Patterns to Avoid
- **Don't use `CARGO_MANIFEST_DIR` in Nix builds** — the source tree doesn't persist after build. Use runtime discovery instead (already fixed in Phase 8).
- **Don't disable the Nix sandbox** (`__noChroot`) — use `buildNpmPackage` instead of raw `npm ci`.
- **Don't hardcode browser paths** — use env vars (`PLAYWRIGHT_BROWSERS_PATH`, `executablePath`) for portability.
- **Don't use `npmDepsHash`** — use `importNpmLock` instead to avoid manual hash maintenance.
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| npm dependency resolution in Nix | Manual fetchurl per dep | `importNpmLock` / `buildNpmPackage` | Hundreds of transitive deps, integrity verification |
| Rust build caching | Custom `nix-store --add` | crane `buildDepsOnly` + `buildPackage` | Proper incremental caching, handles workspace patterns |
| Binary wrapping | Shell scripts in `bin/` | `makeWrapper` / `wrapProgram` | Handles PATH, env vars, preserves existing env |
| Chromium for Playwright | Download script in derivation | `playwright-driver.browsers` (Linux) | Reproducible, properly linked for NixOS |
| Multi-platform support | Separate flake per OS | `flake-utils.lib.eachDefaultSystem` | Standard pattern, handles system-specific deps |

**Key insight:** Nix already has solutions for every packaging concern in this project. The complexity is in wiring them together correctly, not in building new infrastructure.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Playwright Version Mismatch
**What goes wrong:** Playwright rejects Nix-provided browsers because revision doesn't match
**Why it happens:** npm `playwright-core` version and nixpkgs `playwright-driver` version are different
**How to avoid:** Pin `playwright-core` in `daemon/package.json` to match the version in the nixpkgs revision you're using. Check with `nix eval nixpkgs#playwright-driver.version`.
**Warning signs:** "Browser version mismatch" errors, "chromium-NNNN not found" errors

### Pitfall 2: Chromium Not Available on macOS in Nix
**What goes wrong:** `playwright-driver.browsers` fails to build on Darwin
**Why it happens:** nixpkgs does not package Chromium for macOS (issue #247855, closed as "not planned")
**How to avoid:** Platform-conditional logic: use `playwright-driver.browsers` on Linux only. On macOS, rely on system Chrome or Playwright's own download mechanism.
**Warning signs:** `nix build` fails with "attribute 'chromium' missing" or "unsupported platform"

### Pitfall 3: Missing package-lock.json
**What goes wrong:** `importNpmLock` fails because it can't find lock file
**Why it happens:** `package-lock.json` not committed to git, or not present in daemon/
**How to avoid:** Run `npm install --package-lock-only` in daemon/, commit the lockfile. Nix flakes only see git-tracked files.
**Warning signs:** "No such file: package-lock.json" during `nix build`

### Pitfall 4: Rust Build Needs libiconv on macOS
**What goes wrong:** Rust build fails with linker errors on Darwin
**Why it happens:** macOS needs `libiconv` for certain Rust crates, not provided by default in Nix sandbox
**How to avoid:** Add `pkgs.libiconv` to `buildInputs` conditionally: `pkgs.lib.optionals pkgs.stdenv.isDarwin [ pkgs.libiconv ]`
**Warning signs:** "undefined symbol _libiconv" linker errors

### Pitfall 5: Source Filtering Excludes Needed Files
**What goes wrong:** `craneLib.cleanCargoSource` strips non-Rust files needed by build
**Why it happens:** Clean source filter only keeps .rs, Cargo.toml, Cargo.lock by default
**How to avoid:** Our daemon is a separate derivation, so this isn't a problem. But if you needed non-Rust files in the CLI build, use `craneLib.path` with custom filter instead of `cleanCargoSource`.
**Warning signs:** "file not found" during cargo build inside Nix

### Pitfall 6: daemon/dist/ Must Be Pre-Built
**What goes wrong:** dist/ directory missing in Nix build because `dontNpmBuild = true`
**Why it happens:** We skip npm build in Nix, so dist/ must exist in the source tree
**How to avoid:** Either commit dist/ to git, or add a `preBuild` phase that runs `npx tsc` (requires TypeScript in nativeBuildInputs). Committing dist/ is simpler for our use case.
**Warning signs:** "Cannot find module daemon/dist/daemon.js" at runtime
</common_pitfalls>

<code_examples>
## Code Examples

### Complete Flake Structure (Recommended)

```nix
# Source: Synthesized from crane docs, nixpkgs JavaScript docs, makeWrapper patterns
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    crane.url = "github:ipetkov/crane";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, crane, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        craneLib = crane.mkLib pkgs;

        # --- Daemon derivation ---
        daemon = pkgs.buildNpmPackage {
          pname = "debug-browser-daemon";
          version = "0.1.0";
          src = ./daemon;
          npmDeps = pkgs.importNpmLock { npmRoot = ./daemon; };
          npmConfigHook = pkgs.importNpmLock.npmConfigHook;
          dontNpmBuild = true;
          installPhase = ''
            runHook preInstall
            mkdir -p $out/lib/daemon
            cp -r dist $out/lib/daemon/dist
            cp -r node_modules $out/lib/daemon/node_modules
            cp package.json $out/lib/daemon/package.json
            runHook postInstall
          '';
        };

        # --- Rust CLI derivation ---
        commonArgs = {
          src = craneLib.cleanCargoSource ./.;
          strictDeps = true;
          buildInputs = pkgs.lib.optionals pkgs.stdenv.isDarwin [
            pkgs.libiconv
          ];
        };
        cargoArtifacts = craneLib.buildDepsOnly commonArgs;
        cli = craneLib.buildPackage (commonArgs // {
          inherit cargoArtifacts;
        });

        # --- Wrapper args (platform-conditional) ---
        wrapperArgs = [
          "--prefix PATH : ${pkgs.lib.makeBinPath [ pkgs.nodejs ]}"
          "--set DEBUG_BROWSER_DAEMON_PATH ${daemon}/lib/daemon/dist/daemon.js"
        ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
          "--set PLAYWRIGHT_BROWSERS_PATH ${pkgs.playwright-driver.browsers}"
          "--set PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS true"
        ];

      in {
        packages.default = pkgs.symlinkJoin {
          name = "debug-browser-${cli.version or "0.1.0"}";
          paths = [ cli ];
          nativeBuildInputs = [ pkgs.makeWrapper ];
          postBuild = ''
            wrapProgram $out/bin/debug-browser \
              ${builtins.concatStringsSep " \\\n              " wrapperArgs}
          '';
        };

        devShells.default = craneLib.devShell {
          packages = with pkgs; [ nodejs ];
        };
      });
}
```

### Using the Flake

```bash
# Build and run
nix build
./result/bin/debug-browser --help

# Install to profile
nix profile install .

# Use as flake input in another project
{
  inputs.debug-browser.url = "github:sobelio/debug-browser";
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| naersk | crane | 2023-2024 | Better caching, more maintained |
| node2nix | buildNpmPackage | 2023 | Built into nixpkgs, simpler |
| npmDepsHash | importNpmLock | 2024 | No manual hash maintenance |
| Manual browser setup | playwright-driver.browsers | 2024 | Reproducible Playwright on NixOS |

**New tools/patterns:**
- **importNpmLock**: Newer nixpkgs helper that reads integrity hashes from package-lock.json directly, no `npmDepsHash` needed
- **crane 0.23+**: Latest releases with improved caching and flake-parts integration

**Deprecated/outdated:**
- **node2nix**: Still works but maintenance burden is high, prefer buildNpmPackage
- **npmlock2nix**: Archived/superseded
- **naersk**: Still maintained minimally but community has moved to crane
</sota_updates>

<open_questions>
## Open Questions

1. **Playwright version pinning strategy**
   - What we know: npm playwright-core must match nixpkgs playwright-driver
   - What's unclear: Best way to keep these in sync across nixpkgs updates
   - Recommendation: Pin nixpkgs to a specific commit, document the required playwright-core version

2. **macOS browser handling**
   - What we know: System Chrome works via executablePath, Playwright can download its own Chromium
   - What's unclear: Whether to auto-detect Chrome location or require explicit configuration
   - Recommendation: Auto-detect common Chrome paths on macOS, fall back to Playwright download

3. **daemon/dist/ in git**
   - What we know: `dontNpmBuild = true` requires pre-built dist/
   - What's unclear: Whether to commit dist/ or add TypeScript build step to Nix derivation
   - Recommendation: Add TypeScript as nativeBuildInput and build in derivation for reproducibility, OR use a Nix build phase that runs `npx tsc`

4. **daemon/dist/scripts/ (injected JS files)**
   - What we know: The daemon has scripts/ dir with React DevTools hook JS files
   - What's unclear: These need to be included in the daemon derivation
   - Recommendation: Ensure installPhase copies dist/scripts/ alongside dist/
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [Crane documentation](https://crane.dev/) - flake structure, API reference, quick-start example
- [Crane GitHub](https://github.com/ipetkov/crane) - v0.23.1, 826 commits, actively maintained
- [Nixpkgs JavaScript framework docs](https://github.com/NixOS/nixpkgs/blob/master/doc/languages-frameworks/javascript.section.md) - buildNpmPackage, importNpmLock
- [NixOS Wiki: Playwright](https://wiki.nixos.org/wiki/Playwright) - playwright-driver.browsers setup
- [makeWrapper and wrapProgram reference](https://gist.github.com/CMCDragonkai/9b65cbb1989913555c203f4fa9c23374) - wrapping patterns

### Secondary (MEDIUM confidence)
- [NixOS Discourse: Running Playwright Tests](https://discourse.nixos.org/t/running-playwright-tests/25655) - community patterns, 50+ replies
- [nixpkgs #274537](https://github.com/NixOS/nixpkgs/issues/274537) - playwright-driver.browsers Darwin issues
- [nixpkgs #247855](https://github.com/NixOS/nixpkgs/issues/247855) - Chromium not available on Darwin (closed: not planned)
- [benjaminkitt/nix-playwright-mcp](https://github.com/benjaminkitt/nix-playwright-mcp) - reference flake for Playwright + Nix
- [openai/codex flake.nix](https://github.com/openai/codex/blob/main/flake.nix) - mixed Rust + Node.js flake reference
- [Building Rust with Nix (Dec 2025)](https://jakebox.github.io/posts/2025-12-04-nix_rust.html) - crane vs alternatives

### Tertiary (LOW confidence - needs validation)
- daemon/dist/ commit strategy — needs testing during implementation
- Exact playwright-core version matching — needs verification against current nixpkgs
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Nix flakes, crane, buildNpmPackage
- Ecosystem: makeWrapper, playwright-driver, importNpmLock, flake-utils
- Patterns: Separate derivations, platform-conditional wrapping, incremental caching
- Pitfalls: Version mismatch, Darwin Chromium, missing lockfiles, libiconv

**Confidence breakdown:**
- Standard stack: HIGH - verified with official docs and GitHub activity
- Architecture: HIGH - synthesized from multiple authoritative sources
- Pitfalls: HIGH - documented in nixpkgs issues and NixOS discourse
- Code examples: MEDIUM-HIGH - synthesized from patterns, needs validation during implementation

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (30 days - Nix ecosystem relatively stable)
</metadata>

---

*Phase: 09-nix-flake*
*Research completed: 2026-03-15*
*Ready for planning: yes*
