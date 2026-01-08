import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import AgentMessage from "./AgentMessage";

describe("AgentMessage", () => {
  it("should render agent message content", () => {
    const { lastFrame } = render(
      <AgentMessage content="I can help with that." />,
    );

    expect(lastFrame()).toContain("I can help with that.");
  });

  it("should handle empty content", () => {
    const { lastFrame } = render(<AgentMessage content="" />);

    expect(lastFrame()).toBeDefined();
  });

  it("should handle multi-line content", () => {
    const multiline = "Line 1\nLine 2\nLine 3";
    const { lastFrame } = render(<AgentMessage content={multiline} />);

    expect(lastFrame()).toContain("Line 1");
    expect(lastFrame()).toContain("Line 2");
    expect(lastFrame()).toContain("Line 3");
  });

  it("should handle long content", () => {
    const longContent = "B".repeat(200);
    const { lastFrame } = render(<AgentMessage content={longContent} />);

    expect(lastFrame()).toContain("B");
  });

  it("should handle system messages (same styling)", () => {
    const { lastFrame } = render(
      <AgentMessage content="System notification" />,
    );

    expect(lastFrame()).toContain("System notification");
  });
});
