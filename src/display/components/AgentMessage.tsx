/**
 * Agent message component - displays messages from the agent or system
 */

import React from "react";
import { Box, Text } from "ink";

interface AgentMessageProps {
  content: string;
}

const AgentMessage: React.FC<AgentMessageProps> = ({ content }) => (
  <Box paddingX={2} paddingY={0}>
    <Text color="blue">{content}</Text>
  </Box>
);

export default AgentMessage;
