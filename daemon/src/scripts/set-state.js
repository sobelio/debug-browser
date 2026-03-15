// Set React hook state for a component by hook index.
// Uses the renderer's overrideHookState API (same mechanism as React DevTools).
// Evaluated in page context via Playwright's page.evaluate().

(function (options) {
  var componentName = options && options.component;
  var hookIndex = options && options.hookIndex;
  var newValue = options && options.value;

  if (!componentName) {
    return { error: 'No component name provided' };
  }
  if (typeof hookIndex !== 'number' || hookIndex < 0) {
    return { error: 'Invalid hook index: must be a non-negative integer' };
  }

  var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) {
    return { error: 'No React DevTools hook found' };
  }

  if (!hook._fiberRoots || hook._fiberRoots.size === 0) {
    return { error: 'No React roots detected — page may not use React or has not rendered yet' };
  }

  // Fiber tag constants
  var FunctionComponent = 0;
  var ClassComponent = 1;
  var ForwardRef = 11;
  var MemoComponent = 14;
  var SimpleMemoComponent = 15;

  function getComponentName(fiber) {
    if (!fiber.type) return null;
    if (typeof fiber.type === 'string') return fiber.type;
    if (fiber.type.displayName) return fiber.type.displayName;
    if (fiber.type.name) return fiber.type.name;
    if (fiber.type.render) {
      return fiber.type.render.displayName || fiber.type.render.name || 'ForwardRef';
    }
    if (fiber.type.type) {
      return fiber.type.type.displayName || fiber.type.type.name || 'Memo';
    }
    return 'Anonymous';
  }

  function isComponent(fiber) {
    return (
      fiber.tag === FunctionComponent ||
      fiber.tag === ClassComponent ||
      fiber.tag === ForwardRef ||
      fiber.tag === MemoComponent ||
      fiber.tag === SimpleMemoComponent
    );
  }

  function findComponent(fiber) {
    if (!fiber) return null;
    var current = fiber;
    while (current) {
      if (isComponent(current)) {
        var name = getComponentName(current);
        if (name && name.toLowerCase().indexOf(componentName.toLowerCase()) !== -1) {
          return current;
        }
      }
      if (current.child) {
        var found = findComponent(current.child);
        if (found) return found;
      }
      current = current.sibling;
    }
    return null;
  }

  // Find the target fiber and which renderer owns it
  var targetFiber = null;
  var targetRendererID = null;

  hook._fiberRoots.forEach(function (fiberRootSet, rendererID) {
    if (targetFiber) return;
    fiberRootSet.forEach(function (fiberRoot) {
      if (targetFiber) return;
      if (fiberRoot.current) {
        var found = findComponent(fiberRoot.current);
        if (found) {
          targetFiber = found;
          targetRendererID = rendererID;
        }
      }
    });
  });

  if (!targetFiber) {
    return { error: 'Component not found: ' + componentName };
  }

  if (targetFiber.tag === ClassComponent) {
    return { error: 'set-state is not supported for class components — use evaluate instead' };
  }

  // Validate the hook index exists and is a state/reducer hook
  var hookNode = targetFiber.memoizedState;
  var currentIndex = 0;
  while (hookNode && currentIndex < hookIndex) {
    hookNode = hookNode.next;
    currentIndex++;
  }

  if (!hookNode) {
    return { error: 'Hook index ' + hookIndex + ' out of range (component has ' + currentIndex + ' hooks)' };
  }

  // Check that this is a state or reducer hook (has a queue)
  if (hookNode.queue === null || hookNode.queue === undefined) {
    return { error: 'Hook at index ' + hookIndex + ' is not a useState/useReducer hook — only state hooks can be set' };
  }

  // Try renderer.overrideHookState first (React 16.8+)
  var renderer = hook.renderers.get(targetRendererID);
  if (renderer && typeof renderer.overrideHookState === 'function') {
    try {
      // path=[] means replace the entire value
      renderer.overrideHookState(targetFiber, '' + hookIndex, [], newValue);
      return {
        component: getComponentName(targetFiber),
        hookIndex: hookIndex,
        success: true,
        method: 'overrideHookState',
      };
    } catch (e) {
      return { error: 'overrideHookState failed: ' + (e && e.message ? e.message : String(e)) };
    }
  }

  // Fallback: directly mutate and trigger update via setState dispatcher
  // This works when the renderer doesn't expose overrideHookState (e.g., production builds)
  try {
    var queue = hookNode.queue;
    if (queue && typeof queue.dispatch === 'function') {
      queue.dispatch(newValue);
      return {
        component: getComponentName(targetFiber),
        hookIndex: hookIndex,
        success: true,
        method: 'dispatch',
      };
    }

    return { error: 'No dispatch function found on hook queue — state update not possible' };
  } catch (e) {
    return { error: 'State update failed: ' + (e && e.message ? e.message : String(e)) };
  }
})
