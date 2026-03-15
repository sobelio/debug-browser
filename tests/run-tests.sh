#!/usr/bin/env bash
set -euo pipefail

# E2E test harness for debug-browser CLI
# Runs core command tests against a real React fixture app

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CLI="$PROJECT_DIR/target/release/debug-browser"
FIXTURE_DIR="$SCRIPT_DIR/fixture"
FIXTURE_URL="http://localhost:5188"
FIXTURE_PID=""

# Test counters
TESTS=0
PASSED=0
FAILED=0

# --- Assertion helpers ---

assert_contains() {
  local output="$1" expected="$2" test_name="$3"
  TESTS=$((TESTS + 1))
  if echo "$output" | grep -qF "$expected"; then
    PASSED=$((PASSED + 1))
    echo "  PASS $test_name"
  else
    FAILED=$((FAILED + 1))
    echo "  FAIL $test_name"
    echo "    Expected to contain: $expected"
    echo "    Got: $(echo "$output" | head -5)"
  fi
}

assert_not_contains() {
  local output="$1" unexpected="$2" test_name="$3"
  TESTS=$((TESTS + 1))
  if echo "$output" | grep -qF "$unexpected"; then
    FAILED=$((FAILED + 1))
    echo "  FAIL $test_name"
    echo "    Expected NOT to contain: $unexpected"
    echo "    Got: $(echo "$output" | head -5)"
  else
    PASSED=$((PASSED + 1))
    echo "  PASS $test_name"
  fi
}

assert_json_field() {
  local output="$1" field="$2" expected="$3" test_name="$4"
  TESTS=$((TESTS + 1))
  # Extract field value using grep (no jq dependency)
  if echo "$output" | grep -q "\"$field\"" && echo "$output" | grep -q "$expected"; then
    PASSED=$((PASSED + 1))
    echo "  PASS $test_name"
  else
    FAILED=$((FAILED + 1))
    echo "  FAIL $test_name"
    echo "    Expected field \"$field\" to contain: $expected"
    echo "    Got: $(echo "$output" | head -5)"
  fi
}

# --- Teardown ---

cleanup() {
  echo ""
  echo "=== Teardown ==="

  # Close daemon
  if [ -f "$CLI" ]; then
    "$CLI" close > /dev/null 2>&1 || true
  fi

  # Kill fixture server and all children
  if [ -n "$FIXTURE_PID" ] && kill -0 "$FIXTURE_PID" 2>/dev/null; then
    kill "$FIXTURE_PID" 2>/dev/null || true
    wait "$FIXTURE_PID" 2>/dev/null || true
    echo "Fixture server stopped (PID $FIXTURE_PID)"
  fi

  # Also kill anything on port 5188 to be safe
  lsof -ti:5188 2>/dev/null | xargs kill 2>/dev/null || true

  # Print summary
  echo ""
  echo "=== Results ==="
  echo "$PASSED/$TESTS tests passed"
  if [ "$FAILED" -gt 0 ]; then
    echo "$FAILED test(s) FAILED"
    exit 1
  fi
}

trap cleanup EXIT INT TERM

# --- Setup ---

echo "=== Setup ==="

# Kill anything on port 5188 from previous runs
lsof -ti:5188 2>/dev/null | xargs kill 2>/dev/null || true
sleep 1

# Build CLI if needed (skip if binary is newer than source)
if [ ! -f "$CLI" ] || [ "$(find "$PROJECT_DIR/src" -name '*.rs' -newer "$CLI" 2>/dev/null | head -1)" ]; then
  echo "Building CLI..."
  (cd "$PROJECT_DIR" && cargo build --release)
else
  echo "CLI binary is up to date"
fi

# Build daemon if needed
DAEMON_DIR="$PROJECT_DIR/daemon"
if [ ! -d "$DAEMON_DIR/node_modules" ]; then
  echo "Installing daemon dependencies..."
  (cd "$DAEMON_DIR" && npm install)
fi
if [ ! -f "$DAEMON_DIR/dist/daemon.js" ] || [ "$(find "$DAEMON_DIR/src" -newer "$DAEMON_DIR/dist/daemon.js" 2>/dev/null | head -1)" ]; then
  echo "Building daemon..."
  (cd "$DAEMON_DIR" && npm run build)
else
  echo "Daemon is up to date"
fi

# Install fixture dependencies if needed
if [ ! -d "$FIXTURE_DIR/node_modules" ]; then
  echo "Installing fixture dependencies..."
  (cd "$FIXTURE_DIR" && npm install)
else
  echo "Fixture dependencies already installed"
fi

# Start fixture dev server in background (dev mode preserves component names)
echo "Starting fixture dev server..."
(cd "$FIXTURE_DIR" && npm run dev 2>&1) &
FIXTURE_PID=$!

# Wait for server to be ready (max 15s)
echo "Waiting for fixture server at $FIXTURE_URL..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w "%{http_code}" "$FIXTURE_URL" 2>/dev/null | grep -q "200"; then
    echo "Fixture server ready"
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "ERROR: Fixture server did not start within 15 seconds"
    exit 1
  fi
  sleep 0.5
