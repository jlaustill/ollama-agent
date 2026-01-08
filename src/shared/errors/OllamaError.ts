/**
 * OllamaError - Categorized error class for Ollama API failures
 *
 * Provides structured error handling with specific codes for different failure modes.
 * Use this to transform low-level HTTP/network errors into domain errors.
 *
 * @example
 * ```typescript
 * // Timeout
 * throw new OllamaError('Request timed out after 60s', 'TIMEOUT');
 *
 * // Connection refused
 * throw new OllamaError('Cannot connect to Ollama', 'CONNECTION_REFUSED');
 *
 * // HTTP error
 * throw new OllamaError('Model not found', 'HTTP_ERROR', 404);
 * ```
 */
export default class OllamaError extends Error {
  /**
   * Create a new OllamaError
   *
   * @param message - Human-readable error description
   * @param code - Categorized error code for programmatic handling
   * @param statusCode - HTTP status code (only for HTTP_ERROR type)
   */
  constructor(
    message: string,
    public readonly code:
      | "TIMEOUT"
      | "CONNECTION_REFUSED"
      | "HTTP_ERROR"
      | "UNKNOWN",
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "OllamaError";

    // Maintains proper stack trace for where error was thrown (V8 only)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OllamaError);
    }
  }
}
