//! Unix socket connection to the debug-browser daemon.
//!
//! Handles daemon lifecycle (finding, spawning, connecting) and
//! sending JSON commands over a Unix domain socket.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::env;
use std::fs;
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::thread;
use std::time::Duration;

/// A JSON request sent to the daemon over the socket.
#[derive(Serialize)]
pub struct Request {
    pub id: String,
    pub action: String,
    #[serde(flatten)]
    pub extra: Value,
}

/// A JSON response received from the daemon.
#[derive(Deserialize, Serialize, Default, Debug)]
pub struct Response {
    pub success: bool,
    pub data: Option<Value>,
    pub error: Option<String>,
}

/// Get the base directory for socket/pid files.
/// Priority: DEBUG_BROWSER_SOCKET_DIR > XDG_RUNTIME_DIR > ~/.debug-browser > tmpdir
pub fn get_socket_dir() -> PathBuf {
    // 1. Explicit override (ignore empty string)
    if let Ok(dir) = env::var("DEBUG_BROWSER_SOCKET_DIR") {
        if !dir.is_empty() {
            return PathBuf::from(dir);
        }
    }

    // 2. XDG_RUNTIME_DIR (Linux standard, ignore empty string)
    if let Ok(runtime_dir) = env::var("XDG_RUNTIME_DIR") {
        if !runtime_dir.is_empty() {
            return PathBuf::from(runtime_dir).join("debug-browser");
        }
    }

    // 3. Home directory fallback
    if let Some(home) = dirs::home_dir() {
        return home.join(".debug-browser");
    }

    // 4. Last resort: temp dir
    env::temp_dir().join("debug-browser")
}

fn get_socket_path(session: &str) -> PathBuf {
    get_socket_dir().join(format!("{}.sock", session))
}

fn get_pid_path(session: &str) -> PathBuf {
    get_socket_dir().join(format!("{}.pid", session))
}

fn is_daemon_running(session: &str) -> bool {
    let pid_path = get_pid_path(session);
    if !pid_path.exists() {
        return false;
    }
    if let Ok(pid_str) = fs::read_to_string(&pid_path) {
        if let Ok(pid) = pid_str.trim().parse::<i32>() {
            // SAFETY: kill with signal 0 only checks if the process exists
            unsafe {
                return libc::kill(pid, 0) == 0;
            }
        }
    }
    false
}

fn daemon_ready(session: &str) -> bool {
    let socket_path = get_socket_path(session);
    UnixStream::connect(&socket_path).is_ok()
}

/// Find the daemon.js entry point.
/// Discovery order (first existing file wins):
/// 1. DEBUG_BROWSER_DAEMON_PATH env var (explicit override)
/// 2. DEBUG_BROWSER_HOME/daemon/dist/daemon.js (home dir override)
/// 3. exe_dir/daemon/dist/daemon.js (co-located layout)
/// 4. exe_dir/../share/debug-browser/daemon/dist/daemon.js (Nix/FHS layout)
/// 5. exe_dir/../lib/debug-browser/daemon/dist/daemon.js (alternative FHS)
/// 6. exe_dir/../../daemon/dist/daemon.js (cargo target/release/ dev layout)
fn find_daemon_js() -> Result<PathBuf, String> {
    // 1. Explicit env var override
    if let Ok(path) = env::var("DEBUG_BROWSER_DAEMON_PATH") {
        let p = PathBuf::from(&path);
        if p.exists() {
            return Ok(p);
        }
        return Err(format!(
            "DEBUG_BROWSER_DAEMON_PATH is set to '{}' but the file does not exist",
            path
        ));
    }

    let mut candidates: Vec<PathBuf> = Vec::new();

    // 2. DEBUG_BROWSER_HOME env var
    if let Ok(home) = env::var("DEBUG_BROWSER_HOME") {
        if !home.is_empty() {
            candidates.push(PathBuf::from(&home).join("daemon/dist/daemon.js"));
        }
    }

    // 3-6. Exe-relative paths
    if let Ok(exe_path) = env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            // 3. Co-located: exe_dir/daemon/dist/daemon.js
            candidates.push(exe_dir.join("daemon/dist/daemon.js"));

            if let Some(parent) = exe_dir.parent() {
                // 4. Nix/FHS: exe_dir/../share/debug-browser/daemon/dist/daemon.js
                candidates.push(
                    parent.join("share/debug-browser/daemon/dist/daemon.js"),
                );
                // 5. Alt FHS: exe_dir/../lib/debug-browser/daemon/dist/daemon.js
                candidates.push(
                    parent.join("lib/debug-browser/daemon/dist/daemon.js"),
                );

                // 6. Cargo dev: exe_dir/../../daemon/dist/daemon.js
                if let Some(grandparent) = parent.parent() {
                    candidates.push(grandparent.join("daemon/dist/daemon.js"));
                }
            }
        }
    }

    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.clone());
        }
    }

    Err(
        "Daemon not found. Set DEBUG_BROWSER_HOME to the install directory, \
         or DEBUG_BROWSER_DAEMON_PATH to the daemon.js file directly. \
         If building from source, run `npm run build` in daemon/."
            .to_string(),
    )
}

/// Ensure the daemon is running for the given session.
/// If not running, spawns `node daemon.js` as a detached background process
/// and waits up to 5 seconds for it to become ready.
pub fn ensure_daemon(session: &str) -> Result<(), String> {
    if is_daemon_running(session) && daemon_ready(session) {
        return Ok(());
    }

    // Ensure socket directory exists
    let socket_dir = get_socket_dir();
    if !socket_dir.exists() {
        fs::create_dir_all(&socket_dir)
            .map_err(|e| format!("Failed to create socket directory: {}", e))?;
    }

    let daemon_path = find_daemon_js()?;

    // Spawn daemon as a fully detached background process
    {
        use std::os::unix::process::CommandExt;

        let mut cmd = Command::new("node");
        cmd.arg(&daemon_path)
            .env("DEBUG_BROWSER_DAEMON", "1")
            .env("DEBUG_BROWSER_SESSION", session);

        // Create new process group and session to fully detach
        // SAFETY: setsid() creates a new session, detaching from the terminal
        unsafe {
            cmd.pre_exec(|| {
                libc::setsid();
                Ok(())
            });
        }

        cmd.stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start daemon: {}", e))?;
    }

    // Poll for readiness up to 5 seconds (50 * 100ms)
    for _ in 0..50 {
        if daemon_ready(session) {
            return Ok(());
        }
        thread::sleep(Duration::from_millis(100));
    }

    Err("Daemon failed to start within 5 seconds".to_string())
}

/// Send a JSON command to the daemon and return the parsed response.
pub fn send_command(cmd: Value, session: &str) -> Result<Response, String> {
    let socket_path = get_socket_path(session);
    let mut stream = UnixStream::connect(&socket_path)
        .map_err(|e| format!("Failed to connect to daemon: {}", e))?;

    stream
        .set_read_timeout(Some(Duration::from_secs(30)))
        .ok();
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .ok();

    let mut json_str =
        serde_json::to_string(&cmd).map_err(|e| format!("Failed to serialize command: {}", e))?;
    json_str.push('\n');

    stream
        .write_all(json_str.as_bytes())
        .map_err(|e| format!("Failed to send command: {}", e))?;

    let mut reader = BufReader::new(stream);
    let mut response_line = String::new();
    reader
        .read_line(&mut response_line)
        .map_err(|e| format!("Failed to read response: {}", e))?;

    serde_json::from_str(&response_line)
        .map_err(|e| format!("Invalid response from daemon: {}", e))
}
