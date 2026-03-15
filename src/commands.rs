//! Command builders that produce JSON values for the daemon protocol.
//!
//! Each function returns a `serde_json::Value` ready to be sent over the
//! Unix socket via [`crate::connection::send_command`].

use serde_json::{json, Value};
use std::sync::atomic::{AtomicU64, Ordering};

/// Monotonic counter for generating unique command IDs.
static COUNTER: AtomicU64 = AtomicU64::new(1);

/// Generate a unique command ID.
pub fn gen_id() -> String {
    let n = COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("cmd-{}", n)
}

/// Navigate to a URL. Prepends `https://` if no scheme is present.
pub fn navigate(url: &str) -> Value {
    let lower = url.to_lowercase();
    let normalized = if lower.starts_with("http://")
        || lower.starts_with("https://")
        || lower.starts_with("about:")
        || lower.starts_with("data:")
        || lower.starts_with("file:")
    {
        url.to_string()
    } else {
        format!("https://{}", url)
    };

    json!({
        "id": gen_id(),
        "action": "navigate",
        "url": normalized,
    })
}

/// Click an element by CSS selector.
pub fn click(selector: &str) -> Value {
    json!({
        "id": gen_id(),
        "action": "click",
        "selector": selector,
    })
}

/// Type text into an element identified by CSS selector.
pub fn type_text(selector: &str, text: &str) -> Value {
    json!({
        "id": gen_id(),
        "action": "type",
        "selector": selector,
        "text": text,
    })
}

/// Evaluate a JavaScript expression in the page context.
pub fn evaluate(script: &str) -> Value {
    json!({
        "id": gen_id(),
        "action": "evaluate",
        "script": script,
    })
}

/// Retrieve collected console logs from the daemon inbox.
pub fn console_logs() -> Value {
    json!({
        "id": gen_id(),
        "action": "console",
    })
}

/// Retrieve collected console errors from the daemon inbox.
pub fn console_errors() -> Value {
    json!({
        "id": gen_id(),
        "action": "errors",
    })
}

/// Clear the console inbox on the daemon.
pub fn console_clear() -> Value {
    json!({
        "id": gen_id(),
        "action": "console",
        "clear": true,
    })
}

/// List the React component tree (stub — requires React DevTools integration).
pub fn components() -> Value {
    json!({
        "id": gen_id(),
        "action": "components",
    })
}

/// Inspect hooks for a named React component (stub).
pub fn hooks(component: &str) -> Value {
    json!({
        "id": gen_id(),
        "action": "hooks",
        "component": component,
    })
}

/// Ask the daemon to close the browser and shut down.
pub fn close() -> Value {
    json!({
        "id": gen_id(),
        "action": "close",
    })
}
