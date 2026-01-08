/**
 * Message types for the TUI chat interface
 */

export type MessageRole = "user" | "agent" | "system";

export interface Message {
  id: string; // UUIDv4
  role: MessageRole;
  content: string;
  timestamp: number; // Unix timestamp in milliseconds
}

/**
 * Factory function to create a new message with auto-generated ID and timestamp
 */
export const createMessage = (role: MessageRole, content: string): Message => ({
  id: crypto.randomUUID(),
  role,
  content,
  timestamp: Date.now(),
});
