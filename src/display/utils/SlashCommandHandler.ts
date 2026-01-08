/**
 * SlashCommandHandler - Manages and executes slash commands
 *
 * Handles:
 * - Command registration
 * - Input parsing to detect slash commands
 * - Command execution
 * - Error handling for unknown commands
 */

import type { SlashCommand, SlashCommandResult } from "./SlashCommand";

/**
 * Manages slash commands in the TUI
 */
export default class SlashCommandHandler {
  private commands: Map<string, SlashCommand>;

  constructor() {
    this.commands = new Map();
  }

  /**
   * Register a slash command
   * @param command - The command to register
   */
  register(command: SlashCommand): void {
    this.commands.set(command.name, command);
  }

  /**
   * Check if input is a slash command
   * @param input - User input string
   * @returns True if input starts with /
   */
  static isSlashCommand(input: string): boolean {
    return input.trim().startsWith("/");
  }

  /**
   * Parse and execute a slash command
   * @param input - User input string (should start with /)
   * @returns Result of command execution
   */
  execute(input: string): SlashCommandResult {
    const trimmedInput = input.trim();

    // Extract command name (remove / and get first word)
    const commandName = trimmedInput.slice(1).split(/\s+/)[0];

    if (!commandName) {
      return {
        type: "error",
        message: "Empty command. Type /help for available commands.",
      };
    }

    const command = this.commands.get(commandName);

    if (!command) {
      return {
        type: "error",
        message: `Unknown command: /${commandName}. Type /help for available commands.`,
      };
    }

    return command.execute();
  }

  /**
   * Get all registered commands
   * @returns Array of all commands
   */
  getCommands(): SlashCommand[] {
    return Array.from(this.commands.values());
  }
}
