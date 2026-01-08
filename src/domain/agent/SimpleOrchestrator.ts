/**
 * SimpleOrchestrator - Minimal orchestrator for single-message chat
 *
 * Responsibilities:
 * - Format user message for Ollama API
 * - Call OllamaClient with configured model
 * - Extract assistant response
 * - NO conversation history (MVP constraint)
 * - NO tool execution (future work)
 * - NO plan management (future work)
 *
 * @example
 * ```typescript
 * const client = new OllamaClient();
 * const orchestrator = new SimpleOrchestrator(client, {
 *   model: 'deepseek-coder-v2:16b'
 * });
 *
 * const result = await orchestrator.processMessage('Hello!');
 * if (result.success) {
 *   console.log(result.value); // "Hi there! How can I help?"
 * }
 * ```
 */

import type TResult from "../../shared/types/TResult";
import type OllamaError from "../../shared/errors/OllamaError";
import type OllamaClient from "../../data/models/OllamaClient";
import type IChatMessage from "../../data/models/types/IChatMessage";

interface SimpleOrchestratorConfig {
  /**
   * Model to use for completions
   * @default "deepseek-coder-v2:16b"
   */
  model?: string;

  /**
   * System prompt for model behavior
   * @default undefined (no system prompt)
   */
  systemPrompt?: string;
}

export default class SimpleOrchestrator {
  private readonly ollamaClient: OllamaClient;

  private readonly model: string;

  private readonly systemPrompt?: string;

  /**
   * Create a new SimpleOrchestrator
   *
   * @param ollamaClient - Injected OllamaClient instance
   * @param config - Optional configuration (model, systemPrompt)
   */
  constructor(
    ollamaClient: OllamaClient,
    config: SimpleOrchestratorConfig = {},
  ) {
    this.ollamaClient = ollamaClient;
    this.model = config.model ?? "deepseek-coder-v2:16b";
    this.systemPrompt = config.systemPrompt;
  }

  /**
   * Process a user message and get assistant response
   *
   * MVP: Single message (no conversation history)
   *
   * @param userMessage - User's input text
   * @returns Result with assistant response text on success, OllamaError on failure
   */
  async processMessage(
    userMessage: string,
  ): Promise<TResult<string, OllamaError>> {
    // Build messages array
    const messages: IChatMessage[] = [];

    // Add system prompt if configured
    if (this.systemPrompt) {
      messages.push({
        role: "system",
        content: this.systemPrompt,
      });
    }

    // Add user message
    messages.push({
      role: "user",
      content: userMessage,
    });

    // Call Ollama API
    const result = await this.ollamaClient.chat({
      model: this.model,
      messages,
      stream: false,
    });

    // Transform result: extract assistant response text
    if (result.success) {
      return {
        success: true,
        value: result.value.message.content,
      };
    }

    // Pass error through
    return {
      success: false,
      error: result.error,
    };
  }
}
