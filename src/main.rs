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
    Components,
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
    /// Close the browser and shut down the daemon
    Close,
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
        Commands::Components => commands::components(),
        Commands::Hooks { component } => commands::hooks(component),
        Commands::Console { action } => match action {
            ConsoleAction::Logs => commands::console_logs(),
            ConsoleAction::Errors => commands::console_errors(),
            ConsoleAction::Clear => commands::console_clear(),
        },
        Commands::Eval { expression } => commands::evaluate(expression),
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

    // Build and send command
    let cmd = build_command(&cli.command);

    match send_command(cmd, &cli.session) {
        Ok(resp) => {
            let success = resp.success;
            print_response(&resp, &cli.format);
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
