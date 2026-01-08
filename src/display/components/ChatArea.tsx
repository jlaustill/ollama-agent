/**
 * ChatArea component - Scrolling chat area that displays messages
 *
 * Orchestrates:
 * - Context consumption for messages and scroll state
 * - Terminal size detection
 * - Message slicing for scrolling
 * - Conditional rendering of welcome vs messages
 */

import React from "react";
import { Box, useStdout } from "ink";
import { useAppContext } from "../context/AppContext";
import { useTerminalSizeWithDefault } from "../hooks/useTerminalSize";
import sliceMessages from "../utils/sliceMessages";
import WelcomeMessage from "./WelcomeMessage";
import MessageList from "./MessageList";

/**
 * Reserved lines for UI chrome
 * - TopBar: ~2 lines (with border)
 * - InputBar: ~2 lines (with border)
 */
const RESERVED_LINES = 4;

/**
 * ChatArea - Displays scrollable message history
 */
const ChatArea: React.FC = () => {
  const { state } = useAppContext();
  const { stdout } = useStdout();
  const terminalHeight = useTerminalSizeWithDefault(24);
  const terminalWidth = stdout?.columns ?? 80;

  // Calculate visible area for messages
  const visibleLines = Math.max(1, terminalHeight - RESERVED_LINES);

  // Get visible messages based on scroll offset and terminal dimensions
  const visibleMessages = sliceMessages(
    state.messages,
    visibleLines,
    state.scrollOffset,
    terminalWidth,
  );

  return (
    <Box width="100%" flexGrow={1} flexDirection="column">
      {state.messages.length === 0 ? (
        <WelcomeMessage />
      ) : (
        <MessageList messages={visibleMessages} />
      )}
    </Box>
  );
};

export default ChatArea;
