# Phase 7: Context Saving & AI Token Efficiency - Research

**Researched:** 2026-03-15
**Domain:** agent-browser feature porting (state persistence, snapshot filtering, refmap)
**Confidence:** HIGH (source code analysis of reference implementation)

<research_summary>
## Summary

Researched agent-browser's implementation of state persistence, cookie/storage commands, snapshot filtering, and the refmap element selection system. All features are built on Playwright APIs and can be ported to debug-browser's existing daemon architecture with minimal structural changes.

Key finding: The refmap system is the highest-value feature for AI token efficiency. It assigns deterministic element refs (`@e1`, `@e2`) during ARIA snapshots, enabling 85-92% token reduction and more robust element selection than CSS selectors. The snapshot filtering (`-i`, `-c`, `-d`, `-s`) compounds with refs for massive savings.

State persistence is straightforward — Playwright's `context.storageState()` and `launchPersistentContext()` handle the heavy lifting. Cookie/storage commands are thin wrappers around Playwright APIs.

**Primary recommendation:** Port the refmap + snapshot system first (highest AI value), then state persistence (useful for auth debugging), then cookie/storage commands (straightforward).
</research_summary>

<standard_stack>
## Standard Stack

No new libraries needed. All features use existing Playwright APIs already available in the daemon.

### Core Playwright APIs

| API | Purpose | Used By |
|-----|---------|---------|
| `page.locator(sel).ariaSnapshot()` | Generate accessibility tree text | Snapshot command |
| `page.getByRole(role, {name, exact})` | Build locator from ref data | RefMap resolution |
| `context.storageState({path})` | Save cookies + localStorage to JSON | State save |
| `launcher.launchPersistentContext(dir, opts)` | Persistent browser profile | --profile flag |
| `context.cookies(urls?)` | Read cookies | cookies get |
| `context.addCookies(cookies[])` | Write cookies | cookies set |
| `context.clearCookies()` | Delete cookies | cookies clear |
| `page.evaluate(expr)` | Access localStorage/sessionStorage | storage get/set/clear |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Playwright ariaSnapshot | Manual DOM walk (current) | ariaSnapshot is native, deterministic, includes ARIA roles properly |
| getByRole locators | CSS selectors | getByRole is semantic, more robust to DOM changes |
| storageState JSON | Custom cookie serialization | Playwright format is standard, handles edge cases |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Pattern 1: Snapshot + RefMap (from agent-browser/src/snapshot.ts)

**What:** Generate accessibility tree with sequential element refs, store ref→locator mapping in daemon memory.

**How it works:**
1. Call `page.locator(selector).ariaSnapshot()` to get ARIA tree text
2. Parse each line with regex to extract role, name, text
3. Assign sequential refs (`e1`, `e2`, `e3`) to elements
4. Track (role, name) combinations for disambiguation
5. Build refMap: `{e1: {selector, role, name, nth?}}`
6. Return formatted tree + refMap to client

**RefMap type:**
```typescript
interface RefMap {
  [ref: string]: {
    selector: string;     // getByRole selector string
    role: string;         // ARIA role
    name?: string;        // Accessible name
    nth?: number;         // Only if duplicate role+name exists
  };
}
```

**Ref resolution in commands:**
```typescript
getLocatorFromRef(refArg: string): Locator | null {
  const ref = parseRef(refArg);  // "@e1" → "e1"
  const data = this.refMap[ref];
  let locator = page.getByRole(data.role, { name: data.name, exact: true });
  if (data.nth !== undefined) locator = locator.nth(data.nth);
  return locator;
}
```

### Pattern 2: Filter During Parse (not post-process)

**What:** Apply snapshot filters (interactive, compact, depth) during ARIA tree parsing, not after.

**Filtering rules:**
- **Interactive (`-i`):** Keep only roles in INTERACTIVE_ROLES set (button, link, textbox, checkbox, radio, combobox, listbox, menuitem, option, searchbox, slider, spinbutton, switch, tab, treeitem)
- **Compact (`-c`):** Remove unnamed structural elements (generic, group without name)
- **Depth (`-d N`):** Filter by indentation level
- **Scoped (`-s selector`):** Limit to subtree via `page.locator(selector).ariaSnapshot()`

### Pattern 3: Auto-Detect Refs in Commands

**What:** All interaction commands check if selector is a ref first, then fall back to CSS.

```typescript
getLocator(selectorOrRef: string): Locator {
  const fromRef = this.getLocatorFromRef(selectorOrRef);
  if (fromRef) return fromRef;
  return this.page.locator(selectorOrRef);  // CSS fallback
}
```

This means existing commands (click, type, etc.) work with both `@e1` and `#my-button` without any special handling.

### Pattern 4: State Persistence Layers

