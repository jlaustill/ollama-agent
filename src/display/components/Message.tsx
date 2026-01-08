/**
 * Message discriminator component - renders appropriate message type based on role
 */

import React from "react";
import type { Message as MessageType } from "../types/Message";
import UserMessage from "./UserMessage";
import AgentMessage from "./AgentMessage";

interface MessageProps {
  message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  switch (message.role) {
    case "user":
      return <UserMessage content={message.content} />;
    case "agent":
      return <AgentMessage content={message.content} />;
    case "system":
      return <AgentMessage content={message.content} />;
    default:
      // Exhaustive check - TypeScript ensures this never happens
      return null;
  }
};

export default Message;
