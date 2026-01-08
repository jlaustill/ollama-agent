/**
 * IChatMessage - Ollama API message format
 *
 * Represents a single message in a conversation.
 * Matches the Ollama /api/chat message structure.
 *
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md#generate-a-chat-completion
 */
interface IChatMessage {
  /**
   * Role of the message sender
   * - "system": System instructions/context
   * - "user": User input
   * - "assistant": Model response
   */
  role: "system" | "user" | "assistant";

  /**
   * Text content of the message
   */
  content: string;

  /**
   * Optional base64-encoded images (for multimodal models)
   * Not used in MVP but included for API completeness
   */
  images?: string[];
}

export default IChatMessage;
