import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import UserMessage from "./UserMessage";

describe("UserMessage", () => {
  it("should render user message content", () => {
    const { lastFrame } = render(<UserMessage content="Hello, agent!" />);

    expect(lastFrame()).toContain("Hello, agent!");
  });

  it("should display prompt character (>)", () => {
    const { lastFrame } = render(<UserMessage content="Test message" />);

    expect(lastFrame()).toContain(">");
  });

  it("should handle empty content", () => {
    const { lastFrame } = render(<UserMessage content="" />);

    expect(lastFrame()).toBeDefined();
    expect(lastFrame()).toContain(">");
  });

  it("should handle multi-line content", () => {
    const multiline = "Line 1\nLine 2\nLine 3";
    const { lastFrame } = render(<UserMessage content={multiline} />);

    expect(lastFrame()).toContain("Line 1");
    expect(lastFrame()).toContain("Line 2");
    expect(lastFrame()).toContain("Line 3");
  });

  it("should handle long content", () => {
    const longContent = "A".repeat(200);
    const { lastFrame } = render(<UserMessage content={longContent} />);

    expect(lastFrame()).toContain("A");
    expect(lastFrame()).toContain(">");
  });
});
