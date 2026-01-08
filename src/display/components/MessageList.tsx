/**
 * MessageList component - Renders a list of messages
 */

import React from "react";
import { Box } from "ink";
import type { Message as MessageType } from "../types/Message";
import Message from "./Message";

interface MessageListProps {
  messages: MessageType[];
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => (
  <Box flexDirection="column">
    {messages.map((message) => (
      <Message key={message.id} message={message} />
    ))}
  </Box>
);

export default MessageList;
