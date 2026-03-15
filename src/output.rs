//! Structured output system for rendering command results in text or JSON format.

use std::fmt;

use serde::Serialize;

use crate::error::DebugBrowserError;

/// Output format for command results.
#[derive(Debug, Clone, PartialEq, clap::ValueEnum)]
pub enum OutputFormat {
    Text,
    Json,
}

/// Wraps a command result for structured output.
#[derive(Debug, Serialize)]
pub struct CommandOutput<T: Serialize> {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<T>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

impl<T: Serialize + fmt::Display> CommandOutput<T> {
    /// Create a successful output with data.
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    /// Create an error output.
    pub fn error(err: &DebugBrowserError) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(err.to_string()),
        }
    }

    /// Render the output in the specified format.
    pub fn render(&self, format: &OutputFormat) -> Result<String, serde_json::Error> {
        match format {
            OutputFormat::Text => {
                if self.success {
                    if let Some(ref data) = self.data {
                        Ok(data.to_string())
                    } else {
                        Ok(String::from("OK"))
                    }
                } else if let Some(ref err) = self.error {
                    Ok(format!("Error: {err}"))
                } else {
                    Ok(String::from("Unknown error"))
                }
            }
            OutputFormat::Json => serde_json::to_string_pretty(self),
        }
    }
}

/// A simple string message that implements Display and Serialize.
#[derive(Debug, Serialize)]
pub struct Message {
    pub message: String,
}

impl Message {
    pub fn new(msg: impl Into<String>) -> Self {
        Self {
            message: msg.into(),
        }
    }
}

impl fmt::Display for Message {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.message)
    }
}
