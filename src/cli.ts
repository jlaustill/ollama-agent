#!/usr/bin/env node
/**
 * CLI Entry Point - Console-based interface
 */

/* eslint-disable no-console, @typescript-eslint/require-await */

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import ConsoleInterface from "./display/ConsoleInterface";
import OllamaClient from "./data/models/OllamaClient";
import SimpleOrchestrator from "./domain/agent/SimpleOrchestrator";
import { createMessage } from "./display/types/Message";
import { log, clearLog } from "./utils/logger";

interface CliArguments {
  debug: boolean;
  cwd: string;
}

/**
 * Parse CLI arguments
 */
const parseArgs = (): CliArguments => {
  const argv = yargs(hideBin(process.argv))
    .option("debug", {
      alias: "d",
      type: "boolean",
      description: "Enable debug logging to file",
      default: false,
    })
    .option("cwd", {
      type: "string",
      description: "Working directory",
      default: process.cwd(),
    })
    .version("0.0.2") // Use built-in version handling
    .alias("v", "version")
    .help("h")
    .alias("h", "help")
    .parseSync();

  return {
    debug: argv.debug,
    cwd: argv.cwd,
  };
};

/**
 * Main application logic
 */
const main = async (): Promise<void> => {
  const args = parseArgs();

  // Clear debug log if debug mode enabled
  if (args.debug) {
    clearLog();
    log({ event: "SESSION_START", cwd: args.cwd, debug: args.debug });
  }

  // Initialize LLM client and orchestrator
  const ollamaClient = new OllamaClient();
  const orchestrator = new SimpleOrchestrator(ollamaClient, {
    model: "deepseek-coder-v2:16b",
  });

  // Create console interface
  const consoleInterface = new ConsoleInterface({
    cwd: args.cwd,
    model: "deepseek-coder-v2:16b",
    debugMode: args.debug,
    onInput: async (input: string): Promise<void> => {
      // Create user message
      const userMessage = createMessage("user", input);
      consoleInterface.displayUserMessage(userMessage);

      if (args.debug) {
        log({
          event: "MESSAGE_SENT",
          role: userMessage.role,
          content: userMessage.content,
          messageId: userMessage.id,
          timestamp: userMessage.timestamp,
        });
      }

      // Show thinking indicator
      consoleInterface.showThinking();

      // Process message
      const result = await orchestrator.processMessage(input);

      if (result.success) {
        // Create agent message
        const agentMessage = createMessage("agent", result.value);
        consoleInterface.displayAgentMessage(agentMessage);

        if (args.debug) {
          log({
            event: "MESSAGE_RECEIVED",
            role: agentMessage.role,
            content: agentMessage.content,
            messageId: agentMessage.id,
            timestamp: agentMessage.timestamp,
          });
        }
      } else {
        // Display error
        consoleInterface.displaySystemMessage(
          `Error: ${result.error.message}`,
          "error",
        );

        if (args.debug) {
          log({
            event: "ERROR",
            error: result.error.message,
            code: result.error.code,
            statusCode: result.error.statusCode,
          });
        }
      }
    },
    onExit: (): void => {
      if (args.debug) {
        log({ event: "SESSION_END" });
      }
      consoleInterface.close();
      process.exit(0);
    },
  });

  // Start the interface
  consoleInterface.start();
};

// Run main and handle errors
main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  console.error(`Fatal error: ${errorMessage}`);
  process.exit(1);
});
