/**
 * Pure function to slice messages array based on visible lines and scroll offset
 * Implements scrolling logic for the chat area
 */

import type { Message } from "../types/Message";

/**
 * Slices the messages array to show only the visible messages based on terminal height
 * and scroll offset.
 *
 * @param messages - Full array of all messages
 * @param visibleLines - Number of lines available in the chat area (terminal height - top/bottom bars)
 * @param scrollOffset - How many messages to offset from the bottom (0 = latest messages, >0 = scrolled up)
 * @returns Sliced array of visible messages
 *
 * @example
 * // Show last 10 messages (at bottom)
 * sliceMessages(messages, 10, 0)
 *
 * @example
 * // Show messages 10-20 from the end (scrolled up by 10)
 * sliceMessages(messages, 10, 10)
 */
const sliceMessages = (
  messages: Message[],
  visibleLines: number,
  scrollOffset: number,
): Message[] => {
  if (messages.length === 0) {
    return [];
  }

  // Calculate end index (where to slice to)
  const endIndex = messages.length - scrollOffset;

  // Calculate start index (ensure we don't go below 0)
  const startIndex = Math.max(0, endIndex - visibleLines);

  return messages.slice(startIndex, endIndex);
};

export default sliceMessages;
