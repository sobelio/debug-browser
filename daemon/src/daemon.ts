import * as net from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { BrowserManager } from './browser.js';
import { parseCommand, serializeResponse, errorResponse } from './protocol.js';
import { executeCommand } from './actions.js';

// Session support - each session gets its own socket/pid
let currentSession = process.env.DEBUG_BROWSER_SESSION || 'default';

/**
 * Set the current session
 */
export function setSession(session: string): void {
  currentSession = session;
}

/**
 * Get the current session
 */
export function getSession(): string {
  return currentSession;
}

/**
 * Get the base directory for socket/pid files.
 * Priority: DEBUG_BROWSER_SOCKET_DIR > XDG_RUNTIME_DIR > ~/.debug-browser > tmpdir
 */
export function getSocketDir(): string {
  // 1. Explicit override
  if (process.env.DEBUG_BROWSER_SOCKET_DIR) {
    return process.env.DEBUG_BROWSER_SOCKET_DIR;
  }

  // 2. XDG_RUNTIME_DIR (Linux standard)
  if (process.env.XDG_RUNTIME_DIR) {
    return path.join(process.env.XDG_RUNTIME_DIR, 'debug-browser');
  }

  // 3. Home directory fallback
  const homeDir = os.homedir();
  if (homeDir) {
    return path.join(homeDir, '.debug-browser');
  }

  // 4. Last resort: temp dir
  return path.join(os.tmpdir(), 'debug-browser');
}

/**
 * Get the socket path for the current session (Unix domain socket)
 */
export function getSocketPath(session?: string): string {
  const sess = session ?? currentSession;
  return path.join(getSocketDir(), `${sess}.sock`);
}

/**
 * Get the PID file path for the current session
 */
export function getPidFile(session?: string): string {
  const sess = session ?? currentSession;
  return path.join(getSocketDir(), `${sess}.pid`);
}

/**
 * Check if daemon is running for the current session
 */
export function isDaemonRunning(session?: string): boolean {
  const pidFile = getPidFile(session);
  if (!fs.existsSync(pidFile)) return false;

  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
    // Check if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    // Process doesn't exist, clean up stale files
    cleanupSocket(session);
    return false;
  }
}

/**
 * Get connection info for the current session
 */
export function getConnectionInfo(
  session?: string
): { type: 'unix'; path: string } {
  const sess = session ?? currentSession;
  return { type: 'unix', path: path.join(getSocketDir(), `${sess}.sock`) };
}

/**
 * Clean up socket and PID file for the current session
 */
export function cleanupSocket(session?: string): void {
  const pidFile = getPidFile(session);
  try {
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
    const socketPath = getSocketPath(session);
    if (fs.existsSync(socketPath)) fs.unlinkSync(socketPath);
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Start the daemon server
 */
export async function startDaemon(): Promise<void> {
  // Ensure socket directory exists
  const socketDir = getSocketDir();
  if (!fs.existsSync(socketDir)) {
    fs.mkdirSync(socketDir, { recursive: true });
  }

  // Clean up any stale socket
  cleanupSocket();

  const browser = new BrowserManager();
  let shuttingDown = false;

  const server = net.createServer((socket) => {
    let buffer = '';

    socket.on('data', async (data) => {
      buffer += data.toString();

      // Process complete lines
      while (buffer.includes('\n')) {
        const newlineIdx = buffer.indexOf('\n');
        const line = buffer.substring(0, newlineIdx);
        buffer = buffer.substring(newlineIdx + 1);

        if (!line.trim()) continue;

        try {
          const parseResult = parseCommand(line);

          if (!parseResult.success) {
            const resp = errorResponse(parseResult.id ?? 'unknown', parseResult.error);
            socket.write(serializeResponse(resp) + '\n');
            continue;
          }

          // Auto-launch browser if not already launched and this isn't a launch command
          if (
            !browser.isLaunched() &&
            parseResult.command.action !== 'launch' &&
            parseResult.command.action !== 'close'
          ) {
            await browser.launch({
              id: 'auto',
              action: 'launch' as const,
              headless: process.env.DEBUG_BROWSER_HEADED !== '1',
            });
          }

          // Handle close command specially
          if (parseResult.command.action === 'close') {
            const response = await executeCommand(parseResult.command, browser);
            socket.write(serializeResponse(response) + '\n');

            if (!shuttingDown) {
              shuttingDown = true;
              setTimeout(() => {
                server.close();
                cleanupSocket();
                process.exit(0);
              }, 100);
            }
            return;
          }

          const response = await executeCommand(parseResult.command, browser);
          socket.write(serializeResponse(response) + '\n');
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          socket.write(serializeResponse(errorResponse('error', message)) + '\n');
        }
      }
    });

    socket.on('error', () => {
      // Client disconnected, ignore
    });
  });

  const pidFile = getPidFile();

  // Write PID file before listening
  fs.writeFileSync(pidFile, process.pid.toString());

  // Unix domain socket
  const socketPath = getSocketPath();
  server.listen(socketPath, () => {
    // Daemon is ready
  });

  server.on('error', (err) => {
    console.error('Server error:', err);
    cleanupSocket();
    process.exit(1);
  });

  // Handle shutdown signals
  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;

    await browser.close();
    server.close();
    cleanupSocket();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('SIGHUP', shutdown);

  // Handle unexpected errors - always cleanup
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    cleanupSocket();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    cleanupSocket();
    process.exit(1);
  });

  // Cleanup on normal exit
  process.on('exit', () => {
    cleanupSocket();
  });

  // Keep process alive
  process.stdin.resume();
}

// Run daemon if this is the entry point
if (process.argv[1]?.endsWith('daemon.js') || process.env.DEBUG_BROWSER_DAEMON === '1') {
  startDaemon().catch((err) => {
    console.error('Daemon error:', err);
    cleanupSocket();
    process.exit(1);
  });
}