done

echo ""

# --- Test functions ---

test_navigate() {
  echo "=== Test: navigate ==="
  local output
  output=$("$CLI" navigate "$FIXTURE_URL" 2>&1) || true
  assert_contains "$output" "Debug Browser Test Fixture" "navigate returns page title"
  assert_contains "$output" "localhost:5188" "navigate returns URL"

  # Give page a moment to fully load React
  sleep 2
}

test_react_detect() {
  echo "=== Test: react detect ==="
  local output json
  output=$("$CLI" react detect 2>&1) || true
  assert_contains "$output" "detected" "react detect has detected field"
  assert_contains "$output" "React" "react detect shows React version"

  json=$("$CLI" --format json react detect 2>&1) || true
  assert_contains "$json" '"detected"' "react detect JSON has detected field"
  assert_contains "$json" '"success": true' "react detect JSON success"
}

test_components() {
  echo "=== Test: components ==="

  # Full tree
  local output
  output=$("$CLI" components --depth 3 2>&1) || true
  assert_contains "$output" "App" "components shows App"
  assert_contains "$output" "Counter" "components shows Counter"
  assert_contains "$output" "TodoList" "components shows TodoList"
  assert_contains "$output" "TodoItem" "components shows TodoItem"
  assert_contains "$output" "ConsoleDemo" "components shows ConsoleDemo"
  assert_contains "$output" "component(s) total" "components shows total count"

  # Filtered by component name
  echo "--- Test: components --component filter ---"
  output=$("$CLI" components --component TodoList 2>&1) || true
  assert_contains "$output" "TodoList" "filtered components shows TodoList"

  # Filter for TodoItem specifically to verify it exists
  output=$("$CLI" components --component TodoItem 2>&1) || true
  assert_contains "$output" "TodoItem" "filtered components shows TodoItem"

  # Structural view (no props, no state)
  echo "--- Test: components --no-props --no-state ---"
  output=$("$CLI" components --no-props --no-state --depth 2 2>&1) || true
  assert_contains "$output" "App" "structural view shows App"
  assert_not_contains "$output" "props:" "structural view hides props"
  assert_not_contains "$output" "state:" "structural view hides state"
}

test_hooks() {
  echo "=== Test: hooks ==="

  # Counter hooks
  local output
  output=$("$CLI" hooks Counter 2>&1) || true
  assert_contains "$output" "useState" "Counter hooks shows useState"
  assert_contains "$output" "0" "Counter useState initial value is 0"

  # TodoList hooks
  output=$("$CLI" hooks TodoList 2>&1) || true
  assert_contains "$output" "useState" "TodoList hooks shows useState"
  assert_contains "$output" "Buy milk" "TodoList state contains Buy milk"

  # Hooks JSON format
  echo "--- Test: hooks JSON format ---"
  local json
  json=$("$CLI" --format json hooks Counter 2>&1) || true
  assert_contains "$json" '"success": true' "hooks JSON success"
  assert_contains "$json" '"hookCount"' "hooks JSON has hookCount"
}

test_click() {
  echo "=== Test: click ==="

  # Get initial Counter state
  local output
  output=$("$CLI" hooks Counter 2>&1) || true
  assert_contains "$output" "0" "Counter starts at 0"

  # Click increment button
  local click_output
  click_output=$("$CLI" click "#increment" 2>&1) || true
  assert_contains "$click_output" "Done" "click returns confirmation"

  # Verify state changed
  sleep 0.5  # brief wait for React re-render
  output=$("$CLI" hooks Counter 2>&1) || true
  assert_contains "$output" "1" "Counter incremented to 1 after click"
}

test_type() {
  echo "=== Test: type ==="

  local type_output
  type_output=$("$CLI" type "#todo-input" "New todo item" 2>&1) || true
  assert_contains "$type_output" "Done" "type returns confirmation"
}

test_eval() {
  echo "=== Test: eval ==="

  # Eval page title
  local output
  output=$("$CLI" eval "document.title" 2>&1) || true
  assert_contains "$output" "Debug Browser" "eval returns page title"

  # Eval with numeric result
  output=$("$CLI" eval "1 + 1" 2>&1) || true
  assert_contains "$output" "2" "eval returns computed value"

  # Eval checking DOM
  output=$("$CLI" eval "document.querySelector('h1').textContent" 2>&1) || true
  assert_contains "$output" "Debug Browser Test Fixture" "eval reads h1 text"

  # Eval JSON format
  echo "--- Test: eval JSON format ---"
  local json
  json=$("$CLI" --format json eval "document.title" 2>&1) || true
  assert_contains "$json" '"success"' "eval JSON has success field"
  assert_contains "$json" "true" "eval JSON success is true"
}

