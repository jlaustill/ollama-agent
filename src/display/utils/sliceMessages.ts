/**
 * Pure function to slice messages array based on visible lines and scroll offset
 * Implements scrolling logic for the chat area with multi-line message support
 */

import type { Message } from "../types/Message";

/**
 * Estimates how many terminal lines a message will occupy when rendered
 *
 * @param message - The message to estimate
 * @param terminalWidth - Width of the terminal in characters
 * @returns Estimated number of lines this message will take
 */
const estimateMessageLines = (
  message: Message,
  terminalWidth: number,
): number => {
  // Account for padding and borders:
  // - paddingX={2} in message components = 4 chars (2 left, 2 right)
  // - User messages have "> " prefix = 2 chars
  // - Border and margins = ~2 chars
  const reservedWidth = message.role === "user" ? 8 : 6;
  const contentWidth = Math.max(1, terminalWidth - reservedWidth);

  // Split by newlines first (explicit line breaks)
  const lines = message.content.split("\n");

  // Calculate wrapped lines for each content line
  const totalLines = lines.reduce((acc, line) => {
    const wrappedLines = Math.ceil(Math.max(1, line.length) / contentWidth);
    return acc + wrappedLines;
  }, 0);

  return Math.max(1, totalLines);
};

/**
 * Slices the messages array to show only the visible messages based on terminal height
 * and scroll offset. Accounts for multi-line messages that wrap.
 *
 * @param messages - Full array of all messages
 * @param visibleLines - Number of lines available in the chat area (terminal height - top/bottom bars)
 * @param scrollOffset - How many messages to offset from the bottom (0 = latest messages, >0 = scrolled up)
 * @param terminalWidth - Width of the terminal for line wrapping calculations
 * @returns Sliced array of visible messages
 *
 * @example
 * // Show messages that fit in 20 lines (at bottom)
 * sliceMessages(messages, 20, 0, 80)
 *
 * @example
 * // Show messages scrolled up by 5 messages
 * sliceMessages(messages, 20, 5, 80)
 */
const sliceMessages = (
  messages: Message[],
  visibleLines: number,
  scrollOffset: number,
  terminalWidth: number,
): Message[] => {
  if (messages.length === 0) {
    return [];
  }

  // If no visible lines, return empty
  if (visibleLines === 0) {
    return [];
  }

  // If scrolled beyond all messages, return empty
  if (scrollOffset >= messages.length) {
    return [];
  }

  // Start from the end and work backwards, accumulating line counts
  const visibleMessages: Message[] = [];
  let accumulatedLines = 0;
  const startIndex = Math.max(0, messages.length - scrollOffset - 1);

  for (let i = startIndex; i >= 0; i -= 1) {
    const message = messages[i];
    if (message !== undefined) {
      const messageLines = estimateMessageLines(message, terminalWidth);

      // Check if adding this message would exceed visible lines
      if (
        accumulatedLines + messageLines > visibleLines &&
        visibleMessages.length > 0
      ) {
        // We've filled the screen, stop here
        break;
      }

      // Add this message to the visible list (prepend to maintain order)
      visibleMessages.unshift(message);
      accumulatedLines += messageLines;
    }
  }

  return visibleMessages;
};

export default sliceMessages;
