/**
 * User message component - displays messages from the user
 */

import React from "react";
import { Box, Text } from "ink";

interface UserMessageProps {
  content: string;
}

const UserMessage: React.FC<UserMessageProps> = ({ content }) => (
  <Box paddingX={2} paddingY={0}>
    <Text bold color="green">
      &gt;{" "}
    </Text>
    <Text>{content}</Text>
  </Box>
);

export default UserMessage;
