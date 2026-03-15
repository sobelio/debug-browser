use anyhow::Result;
use clap::{Parser, Subcommand};
use debug_browser::commands;
use debug_browser::connection::{ensure_daemon, send_command, Response};
use debug_browser::output::OutputFormat;
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(name = "debug-browser", about = "React debugging browser", version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Session name for daemon multiplexing
    #[arg(long, default_value = "default", global = true)]
    session: String,

    /// Output format
    #[arg(long, default_value = "text", global = true)]
    format: OutputFormat,

    /// Enable verbose logging
    #[arg(short, long, global = true)]
    verbose: bool,

    /// Connect to an existing Chrome instance via CDP (port number or ws:// URL)
    #[arg(long, global = true)]
    connect: Option<String>,

    /// Load browser state (cookies + localStorage) from a JSON file at launch
    #[arg(long, global = true)]
    state: Option<String>,

    /// Use a persistent browser profile directory (persists cookies/cache/storage between sessions)
    #[arg(long, global = true)]
    profile: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// Navigate to a URL
    Navigate {
        /// The URL to navigate to
        url: String,
    },
    /// Click an element by CSS selector
    Click {
        /// CSS selector for the element to click
        selector: String,
    },
    /// Type text into an element
    Type {
        /// CSS selector for the input element
        selector: String,
        /// Text to type
        text: String,
    },
    /// List React component tree
    Components {
        /// Maximum depth to traverse (default: 100)
        #[arg(long)]
        depth: Option<u32>,
        /// Include host elements (div, span, etc.) in output
        #[arg(long)]
        include_host: bool,
        /// Hide props from output
        #[arg(long)]
        no_props: bool,
        /// Hide state from output
        #[arg(long)]
        no_state: bool,
        /// Max serialization depth for props/state (default: 3)
        #[arg(long)]
        props_depth: Option<u32>,
        /// Filter to components matching this name (substring match)
        #[arg(long)]
        component: Option<String>,
    },
    /// Inspect hooks for a React component
    Hooks {
        /// Component name or selector
        component: String,
        /// Max serialization depth for hook values (default: 3)
        #[arg(long)]
        depth: Option<u32>,
    },
    /// Manage console logs/errors inbox
    Console {
        #[command(subcommand)]
        action: ConsoleAction,
    },
    /// Evaluate a JavaScript expression
    Eval {
        /// JavaScript expression to evaluate
        expression: String,
    },
    /// React inspection commands
    React {
        #[command(subcommand)]
        action: ReactAction,
    },
    /// Manage browser storage (localStorage / sessionStorage)
    Storage {
        #[command(subcommand)]
        action: StorageAction,
    },
    /// Manage browser cookies
    Cookies {
        #[command(subcommand)]
        action: Option<CookiesAction>,
    },
    /// Save or load browser state (cookies + localStorage)
    State {
        #[command(subcommand)]
        action: StateAction,
    },
    /// Close the browser and shut down the daemon
    Close,
}

#[derive(Subcommand)]
enum StateAction {
    /// Save browser state (cookies + localStorage) to a JSON file
    Save {
        /// Path to save state JSON file
        path: String,
    },
    /// Load browser state — must use --state flag at launch instead
    Load,
}

#[derive(Subcommand)]
enum ReactAction {
    /// Detect whether React is present on the current page
    Detect,
}

#[derive(Subcommand)]
enum StorageAction {
    /// Operate on localStorage
    Local {
        #[command(subcommand)]
        action: Option<StorageSubAction>,
    },
    /// Operate on sessionStorage
    Session {
        #[command(subcommand)]
        action: Option<StorageSubAction>,
    },
}

#[derive(Subcommand)]
enum StorageSubAction {
    /// Get a storage value (or all values if no key given)
    Get {
        /// Key to retrieve (omit for all entries)
        key: Option<String>,
    },
    /// Set a storage key-value pair
    Set {
        /// Storage key
        key: String,
        /// Storage value
        value: String,
    },
    /// Clear all entries
    Clear,
}

