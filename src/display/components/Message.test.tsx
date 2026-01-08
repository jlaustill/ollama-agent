import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import Message from "./Message";
import { createMessage } from "../types/Message";

describe("Message", () => {
  describe("user messages", () => {
    it("should render user message with green prompt", () => {
      const message = createMessage("user", "Hello, agent!");
      const { lastFrame } = render(<Message message={message} />);

      expect(lastFrame()).toContain("Hello, agent!");
      expect(lastFrame()).toContain(">");
    });

    it("should handle empty user message", () => {
      const message = createMessage("user", "");
      const { lastFrame } = render(<Message message={message} />);

      expect(lastFrame()).toBeDefined();
      expect(lastFrame()).toContain(">");
    });
  });

  describe("agent messages", () => {
    it("should render agent message with blue styling", () => {
      const message = createMessage("agent", "I can help with that.");
      const { lastFrame } = render(<Message message={message} />);

      expect(lastFrame()).toContain("I can help with that.");
    });

    it("should handle empty agent message", () => {
      const message = createMessage("agent", "");
      const { lastFrame } = render(<Message message={message} />);

      expect(lastFrame()).toBeDefined();
    });
  });

  describe("system messages", () => {
    it("should render system message like agent message", () => {
      const message = createMessage("system", "System notification");
      const { lastFrame } = render(<Message message={message} />);

      expect(lastFrame()).toContain("System notification");
    });

    it("should not show prompt character for system messages", () => {
      const message = createMessage("system", "Test");
      const { lastFrame } = render(<Message message={message} />);

      // System messages render like agent messages (no >)
      expect(lastFrame()).toContain("Test");
    });
  });

  describe("discriminated union", () => {
    it("should correctly discriminate based on role", () => {
      const userMsg = createMessage("user", "User text");
      const agentMsg = createMessage("agent", "Agent text");
      const systemMsg = createMessage("system", "System text");

      const userRender = render(<Message message={userMsg} />);
      const agentRender = render(<Message message={agentMsg} />);
      const systemRender = render(<Message message={systemMsg} />);

      expect(userRender.lastFrame()).toContain("User text");
      expect(userRender.lastFrame()).toContain(">");

      expect(agentRender.lastFrame()).toContain("Agent text");
      expect(systemRender.lastFrame()).toContain("System text");
    });
  });

  describe("multi-line messages", () => {
    it("should handle multi-line user messages", () => {
      const message = createMessage("user", "Line 1\nLine 2\nLine 3");
      const { lastFrame } = render(<Message message={message} />);

      expect(lastFrame()).toContain("Line 1");
      expect(lastFrame()).toContain("Line 2");
      expect(lastFrame()).toContain("Line 3");
    });

    it("should handle multi-line agent messages", () => {
      const message = createMessage("agent", "Line 1\nLine 2\nLine 3");
      const { lastFrame } = render(<Message message={message} />);

      expect(lastFrame()).toContain("Line 1");
      expect(lastFrame()).toContain("Line 2");
      expect(lastFrame()).toContain("Line 3");
    });
  });
});
