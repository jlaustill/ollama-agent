/**
 * File-based logger for debugging TUI applications
 * Logs to ~/.local/share/ollama-agent/logs/debug.log since console.log is hidden by the TUI
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const LOG_DIR = path.join(
  os.homedir(),
  ".local",
  "share",
  "ollama-agent",
  "logs",
);
const LOG_FILE = path.join(LOG_DIR, "debug.log");
const MAX_LOG_SIZE = 1024 * 1024; // 1MB

/**
 * Ensures the log directory exists
 */
const ensureLogDir = (): void => {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
};

/**
 * Rotates the log file if it's too large
 */
const rotateLogIfNeeded = (): void => {
  try {
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > MAX_LOG_SIZE) {
      const backupFile = `${LOG_FILE}.old`;
      fs.renameSync(LOG_FILE, backupFile);
    }
  } catch (error) {
    // File doesn't exist yet, that's fine
  }
};

/**
 * Logs a message to the debug log file
 * @param message - Message to log (will be JSON stringified if object)
 */
export const log = (message: unknown): void => {
  ensureLogDir();
  rotateLogIfNeeded();

  const timestamp = new Date().toISOString();
  const logEntry =
    typeof message === "string"
      ? `[${timestamp}] ${message}\n`
      : `[${timestamp}] ${JSON.stringify(message, null, 2)}\n`;

  fs.appendFileSync(LOG_FILE, logEntry);
};

/**
 * Clears the debug log file
 */
export const clearLog = (): void => {
  ensureLogDir();
  fs.writeFileSync(LOG_FILE, "");
};

/**
 * Gets the path to the debug log file
 */
export const getLogPath = (): string => LOG_FILE;

/**
 * Logs a message with a label
 * @param label - Label for the log entry
 * @param data - Data to log
 */
export const logWithLabel = (label: string, data: unknown): void => {
  log({ [label]: data });
};
