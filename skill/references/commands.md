# Command Reference

## Command Cheat Sheet

| Command | Purpose | Key Flags |
|---------|---------|-----------|
| `navigate <url>` | Open a URL in the browser | |
| `react detect` | Check if React is present on the page | |
| `components` | List React component tree | `--depth`, `--component`, `--no-props`, `--no-state`, `--compact` |
| `hooks <component>` | Inspect hooks for a named component | `--depth`, `--compact` |
| `set-state <component> <index> <value>` | Set a useState/useReducer hook's value | |
| `console logs` | Show collected console.log messages | |
| `console errors` | Show collected errors and exceptions | |
| `console clear` | Clear the console inbox | |
| `cookies get` | Get all browser cookies | |
| `cookies set <name> <value>` | Set a cookie | `--domain`, `--path`, `--secure`, `--http-only`, `--same-site`, `--expires` |
| `cookies clear` | Clear all cookies | |
| `storage local [get\|set\|clear]` | Manage localStorage | |
| `storage session [get\|set\|clear]` | Manage sessionStorage | |
| `state save <path>` | Save browser state (cookies + storage) to JSON | |
| `click <selector>` | Click an element by CSS selector | |
| `type <selector> <text>` | Type text into an input element | |
| `eval <expression>` | Evaluate JavaScript in page context | |
| `close` | Close browser and shut down daemon | |

## Global Flags

These flags apply to all commands. Place them before the subcommand.

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--format` | `text \| json` | `text` | Output format. Use `json` for structured, parseable output. |
| `--session` | `string` | `"default"` | Session name for daemon multiplexing. Each session runs an independent browser. |
| `--connect` | `string` | none | Attach to existing Chrome via CDP. Accepts a port number (e.g., `9222`) or a WebSocket URL (e.g., `ws://127.0.0.1:9222/devtools/browser/...`). |
| `--state` | `string` | none | Load browser state (cookies + localStorage) from a JSON file at launch. Created via `state save`. |
| `--profile` | `string` | none | Use a persistent browser profile directory. Persists cookies, cache, and storage between sessions. Cannot be combined with `--state`. |
| `--verbose` / `-v` | `bool` | `false` | Enable verbose/debug logging. |

```bash
debug-browser --format json --session myapp components
debug-browser --connect 9222 navigate http://localhost:3000
debug-browser --state ./saved-state.json navigate http://localhost:3000
debug-browser --profile ./my-profile navigate http://localhost:3000
```

---

## navigate

**Syntax:**

```
debug-browser navigate <url>
```

**Purpose:** Open a URL in the headless browser. Launches the daemon and browser automatically if not already running.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `url` | `string` | yes | URL to navigate to. If no scheme is present, `https://` is prepended automatically. |

**Output:**

- **text:** Confirmation message with the navigated URL.
- **json:** `{ "success": true, "data": "Navigated to <url>" }`

**Example:**

```bash
debug-browser navigate http://localhost:3000
debug-browser navigate example.com          # becomes https://example.com
debug-browser navigate file:///path/to.html
```

**Notes:**
- For local dev servers, always specify `http://` explicitly.
- Recognized schemes that skip auto-prepend: `http://`, `https://`, `about:`, `data:`, `file:`.
- Can be called multiple times to navigate to different pages within the same session.

---

## react detect

**Syntax:**

```
debug-browser react detect
```

**Purpose:** Check whether React is loaded on the current page and whether DevTools hooks are available.

**Arguments:** None.

**Output:**

- **text:** Human-readable detection result with React version.
- **json:** `{ "success": true, "data": { "detected": true, "version": "18.2.0" } }`

**Example:**

```bash
debug-browser react detect
```

**Notes:**
- Always run this before `components` or `hooks`. Non-React pages return empty component trees without errors, which can be misleading.
- Detection relies on React DevTools global hooks (`__REACT_DEVTOOLS_GLOBAL_HOOK__`).

---

## components

**Syntax:**

```
debug-browser components [flags]
```

**Purpose:** List the React component tree with optional props, state, and filtering.

**Flags:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--depth` | `u32` | `100` | Maximum tree traversal depth. |
| `--component` | `string` | none | Filter to components matching this name. Case-insensitive substring match. Preserves ancestors for context. |
| `--include-host` | `bool` | `false` | Include host elements (div, span, etc.) in output. |
| `--no-props` | `bool` | `false` | Hide component props from output. |
| `--no-state` | `bool` | `false` | Hide component state from output. |
| `--props-depth` | `u32` | `3` | Maximum serialization depth for props and state values. |
| `--compact` | `bool` | `false` | Compact output: names-only tree with count. Minimal token usage. |

**Output:**

- **text:** Indented tree with component names, types, keys, props, and state. Footer shows total component count.
- **json:** `{ "success": true, "data": { "roots": [...], "componentCount": N } }`

**Example:**

```bash
# Full tree, depth-limited
debug-browser components --depth 3

