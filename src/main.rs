use anyhow::Result;
use clap::{Parser, Subcommand};
use debug_browser::output::{CommandOutput, Message, OutputFormat};
use tracing_subscriber::EnvFilter;

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

fn run_command(cli: &Cli) -> Result<(), debug_browser::error::DebugBrowserError> {
    let msg = match &cli.command {
        Commands::Navigate { url } => {
            format!("Not yet implemented: navigate (url: {url})")
        }
        Commands::Click { selector } => {
            format!("Not yet implemented: click (selector: {selector})")
        }
        Commands::Type { selector, text } => {
            format!("Not yet implemented: type (selector: {selector}, text: {text})")
        }
        Commands::Components => "Not yet implemented: components".to_string(),
        Commands::Hooks { component } => {
            format!("Not yet implemented: hooks (component: {component})")
        }
        Commands::Console { action } => match action {
            ConsoleAction::Logs => "Not yet implemented: console logs".to_string(),
            ConsoleAction::Errors => "Not yet implemented: console errors".to_string(),
            ConsoleAction::Clear => "Not yet implemented: console clear".to_string(),
        },
        Commands::Eval { expression } => {
            format!("Not yet implemented: eval (expression: {expression})")
        }
    };

    let output = CommandOutput::success(Message::new(msg));
    let rendered = output.render(&cli.format).map_err(|e| {
        debug_browser::error::DebugBrowserError::Serialization(e)
    })?;
    println!("{rendered}");
    Ok(())
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

    tracing_subscriber::fmt().with_env_filter(filter).init();

    if let Err(err) = run_command(&cli) {
        let output: CommandOutput<Message> = CommandOutput {
            success: false,
            data: None,
            error: Some(err.to_string()),
        };
        let rendered = output
            .render(&cli.format)
            .unwrap_or_else(|_| format!("Error: {err}"));
        eprintln!("{rendered}");
        std::process::exit(1);
    }

    Ok(())
}