#[derive(Subcommand)]
enum CookiesAction {
    /// Get cookies, optionally filtered by URLs
    Get {
        /// URLs to filter cookies by
        urls: Vec<String>,
    },
    /// Set a cookie
    Set {
        /// Cookie name
        name: String,
        /// Cookie value
        value: String,
        /// Cookie domain
        #[arg(long)]
        domain: Option<String>,
        /// Cookie path
        #[arg(long)]
        path: Option<String>,
        /// Mark cookie as HTTP-only
        #[arg(long)]
        http_only: bool,
        /// Mark cookie as secure
        #[arg(long)]
        secure: bool,
        /// SameSite attribute (Strict, Lax, None)
        #[arg(long)]
        same_site: Option<String>,
        /// Expiration as Unix timestamp
        #[arg(long)]
        expires: Option<f64>,
    },
    /// Clear all cookies
    Clear,
}

#[derive(Subcommand)]
enum ConsoleAction {
    /// Show collected console logs
    Logs,
    /// Show collected errors
    Errors,
    /// Clear the console inbox
    Clear,
}

/// Build the JSON command value from CLI args.
fn build_command(command: &Commands) -> serde_json::Value {
    match command {
        Commands::Navigate { url } => commands::navigate(url),
        Commands::Click { selector } => commands::click(selector),
        Commands::Type { selector, text } => commands::type_text(selector, text),
        Commands::Components {
            depth,
            include_host,
            no_props,
            no_state,
            props_depth,
            ..
        } => commands::components(*depth, *include_host, !no_props, !no_state, *props_depth),
        Commands::Hooks { component, depth } => commands::hooks(component, *depth),
        Commands::Console { action } => match action {
            ConsoleAction::Logs => commands::console_logs(),
            ConsoleAction::Errors => commands::console_errors(),
            ConsoleAction::Clear => commands::console_clear(),
        },
        Commands::Storage { action } => {
            let (storage_type, sub) = match action {
                StorageAction::Local { action } => ("local", action),
                StorageAction::Session { action } => ("session", action),
            };
            match sub {
                Some(StorageSubAction::Get { key }) => {
                    commands::storage_get(storage_type, key.as_deref())
                }
                Some(StorageSubAction::Set { key, value }) => {
                    commands::storage_set(storage_type, key, value)
                }
                Some(StorageSubAction::Clear) => commands::storage_clear(storage_type),
                None => commands::storage_get(storage_type, None),
            }
        }
        Commands::Cookies { action } => match action {
            Some(CookiesAction::Get { urls }) => commands::cookies_get(urls),
            Some(CookiesAction::Set {
                name,
                value,
                domain,
                path,
                http_only,
                secure,
                same_site,
                expires,
            }) => commands::cookies_set(
                name,
                value,
                domain.as_deref(),
                path.as_deref(),
                *http_only,
                *secure,
                same_site.as_deref(),
                *expires,
            ),
            Some(CookiesAction::Clear) => commands::cookies_clear(),
            None => commands::cookies_get(&[]),
        },
        Commands::State { action } => match action {
            StateAction::Save { path } => commands::state_save(path),
            StateAction::Load => commands::state_load(),
        },
        Commands::Eval { expression } => commands::evaluate(expression),
        Commands::React { action } => match action {
            ReactAction::Detect => commands::react_detect(),
        },
        Commands::Close => commands::close(),
    }
}

