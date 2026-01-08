import { describe, it, expect } from "vitest";
import ExitCommand from "./ExitCommand";

describe("ExitCommand", () => {
  it("should have correct name", () => {
    const command = new ExitCommand();

    expect(command.name).toBe("exit");
  });

  it("should have description", () => {
    const command = new ExitCommand();

    expect(command.description).toBeTruthy();
    expect(command.description.toLowerCase()).toContain("exit");
  });

  it("should return exit result", () => {
    const command = new ExitCommand();
    const result = command.execute();

    expect(result).toEqual({ type: "exit" });
  });
});
