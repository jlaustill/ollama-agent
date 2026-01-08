/**
 * InputBar component - Sticky bottom input area for user text entry
 *
 * Handles:
 * - Keyboard input capture with useInput()
 * - Local input state for responsive typing
 * - Enter to submit (dispatches to context)
 * - Backspace to delete characters
 * - Slash command detection and execution
 */

import React, { useState, useMemo } from "react";
import { Box, Text, useInput, useApp } from "ink";
import { useAppContext } from "../context/AppContext";
import SlashCommandHandler from "../utils/SlashCommandHandler";
import ExitCommand from "../commands/ExitCommand";

const InputBar: React.FC = () => {
  const [localInput, setLocalInput] = useState("");
  const { dispatch } = useAppContext();
  const { exit } = useApp();

  // Initialize slash command handler (memoized to avoid recreating)
  const commandHandler = useMemo(() => {
    const handler = new SlashCommandHandler();
    handler.register(new ExitCommand());
    return handler;
  }, []);

  useInput((input, key) => {
    // Scroll handlers - MUST come first to prevent arrow keys from typing
    if (key.upArrow) {
      dispatch({ type: "SCROLL_UP", lines: 1 });
      return;
    }
    if (key.downArrow) {
      dispatch({ type: "SCROLL_DOWN", lines: 1 });
      return;
    }
    if (key.pageUp) {
      dispatch({ type: "SCROLL_UP", lines: 10 });
      return;
    }
    if (key.pageDown) {
      dispatch({ type: "SCROLL_DOWN", lines: 10 });
      return;
    }

    // Input handlers
    if (key.return) {
      // Enter key - submit input
      if (localInput.trim() !== "") {
        // Check if it's a slash command
        if (SlashCommandHandler.isSlashCommand(localInput)) {
          const result = commandHandler.execute(localInput);

          if (result.type === "exit") {
            // Exit the application
            exit();
            return;
          }

          if (result.type === "error") {
            // TODO: Display error message in chat
            // For now, just clear the input
            setLocalInput("");
            return;
          }

          // Command executed successfully, clear input
          setLocalInput("");
          return;
        }

        // Regular message - submit to context
        // Update context with the input text
        dispatch({ type: "UPDATE_INPUT", input: localInput });
        // Submit (creates message and clears context input)
        dispatch({ type: "SUBMIT_INPUT" });
        // Clear local input
        setLocalInput("");
      }
    } else if (key.backspace || key.delete) {
      // Backspace/Delete - remove last character
      setLocalInput((prev) => prev.slice(0, -1));
    } else if (!key.ctrl && !key.meta && input) {
      // Regular character - append to input
      setLocalInput((prev) => prev + input);
    }
  });

  return (
    <Box
      borderStyle="single"
      borderTop
      paddingX={1}
      flexDirection="row"
      width="100%"
    >
      <Text bold color="green">
        &gt;{" "}
      </Text>
      <Text>{localInput}</Text>
      <Text dimColor> █</Text>
    </Box>
  );
};

export default InputBar;
