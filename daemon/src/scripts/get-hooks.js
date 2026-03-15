// Hook extraction script — extracts all hooks for a specific React component.
// Evaluated in page context via Playwright's page.evaluate().
// Returns { component, type, hookCount, hooks: [...] } or { error: string }.

(function (options) {
  var componentName = options && options.component;
  var maxSerializeDepth = (options && options.depth) || 3;

  if (!componentName) {
    return { error: 'No component name provided' };
  }

  var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) {
    return { error: 'No React DevTools hook found' };
  }

  if (!hook._fiberRoots || hook._fiberRoots.size === 0) {
    return { error: 'No React roots detected — page may not use React or has not rendered yet' };
  }

  // Fiber tag constants (React internals)
  var FunctionComponent = 0;
  var ClassComponent = 1;
  var ForwardRef = 11;
  var MemoComponent = 14;
  var SimpleMemoComponent = 15;

  // --- Safe serialization helper ---
  function safeSerialize(value, currentDepth, maxDepth, seen) {
    if (currentDepth > maxDepth) {
      return '[Truncated]';
    }
    if (value === null) return null;
    if (value === undefined) return '[undefined]';

    var type = typeof value;

    if (type === 'string') {
      if (value.length > 200) {
        return value.slice(0, 200) + '...';
      }
      return value;
    }
    if (type === 'number' || type === 'boolean') return value;
    if (type === 'function') return '[Function]';
    if (type === 'symbol') return '[Symbol: ' + String(value) + ']';
    if (type === 'bigint') return value.toString() + 'n';

    // Check for DOM elements
    if (value instanceof Element) {
      return '[Element: ' + value.tagName.toLowerCase() + ']';
    }
    if (value instanceof Node) {
      return '[Node: ' + value.nodeName + ']';
    }

    // Check for React elements ($$typeof is a Symbol for React elements)
    if (value && value.$$typeof) {
      var elemType = value.type;
      var elemName = 'unknown';
      if (typeof elemType === 'string') {
        elemName = elemType;
      } else if (typeof elemType === 'function') {
        elemName = elemType.displayName || elemType.name || 'Component';
      } else if (elemType && typeof elemType === 'object') {
        elemName = elemType.displayName || elemType.name || 'Component';
      }
      return '[ReactElement: ' + elemName + ']';
    }

    // Circular reference detection
    if (!seen) seen = [];
    for (var s = 0; s < seen.length; s++) {
      if (seen[s] === value) return '[Circular]';
    }
    seen = seen.concat([value]);

    // Arrays
    if (Array.isArray(value)) {
      if (value.length === 0) return [];
      if (currentDepth === maxDepth) {
        return '[Array(' + value.length + ')]';
      }
      var arr = [];
      for (var i = 0; i < value.length; i++) {
        arr.push(safeSerialize(value[i], currentDepth + 1, maxDepth, seen));
      }
      return arr;
    }

    // Plain objects
    if (type === 'object') {
      var keys = Object.keys(value);
      if (keys.length === 0) return {};
      if (currentDepth === maxDepth) {
        return '[Object(' + keys.length + ' keys)]';
      }
      var obj = {};
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        try {
          obj[key] = safeSerialize(value[key], currentDepth + 1, maxDepth, seen);
        } catch (e) {
          obj[key] = '[Error: ' + (e && e.message ? e.message : 'unknown') + ']';
        }
      }
      return obj;
    }

    return String(value);
  }

  // --- Component name extraction ---
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

  // --- Component type classification ---
  function getComponentType(fiber) {
    if (fiber.tag === ClassComponent) return 'class';
    if (fiber.tag === ForwardRef) return 'forward-ref';
    if (fiber.tag === MemoComponent || fiber.tag === SimpleMemoComponent) return 'memo';
    return 'function';
  }

  // --- Check if fiber is a function/class component ---
  function isComponent(fiber) {
    return (
      fiber.tag === FunctionComponent ||
      fiber.tag === ClassComponent ||
      fiber.tag === ForwardRef ||
      fiber.tag === MemoComponent ||
      fiber.tag === SimpleMemoComponent
    );
  }

  // --- Find component by name (case-insensitive substring match) ---
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
      // Recurse into children
      if (current.child) {
        var found = findComponent(current.child);
        if (found) return found;
      }
      current = current.sibling;
    }
    return null;
  }

  // --- Identify hook type from _debugHookTypes or structural heuristics ---
  function classifyHook(hookNode, index, debugHookTypes) {
    // Use _debugHookTypes if available (React 18.3+)
    if (debugHookTypes && index < debugHookTypes.length) {
      var debugType = debugHookTypes[index];
      // Map React's debug hook type names to our types
      if (debugType === 'useState') return 'state';
      if (debugType === 'useReducer') return 'reducer';
      if (debugType === 'useEffect') return 'effect';
      if (debugType === 'useLayoutEffect') return 'layout-effect';
      if (debugType === 'useInsertionEffect') return 'insertion-effect';
      if (debugType === 'useRef') return 'ref';
      if (debugType === 'useMemo') return 'memo';
      if (debugType === 'useCallback') return 'callback';
      if (debugType === 'useContext') return 'context';
      if (debugType === 'useDebugValue') return 'debug-value';
      if (debugType === 'useTransition') return 'transition';
      if (debugType === 'useDeferredValue') return 'deferred-value';
      if (debugType === 'useId') return 'id';
      if (debugType === 'useSyncExternalStore') return 'sync-external-store';
      // Fallback for unknown debug types
      return debugType.replace(/^use/, '').toLowerCase() || 'unknown';
    }

    // Structural heuristics fallback
    var ms = hookNode.memoizedState;

    // useState/useReducer: has a queue
    if (hookNode.queue !== null && hookNode.queue !== undefined) {
      // Distinguish useState from useReducer
      if (
        hookNode.queue.lastRenderedReducer &&
        hookNode.queue.lastRenderedReducer.name &&
        hookNode.queue.lastRenderedReducer.name !== 'basicStateReducer'
      ) {
        return 'reducer';
      }
      return 'state';
    }

    // useEffect/useLayoutEffect: memoizedState has create function and tag
    if (ms && typeof ms === 'object' && typeof ms.create === 'function' && 'tag' in ms) {
      if (ms.tag & 2) return 'insertion-effect';
      if (ms.tag & 4) return 'layout-effect';
      if (ms.tag & 8) return 'effect';
      return 'effect'; // fallback for unknown effect tag
    }

    // useRef: object with exactly {current}, no queue
    if (
      ms && typeof ms === 'object' && !Array.isArray(ms) &&
      hookNode.queue === null
    ) {
      var msKeys = Object.keys(ms);
      if (msKeys.length === 1 && msKeys[0] === 'current') {
        return 'ref';
      }
    }

    // useMemo/useCallback: 2-element array [value, deps], no queue
    if (Array.isArray(ms) && ms.length === 2 && hookNode.queue === null) {
      if (typeof ms[0] === 'function') return 'callback';
      return 'memo';
    }

    // useContext: no queue, not an effect, not a ref, not memo/callback
    if (hookNode.queue === null && ms !== null && ms !== undefined) {
      // Skip undefined context values
      if (ms !== undefined) {
        return 'context';
      }
    }

    return 'unknown';
  }

  // --- Extract hook data based on type ---
  function extractHookData(hookNode, hookType) {
    var ms = hookNode.memoizedState;
    var result = { type: hookType };

    switch (hookType) {
      case 'state':
      case 'reducer':
        result.value = safeSerialize(ms, 0, maxSerializeDepth, null);
        break;

      case 'effect':
      case 'layout-effect':
      case 'insertion-effect':
        if (ms && typeof ms === 'object') {
          result.deps = ms.deps ? safeSerialize(ms.deps, 0, maxSerializeDepth, null) : null;
          result.hasCleanup = !!ms.destroy;
          var subtype = 'passive';
          if (hookType === 'layout-effect') subtype = 'layout';
          else if (hookType === 'insertion-effect') subtype = 'insertion';
          result.subtype = subtype;
        }
        break;

      case 'ref':
        if (ms && typeof ms === 'object' && 'current' in ms) {
          result.current = safeSerialize(ms.current, 0, maxSerializeDepth, null);
        } else {
          result.current = safeSerialize(ms, 0, maxSerializeDepth, null);
        }
        break;

      case 'memo':
        if (Array.isArray(ms) && ms.length === 2) {
          result.value = safeSerialize(ms[0], 0, maxSerializeDepth, null);
          result.deps = safeSerialize(ms[1], 0, maxSerializeDepth, null);
        } else {
          result.value = safeSerialize(ms, 0, maxSerializeDepth, null);
        }
        break;

      case 'callback':
        if (Array.isArray(ms) && ms.length === 2) {
          result.deps = safeSerialize(ms[1], 0, maxSerializeDepth, null);
        }
        break;

      case 'context':
        result.value = safeSerialize(ms, 0, maxSerializeDepth, null);
        break;

      default:
        result.value = safeSerialize(ms, 0, maxSerializeDepth, null);
        break;
    }

    return result;
  }

  // --- Main: find component and extract hooks ---
  var targetFiber = null;

  hook._fiberRoots.forEach(function (fiberRootSet) {
    if (targetFiber) return;
    fiberRootSet.forEach(function (fiberRoot) {
      if (targetFiber) return;
      if (fiberRoot.current) {
        targetFiber = findComponent(fiberRoot.current);
      }
    });
  });

  if (!targetFiber) {
    return { error: 'Component not found: ' + componentName };
  }

  var resolvedName = getComponentName(targetFiber) || 'Anonymous';
  var resolvedType = getComponentType(targetFiber);

  // Get _debugHookTypes if available
  var debugHookTypes = targetFiber._debugHookTypes || null;

  // Walk the hook linked list
  var hooks = [];
  var hookNode = targetFiber.memoizedState;
  var hookIndex = 0;
  var maxHooks = 50;

  // Class components don't have hook linked lists
  if (targetFiber.tag === ClassComponent) {
    return {
      component: resolvedName,
      type: resolvedType,
      hookCount: 0,
      hooks: [],
      classState: safeSerialize(targetFiber.memoizedState, 0, maxSerializeDepth, null),
    };
  }

  while (hookNode && hookIndex < maxHooks) {
    var hookType = classifyHook(hookNode, hookIndex, debugHookTypes);
    var hookData = extractHookData(hookNode, hookType);
    hookData.index = hookIndex;
    hooks.push(hookData);

    hookNode = hookNode.next;
    hookIndex++;
  }

  return {
    component: resolvedName,
    type: resolvedType,
    hookCount: hooks.length,
    hooks: hooks,
  };
})
