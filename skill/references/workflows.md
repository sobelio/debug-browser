# Debugging Workflows

Command recipes for common React debugging scenarios. Each workflow shows the exact command sequence and what to look for in the output.

## Workflow 1: Component Not Rendering the Right Data

Diagnose stale state, wrong props, or missing updates.

```bash
# 1. Open the app
debug-browser navigate http://localhost:3000

# 2. Confirm React is loaded
debug-browser react detect

# 3. Find the component
debug-browser components --component UserProfile --depth 4

# 4. Check its props — is the parent passing correct data?
#    Look at the props: line for stale or missing values

# 5. Inspect hook state
debug-browser hooks UserProfile
#    Check useState values — is local state out of sync with props?
#    Check useEffect deps — is the effect re-running when it should?
#    Check useContext — is the context provider value correct?

# 6. Trigger the action that should update the component
debug-browser click "[data-testid='refresh-btn']"

# 7. Re-inspect hooks to see if state actually changed
debug-browser hooks UserProfile
#    Compare useState values before/after
#    If unchanged: the event handler isn't updating state
#    If changed but UI wrong: check for stale closure or missing dep

# 8. Jump to the source file to fix the issue
debug-browser source UserProfile
#    UserProfile -> src/components/UserProfile.tsx:12
#    Now open that file:line to edit the component
```

## Workflow 2: Console Errors on Page Load

Track down runtime errors and unhandled exceptions.

```bash
# 1. Clear any stale messages, then navigate
debug-browser console clear
debug-browser navigate http://localhost:3000/dashboard

# 2. Check for errors immediately after load
debug-browser console errors
#    Look for: TypeError, ReferenceError, failed fetch, missing props

# 3. If error references a component, inspect it
debug-browser components --component ErrorBoundary
debug-browser hooks ErrorBoundary
#    Check if error boundary caught something (hasError state)

# 4. Check console logs for debugging output
debug-browser console logs

# 5. Evaluate specific values to narrow down the issue
debug-browser eval "document.querySelectorAll('.error-message').length"

# 6. Clear and reproduce to confirm the error is consistent
debug-browser console clear
debug-browser navigate http://localhost:3000/dashboard
debug-browser console errors
```

## Workflow 3: Component Re-renders Too Often

Identify missing memoization or unstable references causing excess renders.

```bash
# 1. Navigate and find the component
debug-browser navigate http://localhost:3000
debug-browser components --component DataGrid

# 2. Inspect all hooks
debug-browser hooks DataGrid
#    Look for:
#    - useEffect with deps=null (runs every render)
#    - useMemo/useCallback with large dep arrays
#    - useContext consuming a frequently-changing context

# 3. Check the parent component's hooks too
debug-browser hooks Dashboard
#    Look for useState values that change on every render
#    Look for objects/arrays created inline (new ref every render)

# 4. Interact and re-inspect to see what changes
debug-browser click "button.filter"
debug-browser hooks DataGrid
#    Compare hook values — which ones changed?
#    If useCallback deps changed: parent is recreating the callback
#    If useMemo deps changed: an upstream value is unstable
```

## Workflow 4: Debug a Form Submission Flow

Trace state through user input and submission.

```bash
# 1. Navigate to the form
debug-browser navigate http://localhost:3000/settings

# 2. Inspect the form component's initial state
debug-browser hooks SettingsForm
#    Note initial useState values for form fields

# 3. Type into fields and observe state changes
debug-browser type "input[name='email']" "new@example.com"
debug-browser hooks SettingsForm
#    Verify the email state updated

debug-browser type "input[name='name']" "New Name"
debug-browser hooks SettingsForm
#    Verify the name state updated

# 4. Clear console, then submit
debug-browser console clear
debug-browser click "button[type='submit']"

# 5. Check for errors after submission
debug-browser console errors
#    Look for: failed API calls, validation errors

# 6. Re-inspect state after submission
debug-browser hooks SettingsForm
#    Check if isSubmitting/isLoading state flipped back
#    Check if error state was set
#    Check if form values were reset or preserved

# 7. Check for success indicators
debug-browser eval "document.querySelector('.success-toast')?.textContent"
```

## Workflow 5: Hypothesis Testing with set-state

Test edge cases and reproduce bugs by forcing specific state values.

```bash
# 1. Navigate and inspect the component
debug-browser navigate http://localhost:3000
debug-browser hooks CartSummary
#    [0] useState: [{"id":1,"qty":2},{"id":2,"qty":1}]
#    [1] useState: false          # isLoading
#    [2] useEffect: deps=[2] cleanup=no

# 2. Hypothesis: "What happens with an empty cart?"
debug-browser set-state CartSummary 0 '[]'
debug-browser console errors
#    Check if empty state causes a crash or shows a fallback UI

# 3. Hypothesis: "What if qty is negative?"
debug-browser set-state CartSummary 0 '[{"id":1,"qty":-1}]'
debug-browser hooks CartSummary
debug-browser console errors
#    Check if negative quantity breaks total calculation

# 4. Hypothesis: "What if loading gets stuck?"
debug-browser set-state CartSummary 1 true
debug-browser components --component CartSummary
#    Check if the loading spinner renders correctly

# 5. Reset to a known good state and verify recovery
debug-browser set-state CartSummary 1 false
debug-browser set-state CartSummary 0 '[{"id":1,"qty":2}]'
debug-browser hooks CartSummary
```

## Workflow 6: Attach to an Existing Dev Server

Debug a running Chrome instance instead of launching headless.

```bash
# Prerequisites: Launch Chrome with remote debugging enabled
#   google-chrome --remote-debugging-port=9222
# Or use an existing Electron app's debugging port

# 1. Connect and navigate
debug-browser --connect 9222 navigate http://localhost:3000

# 2. All commands now operate on the connected browser
debug-browser --connect 9222 react detect
debug-browser --connect 9222 components --depth 3
debug-browser --connect 9222 hooks App

# 3. Inspect console output from the running session
debug-browser --connect 9222 console errors

# 4. Interact and inspect
debug-browser --connect 9222 click "#menu-toggle"
debug-browser --connect 9222 components --component Sidebar

# 5. Close when done (disconnects, does not close the browser)
debug-browser --connect 9222 close
```
