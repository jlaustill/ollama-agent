/**
 * chat.test.ts - Integration test for end-to-end chat flow
 *
 * Tests the complete flow from user message → OllamaClient → Ollama API → response.
 * Uses REAL HTTP calls (no mocking) to verify actual integration.
 *
 * Prerequisites:
 * 1. Ollama must be running: `ollama serve`
 * 2. Model must be available: `ollama pull deepseek-coder-v2:16b`
 *
 * Run with: npm test -- tests/integration/chat.test.ts
 * Skip in CI: Add `--exclude tests/integration` to npm test script if needed
 */

import { describe, it, expect, beforeAll } from "vitest";
import OllamaClient from "../../src/data/models/OllamaClient";
import SimpleOrchestrator from "../../src/domain/agent/SimpleOrchestrator";

describe("Integration: End-to-End Chat Flow", () => {
  const TIMEOUT_MS = 120000; // 2 minutes (accounts for model loading)
  const TEST_MODEL = "deepseek-coder-v2:16b";
  const OLLAMA_URL = "http://localhost:11434";

  let ollamaClient: OllamaClient;
  let orchestrator: SimpleOrchestrator;

  beforeAll(() => {
    // Initialize real client (no mocks)
    ollamaClient = new OllamaClient(OLLAMA_URL, TIMEOUT_MS);
    orchestrator = new SimpleOrchestrator(ollamaClient, { model: TEST_MODEL });
  });

  describe("OllamaClient", () => {
    it(
      "should connect to Ollama and return a valid response",
      async () => {
        // Arrange
        const request = {
          model: TEST_MODEL,
          messages: [{ role: "user" as const, content: "Say hello" }],
          stream: false,
        };

        // Act
        const result = await ollamaClient.chat(request);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.model).toBe(TEST_MODEL);
          expect(result.value.message.role).toBe("assistant");
          expect(result.value.message.content).toBeTruthy();
          expect(result.value.message.content.length).toBeGreaterThan(0);
          expect(result.value.done).toBe(true);
        }
      },
      TIMEOUT_MS,
    );

    it(
      "should handle model not found error gracefully",
      async () => {
        // Arrange
        const request = {
          model: "nonexistent-model-xyz",
          messages: [{ role: "user" as const, content: "Test" }],
          stream: false,
        };

        // Act
        const result = await ollamaClient.chat(request);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe("HTTP_ERROR");
          expect(result.error.statusCode).toBe(404);
        }
      },
      30000,
    );
  });

  describe("SimpleOrchestrator", () => {
    it(
      "should process a simple user message and return agent response",
      async () => {
        // Arrange
        const userMessage = "What is 2 + 2? Answer with just the number.";

        // Act
        const result = await orchestrator.processMessage(userMessage);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value).toBeTruthy();
          expect(result.value.length).toBeGreaterThan(0);
          expect(typeof result.value).toBe("string");
          // Response should contain "4" somewhere
          expect(result.value).toMatch(/4/);
        }
      },
      TIMEOUT_MS,
    );

    it(
      "should handle technical coding questions appropriately",
      async () => {
        // Arrange
        const codingQuestion =
          "What is the time complexity of bubble sort? Answer in one sentence.";

        // Act
        const result = await orchestrator.processMessage(codingQuestion);

        // Assert
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value).toBeTruthy();
          // Response should mention O(n²) or "quadratic" or "n squared"
          expect(result.value.toLowerCase()).toMatch(
            /o\(n[²2]\)|quadratic|n squared|n\^2/,
          );
        }
      },
      TIMEOUT_MS,
    );
  });

  describe("Error Scenarios (Real Failures)", () => {
    it(
      "should return error when Ollama is not reachable",
      async () => {
        // Arrange - Use port 11435 (adjacent to 11434, nothing listening)
        // Note: Real network errors may not be categorized the same as mocked errors
        const unreachableClient = new OllamaClient(
          "http://localhost:11435",
          5000,
        );
        const request = {
          model: TEST_MODEL,
          messages: [{ role: "user" as const, content: "Test" }],
          stream: false,
        };

        // Act
        const result = await unreachableClient.chat(request);

        // Assert
        expect(result.success).toBe(false);
        if (!result.success) {
          // Real network errors may be categorized as UNKNOWN or CONNECTION_REFUSED
          expect(["UNKNOWN", "CONNECTION_REFUSED"]).toContain(
            result.error.code,
          );
          expect(result.error.message).toBeTruthy();
        }
      },
      10000,
    );
  });

  describe("Performance", () => {
    it(
      "should respond within reasonable time for cached model",
      async () => {
        // This test assumes model is already loaded from previous tests

        // Arrange
        const startTime = Date.now();
        const simpleMessage = "Say 'OK'";

        // Act
        const result = await orchestrator.processMessage(simpleMessage);
        const duration = Date.now() - startTime;

        // Assert
        expect(result.success).toBe(true);
        expect(duration).toBeLessThan(30000); // Should be < 30s with loaded model

        // eslint-disable-next-line no-console
        console.log(`✓ Response time: ${duration}ms`);
      },
      40000,
    );
  });
});