test_console() {
  echo "=== Test: console ==="

  # Trigger fresh console messages by re-navigating
  "$CLI" console clear > /dev/null 2>&1 || true
  "$CLI" navigate "$FIXTURE_URL" > /dev/null 2>&1 || true
  sleep 2  # wait for React mount + console messages

  # Console logs captures both log and error messages from ConsoleDemo
  local output
  output=$("$CLI" console logs 2>&1) || true
  assert_contains "$output" "Hello from ConsoleDemo" "console logs captures log from ConsoleDemo"
  assert_contains "$output" "Test error message" "console logs captures console.error from ConsoleDemo"

  # Console errors returns page-level errors (uncaught exceptions)
  output=$("$CLI" console errors 2>&1) || true
  assert_contains "$output" "errors" "console errors returns errors field"

  # Console clear
  "$CLI" console clear > /dev/null 2>&1 || true
  output=$("$CLI" console logs 2>&1) || true
  assert_not_contains "$output" "Hello from ConsoleDemo" "console clear removes log messages"

  # Console clear JSON format
  echo "--- Test: console clear JSON format ---"
  local json
  json=$("$CLI" --format json console clear 2>&1) || true
  assert_contains "$json" '"success"' "console clear JSON has success field"
  assert_contains "$json" "true" "console clear JSON success is true"
}

test_json_output() {
  echo "=== Test: JSON output ==="

  # Components JSON format
  local json
  json=$("$CLI" --format json components --depth 2 2>&1) || true
  assert_contains "$json" '"success"' "components JSON has success field"
  assert_contains "$json" '"roots"' "components JSON has roots"
  assert_contains "$json" '"componentCount"' "components JSON has componentCount"
}

test_session() {
  echo "=== Test: session ==="

  # Verify a named session works (starts a new daemon)
  local output
  output=$("$CLI" --session test-session navigate "$FIXTURE_URL" 2>&1) || true
  assert_contains "$output" "Debug Browser Test Fixture" "named session navigate works"

  # Clean up the test session
  "$CLI" --session test-session close > /dev/null 2>&1 || true
}

test_close() {
  echo "=== Test: close ==="
  local output
  output=$("$CLI" close 2>&1) || true
  assert_contains "$output" "closed" "close returns closed status"

  # Re-navigate for any subsequent test plans
  "$CLI" navigate "$FIXTURE_URL" > /dev/null 2>&1 || true
  sleep 1
}

test_cookies() {
  echo "=== Test: cookies ==="

  # Set a cookie
  "$CLI" cookies set test_cookie test_value > /dev/null 2>&1 || true

  # Get cookies, verify it exists
  local output
  output=$("$CLI" cookies get 2>&1) || true
  assert_contains "$output" "test_cookie" "cookies set and get works"

  # Clear cookies
  "$CLI" cookies clear > /dev/null 2>&1 || true
  output=$("$CLI" cookies get 2>&1) || true
  assert_not_contains "$output" "test_cookie" "cookies clear removes cookies"
}

test_storage() {
  echo "=== Test: storage ==="

  # Set localStorage value
  "$CLI" storage local set mykey myvalue > /dev/null 2>&1 || true

  # Get it back
  local output
  output=$("$CLI" storage local get mykey 2>&1) || true
  assert_contains "$output" "myvalue" "storage local set and get works"

  # Get all
  output=$("$CLI" storage local 2>&1) || true
  assert_contains "$output" "mykey" "storage local lists all keys"

  # Clear
  "$CLI" storage local clear > /dev/null 2>&1 || true
  output=$("$CLI" storage local 2>&1) || true
  assert_not_contains "$output" "mykey" "storage local clear works"
}

test_state() {
  echo "=== Test: state save ==="

  # Save state to temp file
  local state_file="/tmp/debug-browser-test-state.json"
  "$CLI" state save "$state_file" > /dev/null 2>&1 || true

  # Verify file exists and is valid JSON
  TESTS=$((TESTS + 1))
  if [ -f "$state_file" ] && python3 -c "import json; json.load(open('$state_file'))" 2>/dev/null; then
    PASSED=$((PASSED + 1))
    echo "  PASS state save creates valid JSON"
  else
    FAILED=$((FAILED + 1))
    echo "  FAIL state save creates valid JSON"
  fi
  rm -f "$state_file"
}

test_compact() {
  echo "=== Test: compact output ==="

  # Components compact — should NOT contain props/state
  local output
  output=$("$CLI" components --compact 2>&1) || true
  assert_contains "$output" "Counter" "compact components shows Counter"
  assert_not_contains "$output" "props:" "compact components hides props"
  assert_not_contains "$output" "state:" "compact components hides state"
  assert_contains "$output" "components" "compact components shows count"

  # Hooks compact — should show types only
  output=$("$CLI" hooks Counter --compact 2>&1) || true
  assert_contains "$output" "useState" "compact hooks shows hook types"
  assert_not_contains "$output" "[0]" "compact hooks hides indices"
  assert_contains "$output" "hooks" "compact hooks shows hook count"
}

# --- Run tests ---

echo "=== Running E2E Tests ==="
echo ""

test_navigate
test_react_detect
test_components
test_hooks
test_click
test_type
test_eval
test_console
test_json_output
test_cookies
test_storage
test_state
test_compact
test_session
test_close
