/**
 * Simple console-based interface for the agent
 * Replaces React/Ink TUI with basic readline + console.log
 */

/* eslint-disable no-console */

import * as readline from "readline";
import type { Message } from "./types/Message";
import { log } from "../utils/logger";

interface ConsoleInterfaceConfig {
  cwd: string;
  model: string;
  debugMode: boolean;
  onInput: (input: string) => Promise<void>;
  onExit: () => void;
}

/**
 * ConsoleInterface - Simple console I/O handler
 */
class ConsoleInterface {
  private rl: readline.Interface;

  private config: ConsoleInterfaceConfig;

  private isProcessing = false;

  constructor(config: ConsoleInterfaceConfig) {
    this.config = config;

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "> ",
    });

    // Setup line handler
    this.rl.on("line", (line: string) => {
      this.handleInput(line).catch((error: unknown) => {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`Error: ${errorMessage}`);
        this.prompt();
      });
    });

    // Handle Ctrl+C
    this.rl.on("SIGINT", () => {
      console.log("\nExiting...");
      this.config.onExit();
    });
  }

  /**
   * Print header with current status
   */
  private printHeader(): void {
    console.log("─────────────────────────────────────");
    console.log(`CWD: ${this.config.cwd}`);
    console.log(`Model: ${this.config.model}`);
    if (this.config.debugMode) {
      console.log(`Debug: ON`);
    }
    console.log("─────────────────────────────────────");
    console.log();
  }

  /**
   * Handle user input
   */
  private async handleInput(input: string): Promise<void> {
    const trimmed = input.trim();

    // Ignore empty input
    if (trimmed === "") {
      this.prompt();
      return;
    }

    // Check for exit command
    if (trimmed === "/exit") {
      console.log("Exiting...");
      this.config.onExit();
      return;
    }

    // Prevent multiple simultaneous requests
    if (this.isProcessing) {
      console.log("Still processing previous message...");
      this.prompt();
      return;
    }

    this.isProcessing = true;

    if (this.config.debugMode) {
      log({ event: "USER_INPUT", input: trimmed });
    }

    // Call the input handler
    await this.config.onInput(trimmed);

    this.isProcessing = false;

    // Print header and prompt for next input
    this.printHeader();
    this.prompt();
  }

  /**
   * Display a user message
   */
  // eslint-disable-next-line class-methods-use-this
  displayUserMessage(message: Message): void {
    console.log(`USER: ${message.content}`);
    console.log();
  }

  /**
   * Display an agent message
   */
  // eslint-disable-next-line class-methods-use-this
  displayAgentMessage(message: Message): void {
    console.log(`AGENT: ${message.content}`);
    console.log();
  }

  /**
   * Display system message (errors, status)
   */
  // eslint-disable-next-line class-methods-use-this
  displaySystemMessage(content: string, type: "info" | "error" = "info"): void {
    if (type === "error") {
      console.error(`ERROR: ${content}`);
    } else {
      console.log(`[${content}]`);
    }
    console.log();
  }

  /**
   * Show thinking indicator
   */
  // eslint-disable-next-line class-methods-use-this
  showThinking(): void {
    console.log("Thinking...");
  }

  /**
   * Start the interface
   */
  start(): void {
    console.log("Welcome to Ollama Agent!");
    console.log("Type /exit to quit, or start chatting.");
    console.log();
    this.printHeader();
    this.prompt();
  }

  /**
   * Show prompt for next input
   */
  private prompt(): void {
    this.rl.prompt();
  }

  /**
   * Close the interface
   */
  close(): void {
    this.rl.close();
  }
}

export default ConsoleInterface;
