// Source location lookup — resolves _debugSource for a React component.
// Evaluated in page context via Playwright's page.evaluate().
// Returns { component, source: { fileName, lineNumber, columnNumber } } or { error }.

(function (options) {
  var componentName = options && options.component;

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

  // Find ALL matching components (not just the first)
  function findAllComponents(fiber, results) {
    if (!fiber) return;
    var current = fiber;
    while (current) {
      if (isComponent(current)) {
        var name = getComponentName(current);
        if (name && name.toLowerCase().indexOf(componentName.toLowerCase()) !== -1) {
          results.push(current);
        }
      }
      if (current.child) {
        findAllComponents(current.child, results);
      }
      current = current.sibling;
    }
  }

  function getSourceLocation(fiber) {
    // React <19: _debugSource
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

    // React 19+: _debugStack
    if (fiber._debugStack && fiber._debugStack.stack) {
      return parseSourceFromStack(fiber._debugStack.stack);
    }

    return null;
  }

  function parseSourceFromStack(stack) {
    var lines = stack.split('\n');
    var userFrame = null;
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line.indexOf('at ') !== 0) continue;
      if (line.indexOf('jsx-dev-runtime') !== -1) continue;
      if (line.indexOf('jsx-runtime') !== -1) continue;
      if (line.indexOf('react-dom') !== -1) continue;
      if (line.indexOf('react.development') !== -1) continue;
      if (line.indexOf('chunk-') !== -1) continue;
      userFrame = line;
    }
    if (!userFrame) return null;
    var match = userFrame.match(/(?:\(|at\s+)(https?:\/\/[^)]+)/);
    if (!match) return null;
    var fullUrl = match[1].replace(/\)$/, '');
    var urlParts = fullUrl.match(/^https?:\/\/[^/]+(\/[^:]+?)(?::(\d+))?(?::(\d+))?$/);
    if (!urlParts) return null;
    var filePath = urlParts[1];
    if (filePath.charAt(0) === '/') filePath = filePath.substring(1);
    var loc = { fileName: filePath };
    if (urlParts[2]) loc.lineNumber = parseInt(urlParts[2], 10);
    if (urlParts[3]) loc.columnNumber = parseInt(urlParts[3], 10);
    return loc;
  }

  var matches = [];

  hook._fiberRoots.forEach(function (fiberRootSet) {
    fiberRootSet.forEach(function (fiberRoot) {
      if (fiberRoot.current) {
        findAllComponents(fiberRoot.current, matches);
      }
    });
  });

  if (matches.length === 0) {
    return { error: 'Component not found: ' + componentName };
  }

  // Deduplicate by component name + source location
  var seen = {};
  var results = [];
  for (var i = 0; i < matches.length; i++) {
    var name = getComponentName(matches[i]) || 'Anonymous';
    var source = getSourceLocation(matches[i]);
    var key = name + '|' + (source ? source.fileName + ':' + (source.lineNumber || '') : 'unknown');
    if (!seen[key]) {
      seen[key] = true;
      results.push({
        component: name,
        source: source,
      });
    }
  }

  return { matches: results };
})
