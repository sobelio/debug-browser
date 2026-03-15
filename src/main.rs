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
    },
    /// Inspect hooks for a React component
    Hooks {
        /// Component name or selector
        component: String,
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
    /// Close the browser and shut down the daemon
    Close,
}

#[derive(Subcommand)]
enum ReactAction {
    /// Detect whether React is present on the current page
    Detect,
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
        Commands::Components { depth, include_host } => commands::components(*depth, *include_host),
        Commands::Hooks { component } => commands::hooks(component),
        Commands::Console { action } => match action {
            ConsoleAction::Logs => commands::console_logs(),
            ConsoleAction::Errors => commands::console_errors(),
            ConsoleAction::Clear => commands::console_clear(),
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

/// Format a component tree node recursively with indentation.
fn format_tree_node(node: &serde_json::Value, indent: usize, output: &mut String) {
    let name = node.get("name").and_then(|v| v.as_str()).unwrap_or("?");
    let comp_type = node.get("type").and_then(|v| v.as_str()).unwrap_or("?");
    let key = node.get("key").and_then(|v| v.as_str());

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

    if let Some(children) = node.get("children").and_then(|v| v.as_array()) {
        for child in children {
            format_tree_node(child, indent + 1, output);
        }
    }
}

/// Print a component tree response in human-readable format.
fn print_component_tree(resp: &Response) {
    if let Some(ref data) = resp.data {
        // Check for error field (non-React pages)
        if let Some(err) = data.get("error").and_then(|v| v.as_str()) {
            let count = data
                .get("componentCount")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            if count == 0 {
                println!("{}", err);
                return;
            }
        }

        let roots = data.get("roots").and_then(|v| v.as_array());
        let count = data
            .get("componentCount")
            .and_then(|v| v.as_u64())
            .unwrap_or(0);

        if let Some(roots) = roots {
            if roots.is_empty() {
                println!("No React components found.");
                return;
            }

            let mut output = String::new();
            for root in roots {
                format_tree_node(root, 0, &mut output);
            }
            // Remove trailing newline
            if output.ends_with('\n') {
                output.pop();
            }
            println!("{}", output);
            println!("---\n{} component(s)", count);
        } else {
            println!("No React components found.");
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

    // If --connect is set, send a launch command with CDP connection info first
    if let Some(ref connect_value) = cli.connect {
        let launch_cmd = if connect_value.starts_with("ws://")
            || connect_value.starts_with("wss://")
            || connect_value.starts_with("http://")
            || connect_value.starts_with("https://")
        {
            serde_json::json!({
                "id": "connect",
                "action": "launch",
                "cdpUrl": connect_value,
            })
        } else {
            // Treat as port number
            match connect_value.parse::<u16>() {
                Ok(port) if port > 0 => serde_json::json!({
                    "id": "connect",
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
        };

        match send_command(launch_cmd, &cli.session) {
            Ok(resp) if resp.success => { /* CDP connection succeeded */ }
            Ok(resp) => {
                let err = resp.error.unwrap_or_else(|| "CDP connection failed".to_string());
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
                Commands::Components { .. } if resp.success && cli.format == OutputFormat::Text => {
                    print_component_tree(&resp);
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