# Filter to specific component
debug-browser components --component SearchBar

# Structure only, no data
debug-browser components --no-props --no-state

# Include DOM elements
debug-browser components --include-host --depth 2

# Deep prop serialization
debug-browser components --component DataGrid --props-depth 5

# Compact: names only, minimal output
debug-browser components --compact
```

**Notes:**
- On pages without React, returns "No React components detected" (text) or an object with `componentCount: 0` (JSON).
- The `--component` filter preserves ancestor components in the tree, showing the full path from root to each matched component.
- Combine `--no-props --no-state` first to get a structural overview, then drill into specific components.

---

## hooks

**Syntax:**

```
debug-browser hooks <component> [flags]
```

**Purpose:** Inspect all hooks for a named React component, including state values, effect dependencies, ref values, memoized values, and context.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `component` | `string` | yes | Component name to inspect hooks for. |

**Flags:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--depth` | `u32` | `3` | Maximum serialization depth for hook values. |
| `--compact` | `bool` | `false` | Compact output: types-only list with count. Minimal token usage. |

**Output:**

- **text:** Formatted list of hooks with index, type, and values. Example:
  ```
  Hooks for TodoList (function, 4 hooks):
    [0] useState: ["item1","item2"]
    [1] useEffect: deps=[2] cleanup=no
    [2] useRef: current=null
    [3] useCallback: deps=[2]
  ```
- **json:** `{ "success": true, "data": { "component": "TodoList", "type": "function", "hookCount": 4, "hooks": [...] } }`

**Example:**

```bash
debug-browser hooks TodoList
debug-browser hooks App --depth 5
debug-browser hooks DataGrid --format json
debug-browser hooks Counter --compact
```

**Notes:**
- Supported hook types: useState, useReducer, useEffect, useLayoutEffect, useInsertionEffect, useRef, useMemo, useCallback, useContext, useTransition, useDeferredValue, useId, useSyncExternalStore, useDebugValue, and custom hooks.
- For class components, returns `classState` instead of hooks array.
- Each hook has a stable index (`[0]`, `[1]`, etc.) for tracking values across repeated inspections.
- If multiple components match the name, the first match is inspected.

---

## set-state

**Syntax:**

```
debug-browser set-state <component> <hook-index> <value>
```

**Purpose:** Set the value of a `useState` or `useReducer` hook, triggering a React re-render. Enables testing edge cases and reproducing bugs by forcing specific state values without UI interaction.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `component` | `string` | yes | Component name (same substring match as `hooks`). |
| `hook-index` | `u32` | yes | Hook index (0-based, as shown in `hooks` output). |
| `value` | `string` | yes | New value as JSON. Non-JSON strings are treated as string values. |

**Output:**

- **text:** Confirmation with component name and hook index. Example:
  ```
  State updated: Counter hook [0]
  ```
- **json:** `{ "success": true, "data": { "component": "Counter", "hookIndex": 0, "success": true, "method": "overrideHookState" } }`

**Example:**

```bash
# Set a number
debug-browser set-state Counter 0 42

# Set an array
debug-browser set-state TodoList 1 '["item1","item2"]'

# Set an object
debug-browser set-state Settings 0 '{"theme":"dark"}'

# Set a string (quoted JSON)
debug-browser set-state Greeting 0 '"hello"'

# Set a boolean
debug-browser set-state Toggle 0 false

# Set null
debug-browser set-state Form 0 null
```

**Notes:**
- Only `useState` and `useReducer` hooks can be set. Other hook types (useEffect, useRef, useMemo, etc.) return an error.
- The value argument is parsed as JSON. If JSON parsing fails, it is treated as a plain string.
- The state update triggers a normal React re-render — effects, derived state, and child components update accordingly.
- Uses React DevTools' `overrideHookState` API when available, with a fallback to the hook's dispatch function.
- Use `hooks <component>` first to identify the correct hook index.

---

## console logs

**Syntax:**

```
debug-browser console logs
```

**Purpose:** Retrieve all collected `console.log` messages from the inbox.

**Arguments:** None.

**Output:**

- **text:** Log messages, one per line.
- **json:** `{ "success": true, "data": [...] }`

**Example:**

```bash
debug-browser console logs
debug-browser console logs --format json
```

**Notes:**
- Messages accumulate across all commands in the session until cleared.
- Includes messages from all page navigations within the session.

---

## console errors

**Syntax:**

```
debug-browser console errors
```

**Purpose:** Retrieve all collected `console.error` messages and uncaught exceptions from the inbox.

**Arguments:** None.

**Output:**

- **text:** Error messages, one per line.
- **json:** `{ "success": true, "data": [...] }`

**Example:**

```bash
debug-browser console errors
debug-browser console errors --format json
```

**Notes:**
- Captures both explicit `console.error()` calls and uncaught exceptions/promise rejections.
- Messages accumulate until cleared with `console clear`.

