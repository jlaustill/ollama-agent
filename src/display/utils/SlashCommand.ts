/**
 * Slash command type definitions
 */

/**
 * Result of executing a slash command
 */
export type SlashCommandResult =
  | { type: "exit" } // Exit the application
  | { type: "continue" } // Continue normal operation
  | { type: "error"; message: string }; // Command failed

/**
 * Interface for a slash command
 */
export interface SlashCommand {
  /** Command name (without the /) */
  name: string;
  /** Description for help text */
  description: string;
  /** Execute the command */
  execute: () => SlashCommandResult;
}
