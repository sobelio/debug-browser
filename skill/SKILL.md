---
name: debug-browser
description: >
  Debug React applications via headless browser with rich introspection.
  Trigger when the user asks to: debug React app, inspect React components,
  check component state, view hook values, set React state, modify hook state,
  find component source, locate component file, capture console errors,
  debug React rendering, inspect fiber tree, examine React props,
  trace React re-renders, or diagnose React application issues.
---

# debug-browser

A CLI tool for debugging React applications through a headless browser with React DevTools-level introspection. It launches a headless Chromium instance via a persistent Node.js daemon, injects into the React fiber tree through internal DevTools hooks, and exposes component trees, hook state, console logs, and DOM interaction through simple CLI commands.

The architecture uses a long-lived daemon process that maintains the browser session across commands. The Rust CLI communicates with the daemon over a Unix socket. This means the first command launches the daemon and browser, and all subsequent commands execute instantly with no startup cost. The browser stays open until explicitly closed, preserving page state, console history, and React component state between inspections.

## Quick Start

Every debugging session follows the same three-step pattern: navigate, inspect, diagnose.

```bash
# 1. Navigate to the React application
debug-browser navigate http://localhost:3000

# 2. Confirm React is detected and inspect the component tree
debug-browser react detect
debug-browser components --depth 3

# 3. Drill into a specific component's hook state
debug-browser hooks TodoList
```

## Core Debugging Methodology

### Open the Application

Start by navigating to the target URL. The daemon launches automatically on the first command in a session — no separate setup step is needed.

```bash
debug-browser navigate http://localhost:3000/dashboard
```

If no scheme is provided, `https://` is prepended automatically. For local development servers, always include `http://` explicitly to avoid HTTPS redirection issues.

Navigate can be called multiple times to switch pages within the same session. The console inbox carries over between navigations, so clear it if only errors from the new page matter.

To attach to an already-running Chrome instance (e.g., one launched with `--remote-debugging-port=9222`) instead of launching a new headless browser:

```bash
debug-browser --connect 9222 navigate http://localhost:3000
debug-browser --connect ws://127.0.0.1:9222/devtools/browser/... navigate http://localhost:3000
```

The `--connect` flag accepts either a port number or a full WebSocket URL.

### Detect React

Before inspecting components, confirm React is present on the page. Non-React pages return empty component trees without error, so this step avoids confusion.

```bash
debug-browser react detect
```

This reports the React version and whether DevTools hooks are available.

### Inspect the Component Tree

List all React components with their props and state:

```bash
debug-browser components
```

On large applications, the full tree can be overwhelming. Use filters to narrow the output:

```bash
# Limit depth
debug-browser components --depth 3

# Filter to specific component (case-insensitive substring match)
debug-browser components --component SearchBar

# Hide props and state for a structural overview
debug-browser components --no-props --no-state

# Include host elements (div, span) alongside React components
debug-browser components --include-host
```

The `--component` filter preserves ancestor components in the tree for context, showing the path from root to matched components.

### Drill into Hook State

Inspect all hooks for a specific component by name:

```bash
debug-browser hooks TodoList
```

This reveals all hook types present in the component:

- **useState** — current state value
- **useReducer** — current reducer state
- **useEffect / useLayoutEffect / useInsertionEffect** — dependency arrays and whether a cleanup function exists
- **useRef** — current ref value
- **useMemo** — memoized value and dependency array
- **useCallback** — dependency array
- **useContext** — current context value
- **useTransition** — pending state
- **useDeferredValue** — deferred value
- **useId** — generated ID string
- **useSyncExternalStore** — current snapshot value
- **useDebugValue** — custom debug label
- **Custom hooks** — displayed with their debug label if available

Each hook is indexed (e.g., `[0]`, `[1]`) for consistent tracking across re-inspections. Compare hook values before and after interactions to trace state changes.

Control serialization depth for deeply nested hook values:

```bash
debug-browser hooks DataGrid --depth 5
```

The default serialization depth is 3. Increase it when inspecting components with deeply nested state objects or context values.

### Set Hook State

Directly modify a component's `useState` or `useReducer` value without interacting with the UI. This enables rapid hypothesis testing — inspect the current state, form a theory about a bug, and immediately test it by forcing a specific state value.

```bash
debug-browser set-state Counter 0 42
debug-browser set-state TodoList 1 '["item1","item2"]'
debug-browser set-state Settings 0 '{"theme":"dark","lang":"en"}'
```

The first argument is the component name (same substring match as `hooks`), the second is the hook index (as shown in `hooks` output), and the third is the new value as JSON.

Use `hooks` first to identify the hook index, then `set-state` to modify it:

```bash
# 1. Inspect current state
debug-browser hooks Counter
#   [0] useState: 5
#   [1] useEffect: deps=[5] cleanup=no

# 2. Set state to a boundary value
debug-browser set-state Counter 0 -1

# 3. Re-inspect to confirm and check for errors
debug-browser hooks Counter
debug-browser console errors
```