---

## console clear

**Syntax:**

```
debug-browser console clear
```

**Purpose:** Clear all messages (logs and errors) from the console inbox.

**Arguments:** None.

**Output:**

- **text:** `OK`
- **json:** `{ "success": true }`

**Example:**

```bash
debug-browser console clear
```

**Notes:**
- Run this before a specific interaction to isolate new console output from historical messages.
- Clears both logs and errors.

---

## click

**Syntax:**

```
debug-browser click <selector>
```

**Purpose:** Click an element identified by CSS selector.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `selector` | `string` | yes | CSS selector for the target element. |

**Output:**

- **text:** Confirmation message.
- **json:** `{ "success": true, "data": "Clicked <selector>" }`

**Example:**

```bash
debug-browser click "button.submit"
debug-browser click "#login-btn"
debug-browser click "[data-testid='save']"
```

**Notes:**
- Waits for the element to be present before clicking.
- Use specific selectors (`#id`, `[data-testid]`) to avoid ambiguity.
- Re-inspect components and hooks after clicking to observe state changes.

---

## type

**Syntax:**

```
debug-browser type <selector> <text>
```

**Purpose:** Type text into an input element identified by CSS selector.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `selector` | `string` | yes | CSS selector for the input element. |
| `text` | `string` | yes | Text to type into the element. |

**Output:**

- **text:** Confirmation message.
- **json:** `{ "success": true, "data": "Typed into <selector>" }`

**Example:**

```bash
debug-browser type "#search-input" "search query"
debug-browser type "input[name='email']" "user@example.com"
```

**Notes:**
- The element must be an input, textarea, or contenteditable element.
- Text is typed character by character, triggering input events as a real user would.

---

## eval

**Syntax:**

```
debug-browser eval <expression>
```

**Purpose:** Evaluate a JavaScript expression in the page context and return the result.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `expression` | `string` | yes | JavaScript expression to evaluate. |

**Output:**

- **text:** The return value, printed as a string.
- **json:** `{ "success": true, "data": <return_value> }`

**Example:**

```bash
debug-browser eval "document.title"
debug-browser eval "document.querySelectorAll('.item').length"
debug-browser eval "JSON.stringify(localStorage)"
debug-browser eval "window.__STORE__.getState()"
```

**Notes:**
- The expression runs in the page's global scope.
- Return values are serialized. Complex objects may be truncated.
- Use `--format json` for structured return values.

---

## cookies

**Syntax:**

```
debug-browser cookies [get|set|clear]
```

**Purpose:** Manage browser cookies for the current context.

### cookies get

```bash
debug-browser cookies get [urls...]
```

Get all cookies, optionally filtered by URLs.

### cookies set

```bash
debug-browser cookies set <name> <value> [flags]
```

Set a cookie with the given name and value.

| Flag | Type | Description |
|------|------|-------------|
| `--domain` | `string` | Cookie domain |
| `--path` | `string` | Cookie path |
| `--http-only` | `bool` | Mark as HTTP-only |
| `--secure` | `bool` | Mark as secure |
| `--same-site` | `string` | SameSite attribute (Strict, Lax, None) |
| `--expires` | `f64` | Expiration as Unix timestamp |

### cookies clear

```bash
debug-browser cookies clear
```

Clear all cookies from the browser context.

**Example:**

```bash
debug-browser cookies set session_id abc123
debug-browser cookies get
debug-browser cookies clear
```

---

## storage

**Syntax:**

```
debug-browser storage <local|session> [get|set|clear]
```

**Purpose:** Manage localStorage or sessionStorage.

### storage local/session

```bash
# List all entries
debug-browser storage local

# Get a specific key
debug-browser storage local get <key>

# Set a key-value pair
debug-browser storage local set <key> <value>

# Clear all entries
debug-browser storage local clear
```

Same syntax applies for `storage session`.

**Example:**

```bash
debug-browser storage local set theme dark
debug-browser storage local get theme
debug-browser storage local
debug-browser storage session clear
```

---

## state save

**Syntax:**

```
debug-browser state save <path>
```

**Purpose:** Save browser state (cookies + localStorage) to a JSON file. The saved file can be loaded at launch with the `--state` flag.

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `path` | `string` | yes | Path to save the state JSON file. |

**Example:**

```bash
# Save current state
debug-browser state save ./my-state.json

# Later, restore state at launch
debug-browser --state ./my-state.json navigate http://localhost:3000
```

---

## close

**Syntax:**

```
debug-browser close
```

**Purpose:** Close the browser and shut down the daemon process for the current session.

**Arguments:** None.

**Output:**

- **text:** `OK`
- **json:** `{ "success": true }`

**Example:**

```bash
debug-browser close
debug-browser --session myapp close
```

**Notes:**
- Only closes the session specified by `--session` (default: `"default"`).
- Other sessions remain running.
- The daemon and browser are fully terminated. The next command in this session will re-launch them.
