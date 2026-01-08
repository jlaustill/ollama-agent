/**
 * IChatRequest - Ollama /api/chat request payload
 *
 * Request structure for Ollama's chat completion endpoint.
 * For MVP, we use non-streaming mode (stream: false).
 *
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion
 */

import type IChatMessage from "./IChatMessage";

interface IChatRequest {
  /**
   * Model name to use for completion
   * @example "deepseek-coder-v2:16b"
   */
  model: string;

  /**
   * Conversation messages (system, user, assistant)
   */
  messages: IChatMessage[];

  /**
   * Enable/disable streaming responses
   * MVP uses false for synchronous responses
   */
  stream?: boolean;

  /**
   * Model-specific options (temperature, top_p, etc.)
   * Optional for MVP - uses model defaults
   */
  options?: {
    /**
     * Temperature (0.0 = deterministic, 1.0 = creative)
     * @default 0.8
     */
    temperature?: number;

    /**
     * Top-p sampling (nucleus sampling)
     * @default 0.9
     */
    top_p?: number;

    /**
     * Maximum tokens to generate
     * @default model-specific
     */
    num_predict?: number;
  };
}

export default IChatRequest;
