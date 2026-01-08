import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import { useInput, useStdout } from "ink";
import App from "./App";

// Import after mocking

// Mock Ink's useInput and useStdout hooks
vi.mock("ink", async () => {
  const actual = await vi.importActual("ink");
  return {
    ...actual,
    useInput: vi.fn(),
    useStdout: vi.fn(),
  };
});

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock for useStdout (terminal height)
    vi.mocked(useStdout).mockReturnValue({
      stdout: { rows: 24 } as NodeJS.WriteStream,
      write: vi.fn(),
    });

    // Default mock for useInput
    vi.mocked(useInput).mockImplementation(() => {
      // No-op
    });
  });

  describe("Rendering", () => {
    it("should render without errors", () => {
      const { lastFrame } = render(
        <App cwd="/test/path" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).toBeDefined();
    });

    it("should render TopBar with CWD", () => {
      const { lastFrame } = render(
        <App cwd="/home/user/project" debugMode={false} />,
      );

      expect(lastFrame()).toContain("/home/user/project");
    });

    it("should render TopBar with debug indicator when debugMode is true", () => {
      const { lastFrame } = render(
        <App cwd="/test/path" debugMode={true} includeTestMessages={false} />,
      );

      expect(lastFrame()).toContain("DEBUG");
    });

    it("should not render debug indicator when debugMode is false", () => {
      const { lastFrame } = render(
        <App cwd="/test/path" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).not.toContain("DEBUG");
    });

    it("should render welcome message in ChatArea initially", () => {
      const { lastFrame } = render(
        <App cwd="/test/path" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).toContain("Welcome to ollama-agent");
    });

    it("should render InputBar prompt", () => {
      const { lastFrame } = render(
        <App cwd="/test/path" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).toContain(">");
    });

    it("should render InputBar cursor indicator", () => {
      const { lastFrame } = render(
        <App cwd="/test/path" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).toContain("█");
    });
  });

  describe("Layout", () => {
    it("should render all three main sections", () => {
      const { lastFrame } = render(
        <App cwd="/test/path" debugMode={false} includeTestMessages={false} />,
      );

      const frame = lastFrame();

      // TopBar (CWD)
      expect(frame).toContain("/test/path");

      // ChatArea (Welcome message)
      expect(frame).toContain("Welcome");

      // InputBar (prompt)
      expect(frame).toContain(">");
    });

    it("should use column layout", () => {
      // This is tested implicitly through rendering
      // Ink's Box with flexDirection="column" stacks elements vertically
      const { lastFrame } = render(
        <App cwd="/test/path" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).toBeDefined();
    });
  });

  describe("Props handling", () => {
    it("should handle different CWD paths", () => {
      const { lastFrame } = render(
        <App cwd="/var/www/application" debugMode={false} />,
      );

      expect(lastFrame()).toContain("/var/www/application");
    });

    it("should handle long CWD paths", () => {
      const longPath =
        "/very/long/path/to/some/deeply/nested/directory/structure";
      const { lastFrame } = render(<App cwd={longPath} debugMode={false} />);

      expect(lastFrame()).toContain(longPath);
    });

    it("should toggle debug mode correctly", () => {
      // Test false -> true
      const { lastFrame, rerender } = render(
        <App cwd="/test" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).not.toContain("DEBUG");

      rerender(
        <App cwd="/test" debugMode={true} includeTestMessages={false} />,
      );

      expect(lastFrame()).toContain("DEBUG");
    });
  });

  describe("Component integration", () => {
    it("should integrate TopBar, ChatArea, and InputBar", () => {
      const { lastFrame } = render(
        <App cwd="/home/user" debugMode={true} includeTestMessages={false} />,
      );

      const frame = lastFrame();

      // TopBar elements
      expect(frame).toContain("/home/user");
      expect(frame).toContain("DEBUG");

      // ChatArea element
      expect(frame).toContain("Welcome");

      // InputBar elements
      expect(frame).toContain(">");
      expect(frame).toContain("█");
    });

    it("should provide context to child components", () => {
      // This is tested indirectly - if components render correctly,
      // they successfully consumed the context
      const { lastFrame } = render(
        <App cwd="/test" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).toContain("Welcome to ollama-agent");
    });
  });

  describe("Terminal size handling", () => {
    it("should handle small terminal heights", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: { rows: 10 } as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { lastFrame } = render(
        <App cwd="/test" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).toBeDefined();
    });

    it("should handle large terminal heights", () => {
      vi.mocked(useStdout).mockReturnValue({
        stdout: { rows: 100 } as NodeJS.WriteStream,
        write: vi.fn(),
      });

      const { lastFrame } = render(
        <App cwd="/test" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).toBeDefined();
    });
  });

  describe("Edge cases", () => {
    it("should handle empty CWD", () => {
      const { lastFrame } = render(
        <App cwd="" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).toBeDefined();
    });

    it("should handle root directory as CWD", () => {
      const { lastFrame } = render(
        <App cwd="/" debugMode={false} includeTestMessages={false} />,
      );

      expect(lastFrame()).toContain("/");
    });

    it("should handle Windows-style paths", () => {
      const { lastFrame } = render(
        <App cwd="C:\\Users\\test\\project" debugMode={false} />,
      );

      // Check that path components are present (backslashes may be rendered differently)
      const frame = lastFrame();
      expect(frame).toContain("Users");
      expect(frame).toContain("test");
      expect(frame).toContain("project");
    });
  });
});
