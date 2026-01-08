/**
 * ExitCommand - Cleanly exit the application
 */

import type { SlashCommand, SlashCommandResult } from "../utils/SlashCommand";

/**
 * Command to exit the application
 */
export default class ExitCommand implements SlashCommand {
  name = "exit";

  description = "Exit the application";

  // eslint-disable-next-line class-methods-use-this
  execute(): SlashCommandResult {
    return { type: "exit" };
  }
}
