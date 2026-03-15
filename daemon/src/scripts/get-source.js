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
    return null;
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