**Two orthogonal approaches, different use cases:**

| Layer | Mechanism | Persists | Use Case |
|-------|-----------|----------|----------|
| State save/load | `context.storageState({path})` | Cookies + localStorage | Save auth for replay |
| Profile | `launchPersistentContext(dir)` | All browser data (cookies, cache, etc.) | Persistent sessions |

**Key insight:** `state load` is launch-time only — must be passed when creating browser context. Cannot load mid-session.

### Anti-Patterns to Avoid
- **Custom DOM walking for snapshot:** Use Playwright's ariaSnapshot — it handles ARIA roles correctly
- **Post-processing snapshot for filtering:** Filter during parse to avoid processing discarded nodes
- **Invalidating refs manually:** Refs auto-reset on each snapshot call; don't track page changes
- **Storing refs across sessions:** Refs are ephemeral; only valid until next snapshot
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessibility tree | Manual DOM walk with role detection | `locator.ariaSnapshot()` | Handles ARIA roles, computed names, tree structure correctly |
| Element disambiguation | Custom selector generation | `getByRole + nth` pattern | Playwright handles accessibility name resolution |
| Cookie serialization | Custom cookie parsing/formatting | `context.cookies()` / `context.addCookies()` | Handles all cookie attributes, domain scoping |
| Storage state format | Custom JSON schema | `context.storageState()` | Standard Playwright format, handles origins correctly |
| Profile persistence | Manual cookie/cache management | `launchPersistentContext()` | Handles all browser state, Chrome profile format |

**Key insight:** Every feature in this phase is a thin wrapper around a Playwright API. The value is in the CLI interface, filtering logic, and refmap — not in reimplementing browser primitives.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: State Load Timing
**What goes wrong:** Attempting to load storage state after browser context is created
**Why it happens:** `state_load` looks like it should work at runtime, but storageState must be set at context creation
**How to avoid:** Pass storage state path at launch time (--state flag), not as runtime command. Agent-browser's `state_load` handler actually returns a "use --state flag" message.
**Warning signs:** State appears loaded but cookies/storage empty in page

### Pitfall 2: Ref Invalidation After Page Changes
**What goes wrong:** Using refs from a previous snapshot after navigation or DOM mutation
**Why it happens:** Refs are index-based, not stable identifiers — DOM changes shuffle them
**How to avoid:** Document clearly that clients must re-snapshot after page changes. Return helpful error: "Run 'snapshot' to get updated refs"
**Warning signs:** Click/type targets wrong element; "Element not found" errors

### Pitfall 3: Duplicate Role+Name Without nth
**What goes wrong:** Multiple buttons with same name (e.g., "Submit") — ref resolves ambiguously
**Why it happens:** Without nth disambiguation, getByRole returns multiple matches
**How to avoid:** Track (role, name) combinations during snapshot; add nth index for duplicates. Agent-browser does a two-pass approach.
**Warning signs:** Playwright strict mode error "resolved to N elements"

### Pitfall 4: Profile + State Flag Conflict
**What goes wrong:** Using both --profile and --state together
**Why it happens:** Profile IS a state persistence mechanism; combining them creates conflicts
**How to avoid:** Validate at launch: --profile and --state are mutually exclusive
**Warning signs:** Unpredictable cookie/storage behavior

### Pitfall 5: Interactive Filter Too Aggressive
**What goes wrong:** Filtered snapshot misses important elements (e.g., headings for orientation)
**Why it happens:** Interactive-only mode drops all non-interactive elements including headings
**How to avoid:** Also include CONTENT_ROLES (heading, cell, listitem, etc.) in interactive mode. Agent-browser includes headings in interactive mode.
**Warning signs:** AI can't orient on page, asks "what section am I in?"
</common_pitfalls>

<code_examples>
## Code Examples

### ARIA Snapshot Generation (from agent-browser)
```typescript
// Source: agent-browser/src/snapshot.ts
const locator = options.selector
  ? page.locator(options.selector)
  : page.locator('body');
const ariaTree = await locator.ariaSnapshot();
// Returns text like:
// - navigation "Main":
//   - link "Home"
//   - link "Products"
// - main:
//   - heading "Welcome" [level=1]
//   - button "Sign In"
//   - textbox "Search..."
```

