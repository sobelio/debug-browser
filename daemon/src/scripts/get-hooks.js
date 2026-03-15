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

  // --- Known React hook names (for identifying custom hooks in _debugHookTypes) ---
  var KNOWN_HOOK_NAMES = {
    'useState': true, 'useReducer': true, 'useEffect': true,
    'useLayoutEffect': true, 'useInsertionEffect': true, 'useRef': true,
    'useMemo': true, 'useCallback': true, 'useContext': true,
    'useDebugValue': true, 'useTransition': true, 'useDeferredValue': true,
    'useId': true, 'useSyncExternalStore': true, 'useImperativeHandle': true
  };

  // --- Map _debugHookTypes names to our internal type strings ---
  var DEBUG_TYPE_MAP = {
    'useState': 'state',
    'useReducer': 'reducer',
    'useEffect': 'effect',
    'useLayoutEffect': 'layout-effect',
    'useInsertionEffect': 'insertion-effect',
    'useRef': 'ref',
    'useMemo': 'memo',
    'useCallback': 'callback',
    'useContext': 'context',
    'useDebugValue': 'debug-value',
    'useTransition': 'transition',
    'useDeferredValue': 'deferred-value',
    'useId': 'id',
    'useSyncExternalStore': 'sync-external-store',
    'useImperativeHandle': 'imperative-handle'
  };

  // --- Identify hook type from _debugHookTypes or structural heuristics ---
  function classifyHook(hookNode, index, debugHookTypes) {
    // Use _debugHookTypes if available (React 18.3+)
    if (debugHookTypes && index < debugHookTypes.length) {
      var debugType = debugHookTypes[index];
      if (DEBUG_TYPE_MAP[debugType]) return DEBUG_TYPE_MAP[debugType];
      // Unknown hook name — likely a custom hook boundary marker
      // Return the raw name so it can be used as a label
      return debugType.replace(/^use/, '').toLowerCase() || 'unknown';
    }

    // Structural heuristics fallback
    var ms = hookNode.memoizedState;

    // useId: memoizedState is a string matching the :rN: pattern
    if (typeof ms === 'string' && /^:r[0-9a-z]+:$/.test(ms)) {
      return 'id';
    }

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

      case 'id':
        result.value = safeSerialize(ms, 0, maxSerializeDepth, null);
        break;

      case 'transition':
        // useTransition stores [isPending, startTransition]
        if (typeof ms === 'boolean') {
          result.value = ms; // isPending
        } else {
          result.value = safeSerialize(ms, 0, maxSerializeDepth, null);
        }
        break;

      case 'deferred-value':
        result.value = safeSerialize(ms, 0, maxSerializeDepth, null);
        break;

      case 'sync-external-store':
        result.value = safeSerialize(ms, 0, maxSerializeDepth, null);
        break;

      case 'imperative-handle':
        result.value = safeSerialize(ms, 0, maxSerializeDepth, null);
        break;

      case 'debug-value':
        // useDebugValue: the memoizedState is the debug label value itself
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

  // Extract source location if available
  var resolvedSource = null;
  if (targetFiber._debugSource && targetFiber._debugSource.fileName) {
    resolvedSource = { fileName: targetFiber._debugSource.fileName };
    if (typeof targetFiber._debugSource.lineNumber === 'number') {
      resolvedSource.lineNumber = targetFiber._debugSource.lineNumber;
    }
    if (typeof targetFiber._debugSource.columnNumber === 'number') {
      resolvedSource.columnNumber = targetFiber._debugSource.columnNumber;
    }
  }

  // Get _debugHookTypes if available
  var debugHookTypes = targetFiber._debugHookTypes || null;

  // Walk the hook linked list
  var hooks = [];
  var hookNode = targetFiber.memoizedState;
  var hookIndex = 0;
  var maxHooks = 50;

  // Class components don't have hook linked lists
  if (targetFiber.tag === ClassComponent) {
    var classResult = {
      component: resolvedName,
      type: resolvedType,
      hookCount: 0,
      hooks: [],
      classState: safeSerialize(targetFiber.memoizedState, 0, maxSerializeDepth, null),
    };
    if (resolvedSource) classResult.source = resolvedSource;
    return classResult;
  }

  while (hookNode && hookIndex < maxHooks) {
    var hookType = classifyHook(hookNode, hookIndex, debugHookTypes);
    var hookData = extractHookData(hookNode, hookType);
    hookData.index = hookIndex;

    // useDebugValue handling: attach debugLabel to the preceding hook
    // useDebugValue is a label-only hook — its memoizedState is the label value
    if (hookType === 'debug-value' && hooks.length > 0) {
      var prevHook = hooks[hooks.length - 1];
      prevHook.debugLabel = safeSerialize(hookNode.memoizedState, 0, maxSerializeDepth, null);
      // Still record the debug-value hook but mark it as consumed
      hookData.consumed = true;
    }

    // Custom hook grouping via _debugHookTypes
    // If debugHookTypes has a name that isn't a known React hook, it indicates
    // a custom hook boundary. Tag the hook entry with the custom hook name.
    if (debugHookTypes && hookIndex < debugHookTypes.length) {
      var rawName = debugHookTypes[hookIndex];
      if (!KNOWN_HOOK_NAMES[rawName] && hookType !== 'debug-value') {
        hookData.customHook = rawName;
      }
    }

    hooks.push(hookData);

    hookNode = hookNode.next;
    hookIndex++;
  }

  // Post-process: filter out consumed debug-value hooks and adjust indices
  var filteredHooks = [];
  for (var h = 0; h < hooks.length; h++) {
    if (hooks[h].type === 'debug-value' && hooks[h].consumed) {
      continue; // Skip consumed useDebugValue entries
    }
    filteredHooks.push(hooks[h]);
  }

  var result = {
    component: resolvedName,
    type: resolvedType,
    hookCount: filteredHooks.length,
    hooks: filteredHooks,
  };
  if (resolvedSource) result.source = resolvedSource;
  return result;
})
