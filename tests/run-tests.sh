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
  assert_contains "$output" "true" "react detect shows detected true"

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

test_close() {
  echo "=== Test: close ==="
  local output
  output=$("$CLI" close 2>&1) || true
  assert_contains "$output" "closed" "close returns closed status"

  # Re-navigate for any subsequent test plans
  "$CLI" navigate "$FIXTURE_URL" > /dev/null 2>&1 || true
  sleep 1
}

# --- Run tests ---

echo "=== Running E2E Tests ==="
echo ""

test_navigate
test_react_detect
test_components
test_hooks
test_close
