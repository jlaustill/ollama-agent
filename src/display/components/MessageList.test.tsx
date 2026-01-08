import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import MessageList from "./MessageList";
import { createMessage } from "../types/Message";

describe("MessageList", () => {
  describe("Empty list", () => {
    it("should render without errors when messages array is empty", () => {
      const { lastFrame } = render(<MessageList messages={[]} />);

      expect(lastFrame()).toBeDefined();
    });

    it("should not render any messages for empty array", () => {
      const { lastFrame } = render(<MessageList messages={[]} />);

      // Should be minimal/empty output
      const frame = lastFrame();
      expect(frame).toBeDefined();
    });
  });

  describe("Single message", () => {
    it("should render a single user message", () => {
      const message = createMessage("user", "Hello, agent!");
      const { lastFrame } = render(<MessageList messages={[message]} />);

      expect(lastFrame()).toContain("Hello, agent!");
      expect(lastFrame()).toContain(">"); // User prompt
    });

    it("should render a single agent message", () => {
      const message = createMessage("agent", "Hello, user!");
      const { lastFrame } = render(<MessageList messages={[message]} />);

      expect(lastFrame()).toContain("Hello, user!");
    });

    it("should render a single system message", () => {
      const message = createMessage("system", "System initialized");
      const { lastFrame } = render(<MessageList messages={[message]} />);

      expect(lastFrame()).toContain("System initialized");
    });
  });

  describe("Multiple messages", () => {
    it("should render multiple messages in order", () => {
      const msg1 = createMessage("user", "First message");
      const msg2 = createMessage("agent", "Second message");
      const msg3 = createMessage("user", "Third message");

      const { lastFrame } = render(
        <MessageList messages={[msg1, msg2, msg3]} />,
      );

      const frame = lastFrame();
      expect(frame).toContain("First message");
      expect(frame).toContain("Second message");
      expect(frame).toContain("Third message");
    });

    it("should handle alternating user and agent messages", () => {
      const messages = [
        createMessage("user", "User 1"),
        createMessage("agent", "Agent 1"),
        createMessage("user", "User 2"),
        createMessage("agent", "Agent 2"),
      ];

      const { lastFrame } = render(<MessageList messages={messages} />);

      const frame = lastFrame();
      expect(frame).toContain("User 1");
      expect(frame).toContain("Agent 1");
      expect(frame).toContain("User 2");
      expect(frame).toContain("Agent 2");
    });

    it("should handle many messages", () => {
      const messages = Array.from({ length: 20 }, (_, i) =>
        createMessage("user", `Message ${i + 1}`),
      );

      const { lastFrame } = render(<MessageList messages={messages} />);

      const frame = lastFrame();
      expect(frame).toContain("Message 1");
      expect(frame).toContain("Message 20");
    });
  });

  describe("Message content", () => {
    it("should handle multi-line messages", () => {
      const message = createMessage("user", "Line 1\nLine 2\nLine 3");
      const { lastFrame } = render(<MessageList messages={[message]} />);

      const frame = lastFrame();
      expect(frame).toContain("Line 1");
      expect(frame).toContain("Line 2");
      expect(frame).toContain("Line 3");
    });

    it("should handle empty message content", () => {
      const message = createMessage("user", "");
      const { lastFrame } = render(<MessageList messages={[message]} />);

      expect(lastFrame()).toBeDefined();
    });

    it("should handle long message content", () => {
      const longContent = "A".repeat(200);
      const message = createMessage("agent", longContent);
      const { lastFrame } = render(<MessageList messages={[message]} />);

      expect(lastFrame()).toContain("A");
    });

    it("should handle special characters", () => {
      const specialChars = "!@#$%^&*()_+-=[]{}|;:'\",.<>?/~`";
      const message = createMessage("user", specialChars);
      const { lastFrame } = render(<MessageList messages={[message]} />);

      expect(lastFrame()).toBeDefined();
    });
  });

  describe("Message types", () => {
    it("should correctly render different message roles", () => {
      const userMsg = createMessage("user", "User message");
      const agentMsg = createMessage("agent", "Agent message");
      const systemMsg = createMessage("system", "System message");

      const { lastFrame } = render(
        <MessageList messages={[userMsg, agentMsg, systemMsg]} />,
      );

      const frame = lastFrame();
      expect(frame).toContain("User message");
      expect(frame).toContain("Agent message");
      expect(frame).toContain("System message");
    });
  });
});
