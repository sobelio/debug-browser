// React DevTools global hook injection script.
// Injected via Playwright's addInitScript before React loads.
// This mimics the hook that React DevTools browser extension installs,
// allowing us to capture fiber roots and renderer info.

(function () {
  // Guard: don't clobber an existing hook (e.g., React DevTools extension)
  if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    return;
  }

  let rendererID = 0;

  const hook = {
    supportsFiber: true,
    renderers: new Map(),
    _fiberRoots: new Map(),

    // Metadata for debug-browser detection
    _debugBrowser: {
      detected: false,
      version: null,
      rendererCount: 0,
    },

    /**
     * Called by React when a renderer (ReactDOM, React Native, etc.) initializes.
     * Stores the renderer reference and extracts version info.
     */
    inject(renderer) {
      const id = ++rendererID;
      hook.renderers.set(id, renderer);

      // Initialize a Set for this renderer's fiber roots
      hook._fiberRoots.set(id, new Set());

      // Update detection metadata
      hook._debugBrowser.detected = true;
      hook._debugBrowser.version = renderer.version || null;
      hook._debugBrowser.rendererCount++;

      return id;
    },

    /**
     * Called by React on every commit (render). Stores/updates the fiber root.
     */
    onCommitFiberRoot(rendererID, root) {
      const roots = hook._fiberRoots.get(rendererID);
      if (roots) {
        roots.add(root);
      }
    },

    /**
     * Called by React when a fiber is unmounted. No-op for now.
     */
    onCommitFiberUnmount(rendererID, fiber) {
      // no-op — needed so React doesn't error when calling this
    },
  };

  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
})();
