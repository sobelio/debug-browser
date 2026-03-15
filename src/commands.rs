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

/// List the React component tree.
pub fn components(
    depth: Option<u32>,
    include_host: bool,
    include_props: bool,
    include_state: bool,
    props_depth: Option<u32>,
    compact: bool,
) -> Value {
    let mut cmd = json!({
        "id": gen_id(),
        "action": "components",
        "includeProps": include_props,
        "includeState": include_state,
    });
    if let Some(d) = depth {
        cmd["depth"] = json!(d);
    }
    if include_host {
        cmd["includeHost"] = json!(true);
    }
    if let Some(pd) = props_depth {
        cmd["propsDepth"] = json!(pd);
    }
    if compact {
        cmd["compact"] = json!(true);
    }
    cmd
}

/// Inspect hooks for a named React component.
pub fn hooks(component: &str, depth: Option<u32>, compact: bool) -> Value {
    let mut cmd = json!({
        "id": gen_id(),
        "action": "hooks",
        "component": component,
    });
    if let Some(d) = depth {
        cmd["depth"] = json!(d);
    }
    if compact {
        cmd["compact"] = json!(true);
    }
    cmd
}

/// Set a React hook's state value by component name and hook index.
pub fn set_state(component: &str, hook_index: u32, value: Value) -> Value {
    json!({
        "id": gen_id(),
        "action": "set-state",
        "component": component,
        "hookIndex": hook_index,
        "value": value,
    })
}

/// Look up the source file location for a React component.
pub fn source(component: &str) -> Value {
    json!({
        "id": gen_id(),
        "action": "source",
        "component": component,
    })
}

/// Detect whether React is present on the current page.
pub fn react_detect() -> Value {
    json!({
        "id": gen_id(),
        "action": "react-detect",
    })
}

/// Ask the daemon to close the browser and shut down.
pub fn close() -> Value {
    json!({
        "id": gen_id(),
        "action": "close",
    })
}

/// Get cookies, optionally filtered by URLs.
pub fn cookies_get(urls: &[String]) -> Value {
    let mut cmd = json!({
        "id": gen_id(),
        "action": "cookies_get",
    });
    if !urls.is_empty() {
        cmd["urls"] = json!(urls);
    }
    cmd
}

/// Set one or more cookies.
pub fn cookies_set(
    name: &str,
    value: &str,
    domain: Option<&str>,
    path: Option<&str>,
    http_only: bool,
    secure: bool,
    same_site: Option<&str>,
    expires: Option<f64>,
) -> Value {
    let mut cookie = json!({
        "name": name,
        "value": value,
    });
    if let Some(d) = domain {
        cookie["domain"] = json!(d);
    }
    if let Some(p) = path {
        cookie["path"] = json!(p);
    }
    if http_only {
        cookie["httpOnly"] = json!(true);
    }
    if secure {
        cookie["secure"] = json!(true);
    }
    if let Some(s) = same_site {
        cookie["sameSite"] = json!(s);
    }
    if let Some(e) = expires {
        cookie["expires"] = json!(e);
    }
    json!({
        "id": gen_id(),
        "action": "cookies_set",
        "cookies": [cookie],
    })
}

/// Clear all cookies.
pub fn cookies_clear() -> Value {
    json!({
        "id": gen_id(),
        "action": "cookies_clear",
    })
}

/// Get storage entries (localStorage or sessionStorage).
pub fn storage_get(storage_type: &str, key: Option<&str>) -> Value {
    let mut cmd = json!({
        "id": gen_id(),
        "action": "storage_get",
        "type": storage_type,
    });
    if let Some(k) = key {
        cmd["key"] = json!(k);
    }
    cmd
}

/// Set a storage entry (localStorage or sessionStorage).
pub fn storage_set(storage_type: &str, key: &str, value: &str) -> Value {
    json!({
        "id": gen_id(),
        "action": "storage_set",
        "type": storage_type,
        "key": key,
        "value": value,
    })
}

/// Clear all entries in localStorage or sessionStorage.
pub fn storage_clear(storage_type: &str) -> Value {
    json!({
        "id": gen_id(),
        "action": "storage_clear",
        "type": storage_type,
    })
}

/// Save browser state (cookies + localStorage) to a JSON file.
pub fn state_save(path: &str) -> Value {
    json!({
        "id": gen_id(),
        "action": "state_save",
        "path": path,
    })
}

/// Attempt to load browser state at runtime (returns informational error).
pub fn state_load() -> Value {
    json!({
        "id": gen_id(),
        "action": "state_load",
    })
}
