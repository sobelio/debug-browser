// Fiber tree walker — extracts React component hierarchy from DevTools hook.
// Evaluated in page context via Playwright's page.evaluate().
// Returns { roots: [...], componentCount: number } or { error: string }.

(function (options) {
  var maxDepth = (options && options.depth) || 100;
  var includeHost = !!(options && options.includeHost);
  var includeProps = options && options.includeProps !== undefined ? options.includeProps : true;
  var includeState = options && options.includeState !== undefined ? options.includeState : true;
  var propsDepth = (options && options.propsDepth) || 3;

  var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) {
    return { roots: [], componentCount: 0, error: 'No React DevTools hook found' };
  }

  if (!hook._fiberRoots || hook._fiberRoots.size === 0) {
    return { roots: [], componentCount: 0, error: 'No React roots detected — page may not use React or has not rendered yet' };
  }

  var componentCount = 0;

  // Fiber tag constants (React internals)
  var FunctionComponent = 0;
  var ClassComponent = 1;
  var HostRoot = 3;
  var HostComponent = 5;
  var HostText = 6;
  var Fragment = 7;
  var Mode = 8;
  var ContextConsumer = 9;
  var ContextProvider = 10;
  var ForwardRef = 11;
  var Profiler = 12;
  var SuspenseComponent = 13;
  var MemoComponent = 14;
  var SimpleMemoComponent = 15;
  var LazyComponent = 16;
  var HostPortal = 4;

  // --- Safe serialization helper ---
  function safeSerialize(value, currentDepth, maxSerializeDepth, seen) {
    if (currentDepth > maxSerializeDepth) {
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
      if (currentDepth === maxSerializeDepth) {
        return '[Array(' + value.length + ')]';
      }
      var arr = [];
      for (var i = 0; i < value.length; i++) {
        arr.push(safeSerialize(value[i], currentDepth + 1, maxSerializeDepth, seen));
      }
      return arr;
    }

    // Plain objects
    if (type === 'object') {
      var keys = Object.keys(value);
      if (keys.length === 0) return {};
      if (currentDepth === maxSerializeDepth) {
        return '[Object(' + keys.length + ' keys)]';
      }
      var obj = {};
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k];
        try {
          obj[key] = safeSerialize(value[key], currentDepth + 1, maxSerializeDepth, seen);
        } catch (e) {
          obj[key] = '[Error: ' + (e && e.message ? e.message : 'unknown') + ']';
        }
      }
      return obj;
    }

    return String(value);
  }

  // --- Props extraction ---
  function extractProps(fiber) {
    if (!fiber.memoizedProps) return null;
    var raw = fiber.memoizedProps;
    if (typeof raw !== 'object' || raw === null) return null;

    var keys = Object.keys(raw);
    var result = {};
    var hasKeys = false;

    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      // Filter out children prop — it's structural, not informative
      if (key === 'children') continue;
      try {
        result[key] = safeSerialize(raw[key], 0, propsDepth, null);
      } catch (e) {
        result[key] = '[Error]';
      }
      hasKeys = true;
    }

    return hasKeys ? result : null;
  }

  // --- State extraction ---
  function extractState(fiber) {
    if (fiber.memoizedState === null && fiber.memoizedState === undefined) return null;
    if (fiber.memoizedState === null) return null;

    // Class components: memoizedState is the state object directly
    if (fiber.tag === ClassComponent) {
      var classState = fiber.memoizedState;
      if (typeof classState === 'object' && classState !== null && Object.keys(classState).length > 0) {
        return safeSerialize(classState, 0, propsDepth, null);
      }
      return null;
    }

    // Function components: memoizedState is a linked list of hooks
    if (fiber.tag === FunctionComponent || fiber.tag === ForwardRef ||
        fiber.tag === SimpleMemoComponent || fiber.tag === MemoComponent) {
      var hookStates = [];
      var hook = fiber.memoizedState;
      var hookIndex = 0;
      var maxHooks = 50; // Safety limit

      while (hook && hookIndex < maxHooks) {
        // Identify useState/useReducer hooks:
        // They have a `queue` property that is not null
        if (hook.queue !== null && hook.queue !== undefined) {
          // This is a useState or useReducer hook
          try {
            hookStates.push({
              type: 'state',
              index: hookIndex,
              value: safeSerialize(hook.memoizedState, 0, propsDepth, null),
            });
          } catch (e) {
            hookStates.push({
              type: 'state',
              index: hookIndex,
              value: '[Error]',
            });
          }
        }
        // Skip useEffect, useMemo, useRef, etc. — Phase 4 handles those

        hook = hook.next;
        hookIndex++;
      }

      return hookStates.length > 0 ? hookStates : null;
    }

    return null;
  }

  function getComponentName(fiber) {
    if (!fiber.type) return null;

    if (typeof fiber.type === 'string') {
      // Host element (div, span, etc.)
      return fiber.type;
    }

    // ForwardRef: type = { $$typeof, render }
    if (fiber.type.displayName) return fiber.type.displayName;
    if (fiber.type.name) return fiber.type.name;

    // ForwardRef without displayName
    if (fiber.type.render) {
      return fiber.type.render.displayName || fiber.type.render.name || 'ForwardRef';
    }

    // Memo: type = { $$typeof, type (inner) }
    if (fiber.type.type) {
      return fiber.type.type.displayName || fiber.type.type.name || 'Memo';
    }

    return 'Anonymous';
  }

  function getComponentType(fiber) {
    if (fiber.tag === HostComponent) return 'host';
    if (fiber.tag === ClassComponent) return 'class';
    if (fiber.tag === ForwardRef) return 'forward-ref';
    if (fiber.tag === MemoComponent || fiber.tag === SimpleMemoComponent) return 'memo';
    if (fiber.tag === SuspenseComponent) return 'suspense';
    if (fiber.tag === ContextProvider) return 'context-provider';
    if (fiber.tag === ContextConsumer) return 'context-consumer';
    if (fiber.tag === LazyComponent) return 'lazy';
    if (fiber.tag === Profiler) return 'profiler';
    // FunctionComponent or anything else with a function type
    return 'function';
  }

  function isUserComponent(fiber) {
    // Always include function/class components
    if (fiber.tag === FunctionComponent || fiber.tag === ClassComponent) return true;
    // Include ForwardRef, Memo, Suspense, Lazy, Profiler as they are meaningful
    if (fiber.tag === ForwardRef || fiber.tag === MemoComponent ||
        fiber.tag === SimpleMemoComponent || fiber.tag === SuspenseComponent ||
        fiber.tag === LazyComponent || fiber.tag === Profiler) return true;
    // Context providers/consumers — include for completeness
    if (fiber.tag === ContextProvider || fiber.tag === ContextConsumer) return true;
    // Host components only if includeHost
    if (fiber.tag === HostComponent && includeHost) return true;
    return false;
  }

  function walkFiber(fiber, depth) {
    if (!fiber || depth > maxDepth) return [];

    var nodes = [];
    var current = fiber;

    while (current) {
      if (isUserComponent(current)) {
        var name = getComponentName(current) || 'Anonymous';
        var node = {
          name: name,
          type: getComponentType(current),
          key: current.key || null,
          depth: depth,
          children: [],
        };

        // Extract props if requested
        if (includeProps) {
          var props = extractProps(current);
          if (props) {
            node.props = props;
          }
        }

        // Extract state if requested
        if (includeState) {
          var state = extractState(current);
          if (state) {
            node.state = state;
          }
        }

        componentCount++;

        // Walk children of this component
        if (current.child) {
          node.children = walkFiber(current.child, depth + 1);
        }

        nodes.push(node);
      } else {
        // Skip this fiber but still walk its children (e.g., HostRoot, Fragment, Mode)
        if (current.child) {
          var childNodes = walkFiber(current.child, depth);
          for (var i = 0; i < childNodes.length; i++) {
            nodes.push(childNodes[i]);
          }
        }
      }

      current = current.sibling;
    }

    return nodes;
  }

  var roots = [];

  hook._fiberRoots.forEach(function (fiberRootSet) {
    fiberRootSet.forEach(function (fiberRoot) {
      if (fiberRoot.current) {
        var treeNodes = walkFiber(fiberRoot.current, 0);
        for (var i = 0; i < treeNodes.length; i++) {
          roots.push(treeNodes[i]);
        }
      }
    });
  });

  return { roots: roots, componentCount: componentCount };
})
