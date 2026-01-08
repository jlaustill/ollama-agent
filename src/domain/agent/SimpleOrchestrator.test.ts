/**
 * SimpleOrchestrator.test.ts - Unit tests for SimpleOrchestrator
 *
 * Tests business logic with mocked OllamaClient.
 * Verifies message formatting, system prompt handling, error propagation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import SimpleOrchestrator from "./SimpleOrchestrator";
import OllamaError from "../../shared/errors/OllamaError";
import type OllamaClient from "../../data/models/OllamaClient";
import type IChatResponse from "../../data/models/types/IChatResponse";

describe("SimpleOrchestrator", () => {
  let mockOllamaClient: {
    chat: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockOllamaClient = {
      chat: vi.fn(),
    };
  });

  describe("processMessage()", () => {
    it("should process user message and return assistant response", async () => {
      // Arrange
      const mockResponse: IChatResponse = {
        model: "deepseek-coder-v2:16b",
        created_at: "2024-01-01T00:00:00Z",
        message: {
          role: "assistant",
          content: "Hello! How can I help you today?",
        },
        done: true,
      };

      mockOllamaClient.chat.mockResolvedValue({
        success: true,
        value: mockResponse,
      });

      const orchestrator = new SimpleOrchestrator(
        mockOllamaClient as unknown as OllamaClient,
      );

      // Act
      const result = await orchestrator.processMessage("Hello!");

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe("Hello! How can I help you today?");
      }

      // Verify OllamaClient was called correctly
      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: "deepseek-coder-v2:16b",
        messages: [{ role: "user", content: "Hello!" }],
        stream: false,
      });
    });

    it("should use custom model when specified in config", async () => {
      // Arrange
      const mockResponse: IChatResponse = {
        model: "llama3:8b",
        created_at: "2024-01-01T00:00:00Z",
        message: { role: "assistant", content: "Response" },
        done: true,
      };

      mockOllamaClient.chat.mockResolvedValue({
        success: true,
        value: mockResponse,
      });

      const orchestrator = new SimpleOrchestrator(
        mockOllamaClient as unknown as OllamaClient,
        { model: "llama3:8b" },
      );

      // Act
      await orchestrator.processMessage("Test");

      // Assert
      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: "llama3:8b",
        messages: [{ role: "user", content: "Test" }],
        stream: false,
      });
    });

    it("should include system prompt when configured", async () => {
      // Arrange
      const mockResponse: IChatResponse = {
        model: "deepseek-coder-v2:16b",
        created_at: "2024-01-01T00:00:00Z",
        message: { role: "assistant", content: "Sure!" },
        done: true,
      };

      mockOllamaClient.chat.mockResolvedValue({
        success: true,
        value: mockResponse,
      });

      const orchestrator = new SimpleOrchestrator(
        mockOllamaClient as unknown as OllamaClient,
        {
          systemPrompt: "You are a helpful coding assistant.",
        },
      );

      // Act
      await orchestrator.processMessage("Help me!");

      // Assert
      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: "deepseek-coder-v2:16b",
        messages: [
          { role: "system", content: "You are a helpful coding assistant." },
          { role: "user", content: "Help me!" },
        ],
        stream: false,
      });
    });

    it("should NOT include system message when systemPrompt is undefined", async () => {
      // Arrange
      const mockResponse: IChatResponse = {
        model: "deepseek-coder-v2:16b",
        created_at: "2024-01-01T00:00:00Z",
        message: { role: "assistant", content: "Hi!" },
        done: true,
      };

      mockOllamaClient.chat.mockResolvedValue({
        success: true,
        value: mockResponse,
      });

      const orchestrator = new SimpleOrchestrator(
        mockOllamaClient as unknown as OllamaClient,
        { systemPrompt: undefined },
      );

      // Act
      await orchestrator.processMessage("Hello!");

      // Assert
      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: "deepseek-coder-v2:16b",
        messages: [
          { role: "user", content: "Hello!" },
          // No system message
        ],
        stream: false,
      });
    });

    it("should propagate TIMEOUT error from OllamaClient", async () => {
      // Arrange
      const timeoutError = new OllamaError(
        "Request timed out after 60000ms",
        "TIMEOUT",
      );

      mockOllamaClient.chat.mockResolvedValue({
        success: false,
        error: timeoutError,
      });

      const orchestrator = new SimpleOrchestrator(
        mockOllamaClient as unknown as OllamaClient,
      );

      // Act
      const result = await orchestrator.processMessage("Hello!");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(timeoutError);
        expect(result.error.code).toBe("TIMEOUT");
      }
    });

    it("should propagate CONNECTION_REFUSED error from OllamaClient", async () => {
      // Arrange
      const connError = new OllamaError(
        "Cannot connect to Ollama",
        "CONNECTION_REFUSED",
      );

      mockOllamaClient.chat.mockResolvedValue({
        success: false,
        error: connError,
      });

      const orchestrator = new SimpleOrchestrator(
        mockOllamaClient as unknown as OllamaClient,
      );

      // Act
      const result = await orchestrator.processMessage("Hello!");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(connError);
        expect(result.error.code).toBe("CONNECTION_REFUSED");
      }
    });

    it("should propagate HTTP_ERROR from OllamaClient", async () => {
      // Arrange
      const httpError = new OllamaError(
        "Ollama API error: 404 Not Found",
        "HTTP_ERROR",
        404,
      );

      mockOllamaClient.chat.mockResolvedValue({
        success: false,
        error: httpError,
      });

      const orchestrator = new SimpleOrchestrator(
        mockOllamaClient as unknown as OllamaClient,
      );

      // Act
      const result = await orchestrator.processMessage("Hello!");

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(httpError);
        expect(result.error.code).toBe("HTTP_ERROR");
        expect(result.error.statusCode).toBe(404);
      }
    });
  });

  describe("constructor", () => {
    it("should use default model when not specified", async () => {
      // Arrange & Act
      const orchestrator = new SimpleOrchestrator(
        mockOllamaClient as unknown as OllamaClient,
      );

      // Assert - verify by triggering processMessage
      const mockResponse: IChatResponse = {
        model: "deepseek-coder-v2:16b",
        created_at: "2024-01-01T00:00:00Z",
        message: { role: "assistant", content: "Hi" },
        done: true,
      };

      mockOllamaClient.chat.mockResolvedValue({
        success: true,
        value: mockResponse,
      });

      await orchestrator.processMessage("Test");

      // Default model should be deepseek-coder-v2:16b
      expect(mockOllamaClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "deepseek-coder-v2:16b",
        }),
      );
    });

    it("should accept custom config with both model and systemPrompt", async () => {
      // Arrange
      const config = {
        model: "custom-model:7b",
        systemPrompt: "Custom system instructions",
      };

      const mockResponse: IChatResponse = {
        model: "custom-model:7b",
        created_at: "2024-01-01T00:00:00Z",
        message: { role: "assistant", content: "Done" },
        done: true,
      };

      mockOllamaClient.chat.mockResolvedValue({
        success: true,
        value: mockResponse,
      });

      const orchestrator = new SimpleOrchestrator(
        mockOllamaClient as unknown as OllamaClient,
        config,
      );

      // Act
      await orchestrator.processMessage("Test");

      // Assert
      expect(mockOllamaClient.chat).toHaveBeenCalledWith({
        model: "custom-model:7b",
        messages: [
          { role: "system", content: "Custom system instructions" },
          { role: "user", content: "Test" },
        ],
        stream: false,
      });
    });
  });
});
