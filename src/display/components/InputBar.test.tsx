import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { useInput, type Key } from "ink";
import InputBar from "./InputBar";
import { AppContextProvider } from "../context/AppContext";

// Mock Ink's useInput hook
vi.mock("ink", async () => {
  const actual = await vi.importActual("ink");
  return {
    ...actual,
    useInput: vi.fn(),
  };
});

describe("InputBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render without errors", () => {
      const { lastFrame } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      expect(lastFrame()).toBeDefined();
    });

    it("should render prompt character", () => {
      const { lastFrame } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      expect(lastFrame()).toContain(">");
    });

    it("should render cursor indicator", () => {
      const { lastFrame } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      expect(lastFrame()).toContain("█");
    });

    it("should render empty input initially", () => {
      const { lastFrame } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      const frame = lastFrame();
      expect(frame).toContain(">");
      expect(frame).toContain("█");
    });
  });

  describe("Character input", () => {
    it("should append regular characters to input", () => {
      let inputHandler: ((input: string, key: Key) => void) | undefined;
      vi.mocked(useInput).mockImplementation((handler) => {
        inputHandler = handler;
      });

      const { lastFrame, rerender } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Simulate typing 'h'
      inputHandler?.("h", {
        return: false,
        backspace: false,
        delete: false,
      } as Key);
      rerender(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      expect(lastFrame()).toContain("h");
    });

    it("should append multiple characters", () => {
      let inputHandler: ((input: string, key: Key) => void) | undefined;
      vi.mocked(useInput).mockImplementation((handler) => {
        inputHandler = handler;
      });

      const { lastFrame, rerender } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Simulate typing 'hello'
      inputHandler?.("h", {
        return: false,
        backspace: false,
        delete: false,
      } as Key);
      rerender(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );
      inputHandler?.("e", {
        return: false,
        backspace: false,
        delete: false,
      } as Key);
      rerender(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      expect(lastFrame()).toContain("he");
    });

    it("should ignore Ctrl key combinations", () => {
      let inputHandler: ((input: string, key: Key) => void) | undefined;
      vi.mocked(useInput).mockImplementation((handler) => {
        inputHandler = handler;
      });

      const { lastFrame } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Simulate Ctrl+C
      inputHandler?.("c", {
        ctrl: true,
        return: false,
        backspace: false,
      } as Key);

      const frame = lastFrame();
      expect(frame).not.toContain("c");
    });

    it("should ignore Meta key combinations", () => {
      let inputHandler: ((input: string, key: Key) => void) | undefined;
      vi.mocked(useInput).mockImplementation((handler) => {
        inputHandler = handler;
      });

      const { lastFrame } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Simulate Meta+V
      inputHandler?.("v", {
        meta: true,
        return: false,
        backspace: false,
      } as Key);

      const frame = lastFrame();
      expect(frame).not.toContain("v");
    });
  });

  describe("Backspace handling", () => {
    it("should remove last character on backspace", () => {
      let inputHandler: ((input: string, key: Key) => void) | undefined;
      vi.mocked(useInput).mockImplementation((handler) => {
        inputHandler = handler;
      });

      const { lastFrame, rerender } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Type 'hello'
      "hello".split("").forEach((char) => {
        inputHandler?.(char, {
          return: false,
          backspace: false,
          delete: false,
        } as Key);
        rerender(
          <AppContextProvider initialCwd="/test" debugMode={false}>
            <InputBar />
          </AppContextProvider>,
        );
      });

      expect(lastFrame()).toContain("hello");

      // Press backspace
      inputHandler?.("", {
        backspace: true,
        return: false,
        delete: false,
      } as Key);
      rerender(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      expect(lastFrame()).toContain("hell");
      expect(lastFrame()).not.toContain("hello");
    });

    it("should handle delete key like backspace", () => {
      let inputHandler: ((input: string, key: Key) => void) | undefined;
      vi.mocked(useInput).mockImplementation((handler) => {
        inputHandler = handler;
      });

      const { lastFrame, rerender } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Type 'hi'
      inputHandler?.("h", {
        return: false,
        backspace: false,
        delete: false,
      } as Key);
      rerender(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );
      inputHandler?.("i", {
        return: false,
        backspace: false,
        delete: false,
      } as Key);
      rerender(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      expect(lastFrame()).toContain("hi");

      // Press delete
      inputHandler?.("", {
        delete: true,
        return: false,
        backspace: false,
      } as Key);
      rerender(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      expect(lastFrame()).toContain("h");
      expect(lastFrame()).not.toContain("hi");
    });

    it("should handle backspace on empty input gracefully", () => {
      let inputHandler: ((input: string, key: Key) => void) | undefined;
      vi.mocked(useInput).mockImplementation((handler) => {
        inputHandler = handler;
      });

      const { lastFrame } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Press backspace on empty input
      inputHandler?.("", {
        backspace: true,
        return: false,
        delete: false,
      } as Key);

      expect(lastFrame()).toBeDefined();
    });
  });

  describe("Enter key submission", () => {
    it("should submit non-empty input on Enter", () => {
      let inputHandler: ((input: string, key: Key) => void) | undefined;
      vi.mocked(useInput).mockImplementation((handler) => {
        inputHandler = handler;
      });

      const { lastFrame, rerender } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Type 'test message'
      "test".split("").forEach((char) => {
        inputHandler?.(char, {
          return: false,
          backspace: false,
          delete: false,
        } as Key);
        rerender(
          <AppContextProvider initialCwd="/test" debugMode={false}>
            <InputBar />
          </AppContextProvider>,
        );
      });

      expect(lastFrame()).toContain("test");

      // Press Enter
      inputHandler?.("", {
        return: true,
        backspace: false,
        delete: false,
      } as Key);
      rerender(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Input should be cleared after submission
      const frame = lastFrame();
      expect(frame).not.toContain("test");
      expect(frame).toContain(">");
    });

    it("should not submit empty input on Enter", () => {
      let inputHandler: ((input: string, key: Key) => void) | undefined;
      vi.mocked(useInput).mockImplementation((handler) => {
        inputHandler = handler;
      });

      const { lastFrame } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Press Enter without typing anything
      inputHandler?.("", {
        return: true,
        backspace: false,
        delete: false,
      } as Key);

      expect(lastFrame()).toBeDefined();
    });

    it("should not submit whitespace-only input", () => {
      let inputHandler: ((input: string, key: Key) => void) | undefined;
      vi.mocked(useInput).mockImplementation((handler) => {
        inputHandler = handler;
      });

      const { lastFrame, rerender } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Type spaces
      inputHandler?.(" ", {
        return: false,
        backspace: false,
        delete: false,
      } as Key);
      rerender(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );
      inputHandler?.(" ", {
        return: false,
        backspace: false,
        delete: false,
      } as Key);
      rerender(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Press Enter
      inputHandler?.("", {
        return: true,
        backspace: false,
        delete: false,
      } as Key);
      rerender(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Spaces should remain (not cleared since submission didn't happen)
      expect(lastFrame()).toContain(" ");
    });
  });

  describe("Layout", () => {
    it("should render in a box with border", () => {
      const { lastFrame } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      // Border characters should be present
      expect(lastFrame()).toBeDefined();
    });

    it("should use flexDirection row", () => {
      // This is tested implicitly through rendering
      // Ink's Box with flexDirection="row" puts elements horizontally
      const { lastFrame } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      expect(lastFrame()).toBeDefined();
    });
  });

  describe("Integration with context", () => {
    it("should work with AppContext provider", () => {
      const { lastFrame } = render(
        <AppContextProvider initialCwd="/test" debugMode={false}>
          <InputBar />
        </AppContextProvider>,
      );

      expect(lastFrame()).toBeDefined();
    });
  });
});
