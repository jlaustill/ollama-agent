/**
 * useTerminalSize hook - Get current terminal dimensions
 *
 * Uses Ink's useStdout() to access terminal size in a reactive way.
 * Automatically updates when terminal is resized.
 */

import { useStdout } from "ink";

/**
 * Returns the current terminal height in rows
 *
 * @returns Terminal height (number of rows), or undefined if not available
 */
export const useTerminalSize = (): number | undefined => {
  const { stdout } = useStdout();

  // stdout.rows may be undefined if not running in a TTY
  return stdout?.rows;
};

/**
 * Returns the current terminal height with a fallback default
 *
 * @param defaultHeight - Default height if terminal size is unavailable (default: 24)
 * @returns Terminal height or default value
 */
export const useTerminalSizeWithDefault = (
  defaultHeight: number = 24,
): number => {
  const height = useTerminalSize();
  return height ?? defaultHeight;
};
