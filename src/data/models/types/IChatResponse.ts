/**
 * IChatResponse - Ollama /api/chat response payload
 *
 * Response structure from Ollama's chat completion endpoint.
 * For non-streaming requests (stream: false), this is the complete response.
 *
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion
 */

import type IChatMessage from "./IChatMessage";

interface IChatResponse {
  /**
   * Model name that generated the response
   */
  model: string;

  /**
   * Timestamp of response creation (ISO 8601 format)
   */
  created_at: string;

  /**
   * Assistant's response message
   */
  message: IChatMessage;

  /**
   * Whether generation is complete
   * Always true for non-streaming responses
   */
  done: boolean;

  /**
   * Generation metrics (optional, only when done: true)
   */
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export default IChatResponse;
