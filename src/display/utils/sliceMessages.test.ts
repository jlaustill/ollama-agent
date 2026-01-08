import { describe, it, expect } from "vitest";
import sliceMessages from "./sliceMessages";
import { createMessage } from "../types/Message";
import type { Message } from "../types/Message";

describe("sliceMessages", () => {
  describe("empty messages", () => {
    it("should return empty array when messages array is empty", () => {
      const result = sliceMessages([], 10, 0);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });

  describe("at bottom (scrollOffset = 0)", () => {
    it("should return last N messages when offset is 0", () => {
      const messages: Message[] = [
        createMessage("user", "Message 1"),
        createMessage("agent", "Response 1"),
        createMessage("user", "Message 2"),
        createMessage("agent", "Response 2"),
        createMessage("user", "Message 3"),
      ];

      const result = sliceMessages(messages, 2, 0);

      expect(result).toHaveLength(2);
      expect(result[0]?.content).toBe("Response 2");
      expect(result[1]?.content).toBe("Message 3");
    });

    it("should return all messages if visibleLines >= message count", () => {
      const messages: Message[] = [
        createMessage("user", "Message 1"),
        createMessage("agent", "Response 1"),
        createMessage("user", "Message 2"),
      ];

      const result = sliceMessages(messages, 10, 0);

      expect(result).toHaveLength(3);
      expect(result).toEqual(messages);
    });

    it("should return exactly visibleLines messages when available", () => {
      const messages: Message[] = Array.from({ length: 20 }, (_, i) =>
        createMessage("user", `Message ${i + 1}`),
      );

      const result = sliceMessages(messages, 5, 0);

      expect(result).toHaveLength(5);
      expect(result[0]?.content).toBe("Message 16");
      expect(result[4]?.content).toBe("Message 20");
    });
  });

  describe("scrolled up (scrollOffset > 0)", () => {
    it("should return earlier messages when scrolled up", () => {
      const messages: Message[] = [
        createMessage("user", "Message 1"),
        createMessage("agent", "Response 1"),
        createMessage("user", "Message 2"),
        createMessage("agent", "Response 2"),
        createMessage("user", "Message 3"),
      ];

      const result = sliceMessages(messages, 2, 1); // Scroll up 1

      expect(result).toHaveLength(2);
      expect(result[0]?.content).toBe("Message 2");
      expect(result[1]?.content).toBe("Response 2");
    });

    it("should handle large scroll offset", () => {
      const messages: Message[] = [
        createMessage("user", "Message 1"),
        createMessage("agent", "Response 1"),
        createMessage("user", "Message 2"),
        createMessage("agent", "Response 2"),
        createMessage("user", "Message 3"),
      ];

      const result = sliceMessages(messages, 2, 3); // Scroll up 3

      expect(result).toHaveLength(2);
      expect(result[0]?.content).toBe("Message 1");
      expect(result[1]?.content).toBe("Response 1");
    });

    it("should handle scroll offset larger than message count", () => {
      const messages: Message[] = [
        createMessage("user", "Message 1"),
        createMessage("agent", "Response 1"),
      ];

      const result = sliceMessages(messages, 2, 10); // Scroll way up

      // Should show first messages (can't scroll beyond start)
      expect(result).toHaveLength(0);
    });
  });

  describe("edge cases", () => {
    it("should handle visibleLines = 0", () => {
      const messages: Message[] = [
        createMessage("user", "Message 1"),
        createMessage("agent", "Response 1"),
      ];

      const result = sliceMessages(messages, 0, 0);

      expect(result).toHaveLength(0);
    });

    it("should handle visibleLines = 1", () => {
      const messages: Message[] = [
        createMessage("user", "Message 1"),
        createMessage("agent", "Response 1"),
        createMessage("user", "Message 2"),
      ];

      const result = sliceMessages(messages, 1, 0);

      expect(result).toHaveLength(1);
      expect(result[0]?.content).toBe("Message 2");
    });

    it("should handle single message", () => {
      const messages: Message[] = [createMessage("user", "Single message")];

      const result = sliceMessages(messages, 10, 0);

      expect(result).toHaveLength(1);
      expect(result[0]?.content).toBe("Single message");
    });

    it("should not mutate original messages array", () => {
      const messages: Message[] = [
        createMessage("user", "Message 1"),
        createMessage("agent", "Response 1"),
        createMessage("user", "Message 2"),
      ];
      const originalLength = messages.length;
      const originalFirst = messages[0];

      sliceMessages(messages, 2, 0);

      expect(messages).toHaveLength(originalLength);
      expect(messages[0]).toBe(originalFirst);
    });
  });

  describe("scrolling scenarios", () => {
    it("should show middle section when scrolled to middle", () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) =>
        createMessage("user", `Message ${i + 1}`),
      );

      // Show 3 messages, scroll up 3 (should show messages 5-7)
      const result = sliceMessages(messages, 3, 3);

      expect(result).toHaveLength(3);
      expect(result[0]?.content).toBe("Message 5");
      expect(result[1]?.content).toBe("Message 6");
      expect(result[2]?.content).toBe("Message 7");
    });

    it("should show first messages when scrolled to top", () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) =>
        createMessage("user", `Message ${i + 1}`),
      );

      // Show 3 messages, scroll up 7 (should show messages 1-3)
      const result = sliceMessages(messages, 3, 7);

      expect(result).toHaveLength(3);
      expect(result[0]?.content).toBe("Message 1");
      expect(result[1]?.content).toBe("Message 2");
      expect(result[2]?.content).toBe("Message 3");
    });

    it("should handle terminal resize (more visible lines)", () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) =>
        createMessage("user", `Message ${i + 1}`),
      );

      // Increase visible lines from 3 to 5
      const before = sliceMessages(messages, 3, 0);
      const after = sliceMessages(messages, 5, 0);

      expect(before).toHaveLength(3);
      expect(after).toHaveLength(5);
      expect(after[4]?.content).toBe("Message 10"); // Both should end at latest
    });

    it("should handle terminal resize (fewer visible lines)", () => {
      const messages: Message[] = Array.from({ length: 10 }, (_, i) =>
        createMessage("user", `Message ${i + 1}`),
      );

      // Decrease visible lines from 5 to 3
      const before = sliceMessages(messages, 5, 0);
      const after = sliceMessages(messages, 3, 0);

      expect(before).toHaveLength(5);
      expect(after).toHaveLength(3);
      expect(after[2]?.content).toBe("Message 10"); // Both should end at latest
    });
  });
});