### Ref Assignment During Parse
```typescript
// Source: agent-browser/src/snapshot.ts (simplified)
let refCounter = 0;
const refMap: RefMap = {};
const tracker: Map<string, number[]> = new Map();

for (const line of ariaTree.split('\n')) {
  const match = line.match(/^(\s*)- (\w+)(?:\s+"([^"]*)")?/);
  if (!match) continue;

  const [, indent, role, name] = match;
  const depth = indent.length / 2;

  if (options.maxDepth && depth > options.maxDepth) continue;
  if (options.interactive && !INTERACTIVE_ROLES.has(role)) continue;

  const ref = `e${++refCounter}`;
  const key = `${role}:${name || ''}`;

  if (!tracker.has(key)) tracker.set(key, []);
  tracker.get(key)!.push(refCounter);

  refMap[ref] = { role, name, selector: buildSelector(role, name) };
  output += `${indent}[${ref}] ${role}${name ? ` "${name}"` : ''}\n`;
}

// Second pass: add nth for disambiguation
for (const [key, indices] of tracker) {
  if (indices.length > 1) {
    indices.forEach((idx, nth) => {
      refMap[`e${idx}`].nth = nth;
    });
  }
}
```

### Storage State Save/Load
```typescript
// Save (runtime)
await context.storageState({ path: '/tmp/auth-state.json' });

// Load (launch-time only)
const context = await browser.newContext({
  storageState: '/tmp/auth-state.json'
});
```

### Cookie Commands
```typescript
// Get all cookies
const cookies = await context.cookies();

// Get cookies for specific URLs
const cookies = await context.cookies(['https://example.com']);

// Set cookie (auto-fill URL if no domain/path specified)
const pageUrl = page.url();
const cookie = { name: 'token', value: 'abc123' };
if (!cookie.url && !cookie.domain) cookie.url = pageUrl;
await context.addCookies([cookie]);

// Clear
await context.clearCookies();
```

### Storage via page.evaluate
```typescript
// Get all localStorage
const data = await page.evaluate(() => {
  const result: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) result[key] = localStorage.getItem(key)!;
  }
  return result;
});

// Set
await page.evaluate(
  `localStorage.setItem(${JSON.stringify(key)}, ${JSON.stringify(value)})`
);
```
</code_examples>

<sota_updates>
## State of the Art

| Old Approach | Current Approach | Impact |
|---|---|---|
| CSS selectors for AI | ARIA refs (@e1) | 85-92% token reduction, more robust |
| Full DOM snapshot | Filtered ARIA tree | Dramatically less context needed |
| Manual cookie management | Playwright storageState | Standard format, one-line save/load |
| No state persistence | Profile + state save/load | Auth debugging without re-login |

**Key context for debug-browser:** The refmap system is specifically designed for AI agent interaction — it was built to reduce token usage and make element selection more reliable for LLMs. This directly benefits the Claude Code skill.
</sota_updates>

<open_questions>
## Open Questions

1. **Should snapshot replace or augment existing `components` command?**
   - What we know: `snapshot` gives DOM/ARIA view; `components` gives React fiber view
   - Recommendation: Keep both — they serve different purposes. Snapshot for interaction, components for React debugging.

2. **Should refs work with React component commands (hooks, etc.)?**
   - What we know: Refs point to DOM elements, not React components
   - Recommendation: Refs for interaction commands only (click, type). React commands keep using component name filters.

3. **Token budget for snapshot in skill definition**
   - What we know: Interactive-only snapshot is ~300 tokens for typical page
   - Recommendation: Update skill to prefer `snapshot -i` for orientation, full snapshot only when needed
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- agent-browser source code at /Users/whn/tmp/agent-browser/src/snapshot.ts — Full snapshot + refmap implementation
- agent-browser source code at /Users/whn/tmp/agent-browser/src/browser.ts — State persistence, profile launch, ref resolution
- agent-browser source code at /Users/whn/tmp/agent-browser/src/actions.ts — All command handlers
- agent-browser source code at /Users/whn/tmp/agent-browser/src/types.ts — Type definitions
- agent-browser source code at /Users/whn/tmp/agent-browser/src/protocol.ts — Zod schemas
- agent-browser source code at /Users/whn/tmp/agent-browser/cli/src/commands.rs — CLI parsing
- debug-browser daemon at /Users/whn/code/debug-browser/daemon/src/ — Current architecture

### Secondary (MEDIUM confidence)
- Playwright documentation for ariaSnapshot(), storageState(), launchPersistentContext() — API confirmed in agent-browser usage
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: Playwright APIs for accessibility, state, cookies, storage
- Ecosystem: No new libraries needed — all features use existing Playwright
- Patterns: RefMap generation, ARIA snapshot filtering, state persistence layers
- Pitfalls: Ref invalidation, state load timing, duplicate disambiguation, filter aggressiveness

**Confidence breakdown:**
- Standard stack: HIGH — direct source code analysis
- Architecture: HIGH — complete implementation available as reference
- Pitfalls: HIGH — edge cases visible in agent-browser error handling
- Code examples: HIGH — copied from working implementation

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (30 days — Playwright APIs are stable)
</metadata>

---

*Phase: 07-context-and-efficiency*
*Research completed: 2026-03-15*
*Ready for planning: yes*