/// Format and print the daemon response.
fn print_response(resp: &Response, format: &OutputFormat) {
    match format {
        OutputFormat::Json => {
            // In JSON mode, pass through the daemon response directly
            let output = serde_json::to_string_pretty(resp)
                .unwrap_or_else(|_| r#"{"success":false,"error":"serialization error"}"#.to_string());
            println!("{}", output);
        }
        OutputFormat::Text => {
            if resp.success {
                if let Some(ref data) = resp.data {
                    // Pretty-print structured data, or print strings directly
                    if let Some(s) = data.as_str() {
                        println!("{}", s);
                    } else {
                        println!(
                            "{}",
                            serde_json::to_string_pretty(data).unwrap_or_else(|_| data.to_string())
                        );
                    }
                } else {
                    println!("OK");
                }
            } else if let Some(ref err) = resp.error {
                eprintln!("Error: {}", err);
            } else {
                eprintln!("Unknown error");
            }
        }
    }
}

/// Compact-format a JSON value for inline display. Truncate if too long.
fn compact_json(value: &serde_json::Value) -> String {
    let s = serde_json::to_string(value).unwrap_or_else(|_| value.to_string());
    if s.len() > 120 {
        format!("{}...", &s[..120])
    } else {
        s
    }
}

/// Format a component tree node recursively with indentation.
/// `filter` is an optional substring to match component names against.
/// Returns true if this node or any descendant matched the filter.
fn format_tree_node(
    node: &serde_json::Value,
    indent: usize,
    output: &mut String,
    filter: Option<&str>,
) -> bool {
    let name = node.get("name").and_then(|v| v.as_str()).unwrap_or("?");
    let comp_type = node.get("type").and_then(|v| v.as_str()).unwrap_or("?");
    let key = node.get("key").and_then(|v| v.as_str());

    // Check children first to determine if any descendant matches
    let children = node.get("children").and_then(|v| v.as_array());
    let mut child_output = String::new();
    let mut child_matched = false;
    if let Some(children) = children {
        for child in children {
            if format_tree_node(child, indent + 1, &mut child_output, filter) {
                child_matched = true;
            }
        }
    }

    // Determine if this node matches the filter
    let self_matches = match filter {
        Some(f) => name.to_lowercase().contains(&f.to_lowercase()),
        None => true,
    };

    if !self_matches && !child_matched {
        return false;
    }

    let prefix = "  ".repeat(indent);
    output.push_str(&prefix);
    output.push_str(name);
    output.push_str(" (");
    output.push_str(comp_type);
    output.push(')');
    if let Some(k) = key {
        output.push_str(" key=\"");
        output.push_str(k);
        output.push('"');
    }
    output.push('\n');

    // Show props if present
    if let Some(props) = node.get("props") {
        if props.is_object() {
            let formatted = compact_json(props);
            output.push_str(&prefix);
            output.push_str("  props: ");
            output.push_str(&formatted);
            output.push('\n');
        }
    }

    // Show state if present
    if let Some(state) = node.get("state") {
        let formatted = compact_json(state);
        output.push_str(&prefix);
        output.push_str("  state: ");
        output.push_str(&formatted);
        output.push('\n');
    }

    output.push_str(&child_output);
    true
}

/// Print a component tree response in human-readable format.
fn print_component_tree(resp: &Response, filter: Option<&str>) {
    if let Some(ref data) = resp.data {
        // Check for error field (non-React pages)
        if let Some(err) = data.get("error").and_then(|v| v.as_str()) {
            let count = data
                .get("componentCount")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            if count == 0 {
                println!(
                    "No React components detected on this page. Make sure you navigate to a React application first."
                );
                return;
            }
            // If there's an error but components exist, show the error as info
            eprintln!("Warning: {}", err);
        }

        let roots = data.get("roots").and_then(|v| v.as_array());
        let count = data
            .get("componentCount")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        if let Some(roots) = roots {
            if roots.is_empty() {
                println!(
                    "No React components detected on this page. Make sure you navigate to a React application first."
                );
                return;
            }

            let mut output = String::new();
            for root in roots {
                format_tree_node(root, 0, &mut output, filter);
            }
            // Remove trailing newline
            if output.ends_with('\n') {
                output.pop();
            }
            if output.is_empty() {
                if let Some(f) = filter {
                    println!("No components matching \"{}\" found.", f);
                } else {
                    println!("No React components found.");
                }
            } else {
                println!("{}", output);
                println!("---\n{} component(s) total", count);
            }
        } else {
            println!(
                "No React components detected on this page. Make sure you navigate to a React application first."
            );
        }
    } else {
        println!("No data returned.");
    }
}

/// Print hook inspection results in human-readable format.
fn print_hooks(resp: &Response) {
    if let Some(ref data) = resp.data {
        // Check for error field
        if let Some(err) = data.get("error").and_then(|v| v.as_str()) {
            eprintln!("Error: {}", err);
            return;
        }

        let component = data
            .get("component")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown");
        let comp_type = data
            .get("type")
            .and_then(|v| v.as_str())
            .unwrap_or("unknown");
        let hook_count = data
            .get("hookCount")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        // Handle class components with classState
        if let Some(class_state) = data.get("classState") {
            println!(
                "Hooks for {} ({}, class component):",
                component, comp_type
            );
            println!("  classState: {}", compact_json(class_state));
            return;
        }

        println!(
            "Hooks for {} ({}, {} hooks):",
            component, comp_type, hook_count
        );

        if let Some(hooks) = data.get("hooks").and_then(|v| v.as_array()) {
            for hook in hooks {
                let index = hook.get("index").and_then(|v| v.as_u64()).unwrap_or(0);
                let hook_type = hook
                    .get("type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");

                let debug_label = hook.get("debugLabel").and_then(|v| v.as_str());

                let line = match hook_type {
                    "state" => {
                        let val = hook
                            .get("value")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        format!("  [{}] useState: {}", index, val)
                    }
                    "reducer" => {
                        let val = hook
                            .get("value")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        format!("  [{}] useReducer: {}", index, val)
                    }
                    "effect" | "layout-effect" | "insertion-effect" => {
                        let name = match hook_type {
                            "layout-effect" => "useLayoutEffect",
                            "insertion-effect" => "useInsertionEffect",
                            _ => "useEffect",
                        };
                        let deps = hook
                            .get("deps")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        let cleanup = hook
                            .get("hasCleanup")
                            .and_then(|v| v.as_bool())
                            .unwrap_or(false);
                        format!(
                            "  [{}] {}: deps={} cleanup={}",
                            index,
                            name,
                            deps,
                            if cleanup { "yes" } else { "no" }
                        )
                    }
                    "ref" => {
                        let current = hook
                            .get("current")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        format!("  [{}] useRef: current={}", index, current)
                    }
                    "memo" => {
                        let val = hook
                            .get("value")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        let deps = hook
                            .get("deps")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        format!("  [{}] useMemo: {} deps={}", index, val, deps)
                    }
                    "callback" => {
                        let deps = hook
                            .get("deps")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        format!("  [{}] useCallback: deps={}", index, deps)
                    }
                    "context" => {
                        let val = hook
                            .get("value")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        format!("  [{}] useContext: {}", index, val)
                    }
                    "transition" => {
                        let val = hook
                            .get("value")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        format!("  [{}] useTransition: {}", index, val)
                    }
                    "deferred-value" => {
                        let val = hook
                            .get("value")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        format!("  [{}] useDeferredValue: {}", index, val)
                    }
                    "id" => {
                        let val = hook
                            .get("value")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        format!("  [{}] useId: {}", index, val)
                    }
                    "sync-external-store" => {
                        let val = hook
                            .get("value")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        format!("  [{}] useSyncExternalStore: {}", index, val)
                    }
                    "debug-value" => {
                        // debug-value hooks are label-only, typically consumed by preceding hook
                        let val = hook
                            .get("value")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        format!("  [{}] useDebugValue: {}", index, val)
                    }
                    other => {
                        // Custom hooks or unknown types
                        let val = hook
                            .get("value")
                            .map(|v| compact_json(v))
                            .unwrap_or_else(|| "null".to_string());
                        if let Some(label) = debug_label {
                            format!("  [{}] {} (custom): {}", index, label, val)
                        } else {
                            format!("  [{}] {}: {}", index, other, val)
                        }
                    }
                };
                println!("{}", line);
            }
        }
    } else {
        println!("No data returned.");
    }
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize tracing with env-filter (RUST_LOG support)
    let filter = if cli.verbose {
        EnvFilter::new("debug")
    } else {
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"))
    };

    tracing_subscriber::fmt().with_env_filter(filter).init();

    // Ensure daemon is running
    if let Err(e) = ensure_daemon(&cli.session) {
        match cli.format {
            OutputFormat::Json => {
                println!(r#"{{"success":false,"error":"{}"}}"#, e);
            }
            OutputFormat::Text => {
                eprintln!("Error: {}", e);
            }
        }
        std::process::exit(1);
    }

    // Validate mutual exclusion: --profile + --state
    if cli.profile.is_some() && cli.state.is_some() {
        let msg = "Cannot use --profile with --state (profile already persists state)";
        match cli.format {
            OutputFormat::Json => println!(r#"{{"success":false,"error":"{}"}}"#, msg),
            OutputFormat::Text => eprintln!("Error: {}", msg),
        }
        std::process::exit(1);
    }

    // Validate mutual exclusion: --profile + --connect
    if cli.profile.is_some() && cli.connect.is_some() {
        let msg = "Cannot use --profile with --connect";
        match cli.format {
            OutputFormat::Json => println!(r#"{{"success":false,"error":"{}"}}"#, msg),
            OutputFormat::Text => eprintln!("Error: {}", msg),
        }
        std::process::exit(1);
    }

    // Validate --state file exists
    if let Some(ref state_path) = cli.state {
        if !std::path::Path::new(state_path).exists() {
            let msg = format!("State file not found: {}", state_path);
            match cli.format {
                OutputFormat::Json => println!(r#"{{"success":false,"error":"{}"}}"#, msg),
                OutputFormat::Text => eprintln!("Error: {}", msg),
            }
            std::process::exit(1);
        }
    }

    // If --connect, --state, or --profile is set, send a launch command with the appropriate options first
    if cli.connect.is_some() || cli.state.is_some() || cli.profile.is_some() {
        let mut launch_cmd = if let Some(ref connect_value) = cli.connect {
            if connect_value.starts_with("ws://")
                || connect_value.starts_with("wss://")
                || connect_value.starts_with("http://")
                || connect_value.starts_with("https://")
            {
                serde_json::json!({
                    "id": "launch",
                    "action": "launch",
                    "cdpUrl": connect_value,
                })
            } else {
                // Treat as port number
                match connect_value.parse::<u16>() {
                    Ok(port) if port > 0 => serde_json::json!({
                        "id": "launch",
                        "action": "launch",
                        "cdpPort": port,
                    }),
                    _ => {
                        let msg = format!(
                            "Invalid --connect value: '{}' — expected a port number or ws:// URL",
                            connect_value
                        );
                        match cli.format {
                            OutputFormat::Json => println!(r#"{{"success":false,"error":"{}"}}"#, msg),
                            OutputFormat::Text => eprintln!("Error: {}", msg),
                        }
                        std::process::exit(1);
                    }
                }
            }
        } else {
            serde_json::json!({
                "id": "launch",
                "action": "launch",
            })
        };

        if let Some(ref state_path) = cli.state {
            launch_cmd["storageState"] = serde_json::json!(state_path);
        }

        if let Some(ref profile_path) = cli.profile {
            launch_cmd["profile"] = serde_json::json!(profile_path);
        }

        match send_command(launch_cmd, &cli.session) {
            Ok(resp) if resp.success => { /* launch succeeded */ }
            Ok(resp) => {
                let err = resp.error.unwrap_or_else(|| "Launch failed".to_string());
                match cli.format {
                    OutputFormat::Json => println!(r#"{{"success":false,"error":"{}"}}"#, err),
                    OutputFormat::Text => eprintln!("Error: {}", err),
                }
                std::process::exit(1);
            }
            Err(e) => {
                match cli.format {
                    OutputFormat::Json => println!(r#"{{"success":false,"error":"{}"}}"#, e),
                    OutputFormat::Text => eprintln!("Error: {}", e),
                }
                std::process::exit(1);
            }
        }
    }

    // Build and send command
    let cmd = build_command(&cli.command);

    match send_command(cmd, &cli.session) {
        Ok(resp) => {
            let success = resp.success;
            match &cli.command {
                Commands::Components { component, .. }
                    if resp.success && cli.format == OutputFormat::Text =>
                {
                    print_component_tree(&resp, component.as_deref());
                }
                Commands::Hooks { .. }
                    if resp.success && cli.format == OutputFormat::Text =>
                {
                    print_hooks(&resp);
                }
                _ => {
                    print_response(&resp, &cli.format);
                }
            }
            if !success {
                std::process::exit(1);
            }
        }
        Err(e) => {
            match cli.format {
                OutputFormat::Json => {
                    println!(r#"{{"success":false,"error":"{}"}}"#, e);
                }
                OutputFormat::Text => {
                    eprintln!("Error: {}", e);
                }
            }
            std::process::exit(1);
        }
    }

    Ok(())
}
