/**
 * OllamaClient - Pure HTTP client for Ollama API
 *
 * Responsibilities:
 * - Make HTTP requests to Ollama
 * - Transform responses to typed interfaces
 * - Convert axios errors to OllamaError
 * - NO business logic (that belongs in domain layer)
 *
 * @example
 * ```typescript
 * const client = new OllamaClient('http://localhost:11434', 60000);
 * const result = await client.chat({
 *   model: 'deepseek-coder-v2:16b',
 *   messages: [{ role: 'user', content: 'Hello!' }],
 *   stream: false
 * });
 *
 * if (result.success) {
 *   console.log(result.value.message.content);
 * } else {
 *   console.error(result.error.code, result.error.message);
 * }
 * ```
 */

import axios, { type AxiosInstance, type AxiosError } from "axios";
import type TResult from "../../shared/types/TResult";
import OllamaError from "../../shared/errors/OllamaError";
import type IChatRequest from "./types/IChatRequest";
import type IChatResponse from "./types/IChatResponse";

export default class OllamaClient {
  private readonly axiosInstance: AxiosInstance;

  /**
   * Create a new OllamaClient
   *
   * @param baseUrl - Ollama API base URL (default: http://localhost:11434)
   * @param timeout - Request timeout in milliseconds (default: 60000)
   */
  constructor(baseUrl = "http://localhost:11434", timeout = 60000) {
    this.axiosInstance = axios.create({
      baseURL: baseUrl,
      timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Send a chat completion request to Ollama
   *
   * @param request - Chat request with model, messages, options
   * @returns Result with IChatResponse on success, OllamaError on failure
   */
  async chat(
    request: IChatRequest,
  ): Promise<TResult<IChatResponse, OllamaError>> {
    try {
      // Ensure stream is explicitly false for MVP
      const payload: IChatRequest = {
        ...request,
        stream: false,
      };

      const response = await this.axiosInstance.post<IChatResponse>(
        "/api/chat",
        payload,
      );

      return {
        success: true,
        value: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: this.transformError(error),
      };
    }
  }

  /**
   * Transform axios errors into categorized OllamaError
   *
   * @param error - Unknown error from axios
   * @returns OllamaError with appropriate code
   */
  private transformError(error: unknown): OllamaError {
    // Type guard for axios errors
    if (!axios.isAxiosError(error)) {
      return new OllamaError(
        error instanceof Error ? error.message : "Unknown error occurred",
        "UNKNOWN",
      );
    }

    const axiosError = error as AxiosError;

    // Timeout (ECONNABORTED)
    if (axiosError.code === "ECONNABORTED") {
      return new OllamaError(
        `Request timed out after ${this.axiosInstance.defaults.timeout}ms`,
        "TIMEOUT",
      );
    }

    // Connection refused (ECONNREFUSED)
    if (axiosError.code === "ECONNREFUSED") {
      return new OllamaError(
        `Cannot connect to Ollama at ${this.axiosInstance.defaults.baseURL}. Is Ollama running?`,
        "CONNECTION_REFUSED",
      );
    }

    // HTTP error with response
    if (axiosError.response) {
      const { status: statusCode, statusText } = axiosError.response;

      return new OllamaError(
        `Ollama API error: ${statusCode} ${statusText}`,
        "HTTP_ERROR",
        statusCode,
      );
    }

    // Network error without response
    if (axiosError.request) {
      return new OllamaError(`Network error: ${axiosError.message}`, "UNKNOWN");
    }

    // Unknown axios error
    return new OllamaError(axiosError.message, "UNKNOWN");
  }
}
