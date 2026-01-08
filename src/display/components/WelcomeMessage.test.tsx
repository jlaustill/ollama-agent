import { describe, it, expect } from "vitest";
import { render } from "ink-testing-library";
import React from "react";
import WelcomeMessage from "./WelcomeMessage";

describe("WelcomeMessage", () => {
  it("should render welcome message", () => {
    const { lastFrame } = render(<WelcomeMessage />);

    expect(lastFrame()).toContain("Welcome to ollama-agent v2");
  });

  it("should display instruction text", () => {
    const { lastFrame } = render(<WelcomeMessage />);

    expect(lastFrame()).toContain("Type your message and press Enter to begin");
  });

  it("should render without crashing", () => {
    const { lastFrame } = render(<WelcomeMessage />);

    expect(lastFrame()).toBeDefined();
    expect(lastFrame()).not.toBe("");
  });
});
