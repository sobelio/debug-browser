// Fiber tree walker — extracts React component hierarchy from DevTools hook.
// Evaluated in page context via Playwright's page.evaluate().
// Returns { roots: [...], componentCount: number } or { error: string }.

(function (options) {
  var maxDepth = (options && options.depth) || 100;
  var includeHost = !!(options && options.includeHost);

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
