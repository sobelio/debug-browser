// DOM element to React component reverse lookup.
// Given a CSS selector, finds the owning React component via __reactFiber$ keys.
// Evaluated in page context via Playwright's page.evaluate().
// Returns { component, type, source, owners, hooks } or { error }.

(function (options) {
  var selector = options && options.selector;
  var includeHooks = !!(options && options.includeHooks);
  var maxSerializeDepth = (options && options.depth) || 3;

  if (!selector) {
    return { error: 'No selector provided' };
  }

  var hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (!hook) {
    return { error: 'No React DevTools hook found' };
  }

  // Find the DOM element
  var element = document.querySelector(selector);
  if (!element) {
    return { error: 'Element not found: ' + selector };
  }

  // Find the React fiber key on the element
  var fiberKey = null;
  var keys = Object.keys(element);
  for (var i = 0; i < keys.length; i++) {
    if (keys[i].indexOf('__reactFiber$') === 0 || keys[i].indexOf('__reactInternalInstance$') === 0) {
      fiberKey = keys[i];
      break;
    }
  }

  if (!fiberKey) {
    return { error: 'No React fiber found on element matching: ' + selector + ' — element may not be managed by React' };
  }

  var fiber = element[fiberKey];
  if (!fiber) {
    return { error: 'React fiber is null on element' };
  }

  // Fiber tag constants
  var FunctionComponent = 0;
  var ClassComponent = 1;
  var ForwardRef = 11;
  var MemoComponent = 14;
  var SimpleMemoComponent = 15;

  function isUserComponent(f) {
    return (
      f.tag === FunctionComponent ||
      f.tag === ClassComponent ||
      f.tag === ForwardRef ||
      f.tag === MemoComponent ||
      f.tag === SimpleMemoComponent
    );
  }

  function getComponentName(f) {
    if (!f.type) return null;
    if (typeof f.type === 'string') return f.type;
    if (f.type.displayName) return f.type.displayName;
    if (f.type.name) return f.type.name;
    if (f.type.render) {
      return f.type.render.displayName || f.type.render.name || 'ForwardRef';
    }
    if (f.type.type) {
      return f.type.type.displayName || f.type.type.name || 'Memo';
    }
    return 'Anonymous';
  }

  function getComponentType(f) {
    if (f.tag === ClassComponent) return 'class';
    if (f.tag === ForwardRef) return 'forward-ref';
    if (f.tag === MemoComponent || f.tag === SimpleMemoComponent) return 'memo';
    return 'function';
  }

  function getSourceLocation(f) {
    var source = f._debugSource;
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
    return null;
  }

  // --- Safe serialization helper ---
  function safeSerialize(value, currentDepth, maxDepth, seen) {
    if (currentDepth > maxDepth) return '[Truncated]';
    if (value === null) return null;
    if (value === undefined) return '[undefined]';

    var type = typeof value;
    if (type === 'string') {
      return value.length > 200 ? value.slice(0, 200) + '...' : value;
    }
    if (type === 'number' || type === 'boolean') return value;
    if (type === 'function') return '[Function]';
    if (type === 'symbol') return '[Symbol: ' + String(value) + ']';
    if (type === 'bigint') return value.toString() + 'n';

    if (value instanceof Element) return '[Element: ' + value.tagName.toLowerCase() + ']';
    if (value instanceof Node) return '[Node: ' + value.nodeName + ']';

    if (value && value.$$typeof) {
      var elemType = value.type;
      var elemName = 'unknown';
      if (typeof elemType === 'string') elemName = elemType;
      else if (typeof elemType === 'function') elemName = elemType.displayName || elemType.name || 'Component';
      else if (elemType && typeof elemType === 'object') elemName = elemType.displayName || elemType.name || 'Component';
      return '[ReactElement: ' + elemName + ']';
    }

    if (!seen) seen = [];
    for (var s = 0; s < seen.length; s++) {
      if (seen[s] === value) return '[Circular]';
    }
    seen = seen.concat([value]);

    if (Array.isArray(value)) {
      if (value.length === 0) return [];
      if (currentDepth === maxDepth) return '[Array(' + value.length + ')]';
      var arr = [];
      for (var ai = 0; ai < value.length; ai++) {
        arr.push(safeSerialize(value[ai], currentDepth + 1, maxDepth, seen));
      }
      return arr;
    }

    if (type === 'object') {
      var objKeys = Object.keys(value);
      if (objKeys.length === 0) return {};
      if (currentDepth === maxDepth) return '[Object(' + objKeys.length + ' keys)]';
      var obj = {};
      for (var k = 0; k < objKeys.length; k++) {
        try {
          obj[objKeys[k]] = safeSerialize(value[objKeys[k]], currentDepth + 1, maxDepth, seen);
        } catch (e) {
          obj[objKeys[k]] = '[Error]';
        }
      }
      return obj;
    }

    return String(value);
  }

  // Walk up the fiber tree to find the nearest user component
  var current = fiber;
  var nearestComponent = null;

  while (current) {
    if (isUserComponent(current)) {
      nearestComponent = current;
      break;
    }
    current = current.return;
  }

  if (!nearestComponent) {
    return { error: 'No React component found owning element: ' + selector };
  }

  var result = {
    component: getComponentName(nearestComponent) || 'Anonymous',
    type: getComponentType(nearestComponent),
    source: getSourceLocation(nearestComponent),
  };

  // Build owner chain by walking up from the component
  var owners = [];
  var ownerFiber = nearestComponent.return;
  var maxOwners = 10;
  while (ownerFiber && owners.length < maxOwners) {
    if (isUserComponent(ownerFiber)) {
      var ownerInfo = {
        component: getComponentName(ownerFiber) || 'Anonymous',
        type: getComponentType(ownerFiber),
        source: getSourceLocation(ownerFiber),
      };
      owners.push(ownerInfo);
    }
    ownerFiber = ownerFiber.return;
  }
  result.owners = owners;

  // Optionally extract hooks summary
  if (includeHooks && nearestComponent.tag !== ClassComponent) {
    var hooks = [];
    var hookNode = nearestComponent.memoizedState;
    var hookIndex = 0;
    var maxHooks = 50;
    var debugHookTypes = nearestComponent._debugHookTypes || null;

    // Known hook name mappings
    var DEBUG_TYPE_MAP = {
      'useState': 'state', 'useReducer': 'reducer',
      'useEffect': 'effect', 'useLayoutEffect': 'layout-effect',
      'useInsertionEffect': 'insertion-effect', 'useRef': 'ref',
      'useMemo': 'memo', 'useCallback': 'callback',
      'useContext': 'context', 'useDebugValue': 'debug-value',
      'useTransition': 'transition', 'useDeferredValue': 'deferred-value',
      'useId': 'id', 'useSyncExternalStore': 'sync-external-store',
      'useImperativeHandle': 'imperative-handle'
    };

    while (hookNode && hookIndex < maxHooks) {
      var hookType = 'unknown';

      // Use _debugHookTypes if available
      if (debugHookTypes && hookIndex < debugHookTypes.length) {
        var debugType = debugHookTypes[hookIndex];
        hookType = DEBUG_TYPE_MAP[debugType] || debugType.replace(/^use/, '').toLowerCase() || 'unknown';
      } else {
        var ms = hookNode.memoizedState;
        if (typeof ms === 'string' && /^:r[0-9a-z]+:$/.test(ms)) {
          hookType = 'id';
        } else if (hookNode.queue !== null && hookNode.queue !== undefined) {
          hookType = 'state';
        } else if (ms && typeof ms === 'object' && typeof ms.create === 'function' && 'tag' in ms) {
          hookType = 'effect';
        } else if (ms && typeof ms === 'object' && !Array.isArray(ms) && hookNode.queue === null) {
          var msKeys = Object.keys(ms);
          if (msKeys.length === 1 && msKeys[0] === 'current') hookType = 'ref';
        } else if (Array.isArray(ms) && ms.length === 2 && hookNode.queue === null) {
          hookType = typeof ms[0] === 'function' ? 'callback' : 'memo';
        }
      }

      var hookData = { index: hookIndex, type: hookType };

      // Extract value for state/reducer hooks
      if (hookType === 'state' || hookType === 'reducer') {
        hookData.value = safeSerialize(hookNode.memoizedState, 0, maxSerializeDepth, null);
      }

      hooks.push(hookData);
      hookNode = hookNode.next;
      hookIndex++;
    }

    result.hookCount = hooks.length;
    result.hooks = hooks;
  }

  // Include DOM element info
  result.element = {
    tagName: element.tagName.toLowerCase(),
    id: element.id || null,
    className: element.className || null,
  };

  return result;
})
