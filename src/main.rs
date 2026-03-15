use anyhow::Result;
use clap::{Parser, Subcommand, ValueEnum};
use tracing_subscriber::EnvFilter;

/// Output format for command results.
#[derive(Debug, Clone, ValueEnum)]
pub enum OutputFormat {
    Text,
    Json,
}

#[derive(Parser)]
#[command(name = "debug-browser", about = "React debugging browser", version)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

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

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialize tracing with env-filter (RUST_LOG support)
    let filter = if cli.verbose {
        EnvFilter::new("debug")
    } else {
        EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"))
    };

    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .init();

    match &cli.command {
        Commands::Navigate { url } => {
            println!("Not yet implemented: navigate (url: {url})");
        }
        Commands::Click { selector } => {
            println!("Not yet implemented: click (selector: {selector})");
        }
        Commands::Type { selector, text } => {
            println!("Not yet implemented: type (selector: {selector}, text: {text})");
        }
        Commands::Components => {
            println!("Not yet implemented: components");
        }
        Commands::Hooks { component } => {
            println!("Not yet implemented: hooks (component: {component})");
        }
        Commands::Console { action } => {
            match action {
                ConsoleAction::Logs => println!("Not yet implemented: console logs"),
                ConsoleAction::Errors => println!("Not yet implemented: console errors"),
                ConsoleAction::Clear => println!("Not yet implemented: console clear"),
            }
        }
        Commands::Eval { expression } => {
            println!("Not yet implemented: eval (expression: {expression})");
        }
    }

    Ok(())
}
