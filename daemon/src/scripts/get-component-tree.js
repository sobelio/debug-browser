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

  function getSourceLocation(fiber) {
    // React <19: _debugSource is set by the Babel/SWC React transform
    var source = fiber._debugSource;
    if (source && source.fileName) {
      var loc = { fileName: source.fileName };
      if (typeof source.lineNumber === 'number') {
        loc.lineNumber = source.lineNumber;
      }
      if (typeof source.columnNumber === 'number') {
        loc.columnNumber = source.columnNumber;
      }
      return loc;
    }

    // React 19+: _debugStack is an Error with a stack trace
    var debugStack = fiber._debugStack;
    if (debugStack && debugStack.stack) {
      return parseSourceFromStack(debugStack.stack);
    }

    return null;
  }

  // Parse the last meaningful frame from a React _debugStack trace.
  // Stack format: "Error: react-stack-top-frame\n    at jsxDEV (...)\n    at http://host/src/file.jsx:line:col"
  // We want the last frame (the user's code), not the jsxDEV wrapper.
  function parseSourceFromStack(stack) {
    var lines = stack.split('\n');
    // Find the last "at" frame — that's typically the user component call site
    var userFrame = null;
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf('at ') !== 0) continue;
      // Skip React internal frames (jsx-dev-runtime, react-dom, etc.)
      if (line.indexOf('jsx-dev-runtime') !== -1) continue;
      if (line.indexOf('jsx-runtime') !== -1) continue;
      if (line.indexOf('react-dom') !== -1) continue;
      if (line.indexOf('react.development') !== -1) continue;
      if (line.indexOf('chunk-') !== -1) continue;
      userFrame = line;
    }
    if (!userFrame) return null;

    // Extract URL and line/col from patterns like:
    //   "at App (http://localhost:5199/src/App.jsx:8:10)"
    //   "at http://localhost:5199/src/main.jsx:7:116"
    var match = userFrame.match(/(?:\(|at\s+)(https?:\/\/[^)]+)/);
    if (!match) return null;

    var fullUrl = match[1].replace(/\)$/, '');
    // Parse "http://host:port/src/file.jsx:line:col"
    var urlParts = fullUrl.match(/^https?:\/\/[^/]+(\/[^:]+?)(?::(\d+))?(?::(\d+))?$/);
    if (!urlParts) return null;

    var filePath = urlParts[1];
    // Strip leading slash for cleaner display
    if (filePath.charAt(0) === '/') filePath = filePath.substring(1);

    var loc = { fileName: filePath };
    if (urlParts[2]) loc.lineNumber = parseInt(urlParts[2], 10);
    if (urlParts[3]) loc.columnNumber = parseInt(urlParts[3], 10);
    return loc;
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

        // Extract source location if available
        var source = getSourceLocation(current);
        if (source) {
          node.source = source;
        }

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
