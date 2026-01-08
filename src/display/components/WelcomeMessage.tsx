/**
 * Welcome message component displayed when chat is empty
 */

import React from "react";
import { Box, Text } from "ink";

const WelcomeMessage: React.FC = () => (
  <Box flexDirection="column" paddingX={2} paddingY={1}>
    <Text bold color="cyan">
      Welcome to ollama-agent v2
    </Text>
    <Text dimColor>Type your message and press Enter to begin.</Text>
  </Box>
);

export default WelcomeMessage;
