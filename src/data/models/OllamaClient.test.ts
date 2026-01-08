/**
 * OllamaClient.test.ts - Unit tests for OllamaClient
 *
 * Tests all error transformation paths with mocked axios.
 * No real HTTP calls—pure unit tests.
 */

/* eslint-disable @typescript-eslint/unbound-method */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";
import OllamaClient from "./OllamaClient";
import type IChatRequest from "./types/IChatRequest";
import type IChatResponse from "./types/IChatResponse";

// Mock axios module
vi.mock("axios");
const mockedAxios = vi.mocked(axios, true);

describe("OllamaClient", () => {
  let client: OllamaClient;

  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();

    // Mock axios.create to return a mock instance
    const mockInstance = {
      post: vi.fn(),
      defaults: {
        baseURL: "http://localhost:11434",
        timeout: 60000,
      },
    };

    mockedAxios.create.mockReturnValue(mockInstance as never);

    client = new OllamaClient();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("chat()", () => {
    it("should return success result with chat response", async () => {
      // Arrange
      const request: IChatRequest = {
        model: "deepseek-coder-v2:16b",
        messages: [{ role: "user", content: "Hello!" }],
      };

      const mockResponse: IChatResponse = {
        model: "deepseek-coder-v2:16b",
        created_at: "2024-01-01T00:00:00Z",
        message: { role: "assistant", content: "Hi there!" },
        done: true,
        total_duration: 1000000,
        prompt_eval_count: 5,
        eval_count: 10,
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.post).mockResolvedValue({
        data: mockResponse,
      });

      // Act
      const result = await client.chat(request);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(mockResponse);
        expect(result.value.message.content).toBe("Hi there!");
      }

      // Verify stream: false was enforced
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/chat", {
        ...request,
        stream: false,
      });
    });

    it("should enforce stream: false even if request specifies stream: true", async () => {
      // Arrange
      const request: IChatRequest = {
        model: "deepseek-coder-v2:16b",
        messages: [{ role: "user", content: "Hello!" }],
        stream: true, // Attempting to enable streaming
      };

      const mockResponse: IChatResponse = {
        model: "deepseek-coder-v2:16b",
        created_at: "2024-01-01T00:00:00Z",
        message: { role: "assistant", content: "Hi!" },
        done: true,
      };

      const mockAxiosInstance = mockedAxios.create();
      vi.mocked(mockAxiosInstance.post).mockResolvedValue({
        data: mockResponse,
      });

      // Act
      await client.chat(request);

      // Assert
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/api/chat", {
        model: "deepseek-coder-v2:16b",
        messages: [{ role: "user", content: "Hello!" }],
        stream: false, // Should be overridden to false
      });
    });

    it("should return TIMEOUT error when request times out", async () => {
      // Arrange
      const request: IChatRequest = {
        model: "deepseek-coder-v2:16b",
        messages: [{ role: "user", content: "Hello!" }],
      };

      const mockAxiosInstance = mockedAxios.create();
      const timeoutError = {
        code: "ECONNABORTED",
        message: "timeout of 60000ms exceeded",
        isAxiosError: true,
        toJSON: (): object => ({}),
      };

      vi.mocked(mockAxiosInstance.post).mockRejectedValue(timeoutError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      // Act
      const result = await client.chat(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("TIMEOUT");
        expect(result.error.message).toContain("60000ms");
      }
    });

    it("should return CONNECTION_REFUSED error when Ollama is not running", async () => {
      // Arrange
      const request: IChatRequest = {
        model: "deepseek-coder-v2:16b",
        messages: [{ role: "user", content: "Hello!" }],
      };

      const mockAxiosInstance = mockedAxios.create();
      const connRefusedError = {
        code: "ECONNREFUSED",
        message: "connect ECONNREFUSED 127.0.0.1:11434",
        isAxiosError: true,
        toJSON: (): object => ({}),
      };

      vi.mocked(mockAxiosInstance.post).mockRejectedValue(connRefusedError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      // Act
      const result = await client.chat(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("CONNECTION_REFUSED");
        expect(result.error.message).toContain("Cannot connect to Ollama");
        expect(result.error.message).toContain("Is Ollama running?");
      }
    });

    it("should return HTTP_ERROR with status code for 404 Not Found", async () => {
      // Arrange
      const request: IChatRequest = {
        model: "nonexistent-model",
        messages: [{ role: "user", content: "Hello!" }],
      };

      const mockAxiosInstance = mockedAxios.create();
      const notFoundError = {
        isAxiosError: true,
        response: {
          status: 404,
          statusText: "Not Found",
          data: { error: "model not found" },
        },
        toJSON: (): object => ({}),
      };

      vi.mocked(mockAxiosInstance.post).mockRejectedValue(notFoundError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      // Act
      const result = await client.chat(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("HTTP_ERROR");
        expect(result.error.statusCode).toBe(404);
        expect(result.error.message).toContain("404");
        expect(result.error.message).toContain("Not Found");
      }
    });

    it("should return HTTP_ERROR with status code for 500 Internal Server Error", async () => {
      // Arrange
      const request: IChatRequest = {
        model: "deepseek-coder-v2:16b",
        messages: [{ role: "user", content: "Hello!" }],
      };

      const mockAxiosInstance = mockedAxios.create();
      const serverError = {
        isAxiosError: true,
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { error: "something went wrong" },
        },
        toJSON: (): object => ({}),
      };

      vi.mocked(mockAxiosInstance.post).mockRejectedValue(serverError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      // Act
      const result = await client.chat(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("HTTP_ERROR");
        expect(result.error.statusCode).toBe(500);
        expect(result.error.message).toContain("500");
      }
    });

    it("should return UNKNOWN error for non-axios errors", async () => {
      // Arrange
      const request: IChatRequest = {
        model: "deepseek-coder-v2:16b",
        messages: [{ role: "user", content: "Hello!" }],
      };

      const mockAxiosInstance = mockedAxios.create();
      const genericError = new Error("Something unexpected happened");

      vi.mocked(mockAxiosInstance.post).mockRejectedValue(genericError);
      mockedAxios.isAxiosError.mockReturnValue(false);

      // Act
      const result = await client.chat(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNKNOWN");
        expect(result.error.message).toBe("Something unexpected happened");
      }
    });

    it("should return UNKNOWN error for network errors without response", async () => {
      // Arrange
      const request: IChatRequest = {
        model: "deepseek-coder-v2:16b",
        messages: [{ role: "user", content: "Hello!" }],
      };

      const mockAxiosInstance = mockedAxios.create();
      const networkError = {
        isAxiosError: true,
        message: "Network error",
        request: {}, // Has request but no response
        toJSON: (): object => ({}),
      };

      vi.mocked(mockAxiosInstance.post).mockRejectedValue(networkError);
      mockedAxios.isAxiosError.mockReturnValue(true);

      // Act
      const result = await client.chat(request);

      // Assert
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("UNKNOWN");
        expect(result.error.message).toContain("Network error");
      }
    });
  });

  describe("constructor", () => {
    it("should use default baseURL and timeout", () => {
      // Act
      // eslint-disable-next-line no-new
      new OllamaClient();

      // Assert
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "http://localhost:11434",
        timeout: 60000,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });

    it("should accept custom baseURL and timeout", () => {
      // Arrange
      const customUrl = "http://custom-server:8080";
      const customTimeout = 120000;

      // Act
      // eslint-disable-next-line no-new
      new OllamaClient(customUrl, customTimeout);

      // Assert
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: customUrl,
        timeout: customTimeout,
        headers: {
          "Content-Type": "application/json",
        },
      });
    });
  });
});
