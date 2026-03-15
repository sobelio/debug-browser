//! Error types for the debug-browser application.

use thiserror::Error;

/// Top-level error type for debug-browser operations.
#[derive(Debug, Error)]
pub enum DebugBrowserError {
    /// Browser connection or interaction error.
    #[error("browser error: {0}")]
    Browser(String),

    /// Command execution error.
    #[error("command error: {0}")]
    Command(String),

    /// React inspection error.
    #[error("react error: {0}")]
    React(String),
}
