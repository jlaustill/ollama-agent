import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import TopBar from "./TopBar";

describe("TopBar", () => {
  describe("CWD display", () => {
    it("should render the current working directory", () => {
      const { lastFrame } = render(
        <TopBar cwd="/home/user/project" debugMode={false} />,
      );

      expect(lastFrame()).toContain("/home/user/project");
    });

    it("should handle long CWD paths", () => {
      const longPath =
        "/very/long/path/to/some/deeply/nested/project/directory";
      const { lastFrame } = render(<TopBar cwd={longPath} debugMode={false} />);

      expect(lastFrame()).toContain(longPath);
    });

    it("should handle empty CWD", () => {
      const { lastFrame } = render(<TopBar cwd="" debugMode={false} />);

      expect(lastFrame()).toBeDefined();
    });

    it("should handle root directory", () => {
      const { lastFrame } = render(<TopBar cwd="/" debugMode={false} />);

      expect(lastFrame()).toContain("/");
    });
  });

  describe("Debug mode indicator", () => {
    it("should show DEBUG indicator when debug mode is enabled", () => {
      const { lastFrame } = render(
        <TopBar cwd="/home/user" debugMode={true} />,
      );

      expect(lastFrame()).toContain("DEBUG");
    });

    it("should not show DEBUG indicator when debug mode is disabled", () => {
      const { lastFrame } = render(
        <TopBar cwd="/home/user" debugMode={false} />,
      );

      expect(lastFrame()).not.toContain("DEBUG");
    });

    it("should show both CWD and DEBUG indicator together", () => {
      const { lastFrame } = render(
        <TopBar cwd="/home/user/project" debugMode={true} />,
      );

      const frame = lastFrame();
      expect(frame).toContain("/home/user/project");
      expect(frame).toContain("DEBUG");
    });
  });

  describe("Layout", () => {
    it("should render without errors", () => {
      const { lastFrame } = render(<TopBar cwd="/test" debugMode={false} />);

      expect(lastFrame()).toBeDefined();
    });

    it("should maintain structure with various inputs", () => {
      const testCases = [
        { cwd: "/short", debugMode: false },
        { cwd: "/very/long/path/indeed", debugMode: true },
        { cwd: "~", debugMode: true },
        { cwd: ".", debugMode: false },
      ];

      testCases.forEach(({ cwd, debugMode }) => {
        const { lastFrame } = render(
          <TopBar cwd={cwd} debugMode={debugMode} />,
        );
        expect(lastFrame()).toBeDefined();
        expect(lastFrame()).toContain(cwd);
      });
    });
  });
});
