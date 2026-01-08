import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useStdout } from "ink";
import { useTerminalSize, useTerminalSizeWithDefault } from "./useTerminalSize";

// Import after mocking to get the mocked version

// Mock Ink's useStdout hook
vi.mock("ink", () => ({
  useStdout: vi.fn(),
}));

describe("useTerminalSize", () => {
  describe("useTerminalSize", () => {
    it("should return terminal rows when available", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: { rows: 30 } as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { result } = renderHook(() => useTerminalSize());

      expect(result.current).toBe(30);
    });

    it("should return undefined when rows are not available", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: {} as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { result } = renderHook(() => useTerminalSize());

      expect(result.current).toBeUndefined();
    });

    it("should return undefined when stdout is not available", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: undefined as unknown as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { result } = renderHook(() => useTerminalSize());

      expect(result.current).toBeUndefined();
    });

    it("should handle different terminal heights", () => {
      const testHeights = [10, 20, 40, 80, 120];

      testHeights.forEach((height) => {
        vi.mocked(useStdout).mockReturnValue({
          stdout: { rows: height } as NodeJS.WriteStream,
          write: vi.fn(),
        });

        const { result } = renderHook(() => useTerminalSize());

        expect(result.current).toBe(height);
      });
    });

    it("should handle small terminal heights", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: { rows: 1 } as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { result } = renderHook(() => useTerminalSize());

      expect(result.current).toBe(1);
    });
  });

  describe("useTerminalSizeWithDefault", () => {
    it("should return terminal rows when available", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: { rows: 30 } as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { result } = renderHook(() => useTerminalSizeWithDefault());

      expect(result.current).toBe(30);
    });

    it("should return default value when rows are not available", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: {} as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { result } = renderHook(() => useTerminalSizeWithDefault());

      expect(result.current).toBe(24); // Default
    });

    it("should return custom default value", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: {} as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { result } = renderHook(() => useTerminalSizeWithDefault(50));

      expect(result.current).toBe(50);
    });

    it("should prefer actual terminal size over default", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: { rows: 40 } as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { result } = renderHook(() => useTerminalSizeWithDefault(100));

      expect(result.current).toBe(40);
    });

    it("should handle zero as custom default", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: {} as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { result } = renderHook(() => useTerminalSizeWithDefault(0));

      expect(result.current).toBe(0);
    });
  });

  describe("Type safety", () => {
    it("useTerminalSize should return number | undefined", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: { rows: 30 } as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { result } = renderHook(() => useTerminalSize());

      // TypeScript should allow both number and undefined
      const height: number | undefined = result.current;
      expect(height).toBeDefined();
    });

    it("useTerminalSizeWithDefault should return number", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: { rows: 30 } as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { result } = renderHook(() => useTerminalSizeWithDefault());

      // TypeScript should guarantee this is a number
      const height: number = result.current;
      expect(typeof height).toBe("number");
    });
  });
});
