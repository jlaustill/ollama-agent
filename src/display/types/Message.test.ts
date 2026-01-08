import { describe, it, expect, beforeEach, vi } from "vitest";
import { createMessage } from "./Message";
import type { MessageRole } from "./Message";

describe("Message", () => {
  beforeEach(() => {
    // Reset Date.now() mock between tests
    vi.restoreAllMocks();
  });

  describe("createMessage", () => {
    it("should create a user message with correct properties", () => {
      const role: MessageRole = "user";
      const content = "Hello, agent!";

      const message = createMessage(role, content);

      expect(message.role).toBe("user");
      expect(message.content).toBe("Hello, agent!");
      expect(message.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ); // UUID v4 regex
      expect(message.timestamp).toBeTypeOf("number");
      expect(message.timestamp).toBeGreaterThan(0);
    });

    it("should create an agent message with correct properties", () => {
      const role: MessageRole = "agent";
      const content = "I can help with that.";

      const message = createMessage(role, content);

      expect(message.role).toBe("agent");
      expect(message.content).toBe("I can help with that.");
    });

    it("should create a system message with correct properties", () => {
      const role: MessageRole = "system";
      const content = "System notification";

      const message = createMessage(role, content);

      expect(message.role).toBe("system");
      expect(message.content).toBe("System notification");
    });

    it("should generate unique IDs for each message", () => {
      const message1 = createMessage("user", "First");
      const message2 = createMessage("user", "Second");

      expect(message1.id).not.toBe(message2.id);
    });

    it("should generate increasing timestamps", () => {
      const before = Date.now();
      const message = createMessage("user", "Test");
      const after = Date.now();

      expect(message.timestamp).toBeGreaterThanOrEqual(before);
      expect(message.timestamp).toBeLessThanOrEqual(after);
    });

    it("should handle empty content strings", () => {
      const message = createMessage("user", "");

      expect(message.content).toBe("");
      expect(message.id).toBeDefined();
      expect(message.timestamp).toBeGreaterThan(0);
    });

    it("should handle multi-line content", () => {
      const multilineContent = "Line 1\nLine 2\nLine 3";
      const message = createMessage("agent", multilineContent);

      expect(message.content).toBe(multilineContent);
    });
  });
});