Only `useState` and `useReducer` hooks can be set. Attempting to set an effect, ref, or memo hook returns an error. The state update triggers a normal React re-render, so all derived state, effects, and child components update as expected.

### Locate Component Source Files

Source file locations appear automatically in `components` and `hooks` output when the app is running in development mode (Vite, webpack dev, Next.js dev, etc.):

```
LoginPage (function) src/pages/LoginPage.tsx:15
```

```
Hooks for LoginPage (function, src/pages/LoginPage.tsx:15, 5 hooks):
```

Use the dedicated `source` command for a quick lookup without the full tree or hook details:

```bash
debug-browser source LoginPage
# LoginPage -> src/pages/LoginPage.tsx:15
```

This maps directly to `file:line` format — use it to jump from inspection to editing the right file. Source info depends on React's `_debugSource` transform, which is included in development builds but stripped in production.

### Check Console Output

Console messages accumulate in an inbox between commands. Retrieve them at any time:

```bash
# View console.log messages
debug-browser console logs

# View console.error messages and uncaught exceptions
debug-browser console errors
```

Clear the inbox between debugging iterations to isolate new messages:

```bash
debug-browser console clear
```

### Interact with the Page

Simulate user interactions to trigger state changes, then re-inspect to observe the effect on component state and props. This is the core debugging loop: interact, then inspect.

```bash
# Click a button
debug-browser click "button.submit"

# Type into an input field
debug-browser type "#search-input" "query text"

# Re-inspect after interaction to see state changes
debug-browser components --component SearchResults
debug-browser hooks SearchResults
```

Both `click` and `type` use standard CSS selectors. The command waits for the element to be present before interacting. Use specific selectors to avoid ambiguity — prefer `#id` or `[data-testid="..."]` over generic tag selectors.

### Evaluate Custom JavaScript

Run arbitrary JavaScript in the page context for checks that the built-in commands do not cover. The expression is evaluated synchronously in the page and the return value is printed.

```bash
debug-browser eval "document.querySelectorAll('.error').length"
debug-browser eval "window.__STORE__.getState()"
debug-browser eval "document.title"
```

This is useful for checking Redux/Zustand stores, reading localStorage/sessionStorage values, verifying DOM structure, or running any page-context diagnostic.

### Close the Session

Shut down the browser and daemon when debugging is complete:

```bash
debug-browser close
```

## Key Principles

### Use JSON Format for Programmatic Parsing

When processing output programmatically, always use `--format json`. Text format is for human reading; JSON format provides structured, parseable output.

```bash
debug-browser components --format json
debug-browser hooks App --format json
```

### Always Detect React First

Run `debug-browser react detect` before component inspection. Non-React pages return empty trees without errors, which can be misleading. Detection confirms React is loaded and DevTools hooks are available.

### Filter Large Component Trees

Production React applications can have thousands of components. Always use `--component <name>` to filter to relevant components rather than dumping the entire tree. The filter performs case-insensitive substring matching and preserves ancestor components for context. Combine with `--depth` to limit traversal depth and `--no-props --no-state` to get a structural overview before drilling into specific components.

### Clear Console Between Iterations

Console logs and errors accumulate across all commands in a session. Run `debug-browser console clear` before each debugging iteration to ensure only fresh messages appear.

### Leverage Daemon Persistence

The daemon process and browser persist between commands. There is no startup cost after the first command. Take advantage of this by running multiple inspect-interact-inspect cycles without worrying about performance. Page state, React component state, and console history all persist across commands within the same session.

### Session Multiplexing

Use `--session <name>` to run multiple independent debugging sessions simultaneously. Each session has its own daemon process, browser instance, and console inbox:

```bash
debug-browser --session app1 navigate http://localhost:3000
debug-browser --session app2 navigate http://localhost:3001

# Inspect each independently
debug-browser --session app1 components --component Header
debug-browser --session app2 console errors
```

The default session name is `"default"`. Close each session independently with `debug-browser --session <name> close`.

### Consistent Debugging Pattern

For reliable results, follow this sequence when diagnosing an issue:

1. `navigate` to the page
2. `react detect` to confirm React is loaded
3. `console clear` to reset the inbox
4. `components --component <Name>` to find the relevant component
5. `hooks <Name>` to inspect its state
6. Perform the interaction (`click` / `type`) that triggers the bug — or use `set-state` to force a specific state value for hypothesis testing
7. Re-inspect `hooks` and `console errors` to observe what changed

## Command Reference

See [references/commands.md](references/commands.md) for complete documentation of all commands, flags, output formats, and examples.

## Workflow Reference

See [references/workflows.md](references/workflows.md) for end-to-end debugging scenarios including diagnosing missing data, tracking state update bugs, and debugging rendering issues.
