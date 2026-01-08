/* eslint-disable max-classes-per-file */
import { describe, it, expect, beforeEach } from "vitest";
import SlashCommandHandler from "./SlashCommandHandler";
import type { SlashCommand, SlashCommandResult } from "./SlashCommand";

// Mock command for testing
class TestCommand implements SlashCommand {
  name = "test";

  description = "Test command";

  // eslint-disable-next-line class-methods-use-this
  execute(): SlashCommandResult {
    return { type: "continue" };
  }
}

// Mock error command
class ErrorCommand implements SlashCommand {
  name = "error";

  description = "Error command";

  // eslint-disable-next-line class-methods-use-this
  execute(): SlashCommandResult {
    return { type: "error", message: "Test error" };
  }
}

describe("SlashCommandHandler", () => {
  let handler: SlashCommandHandler;

  beforeEach(() => {
    handler = new SlashCommandHandler();
  });

  describe("isSlashCommand", () => {
    it("should return true for input starting with /", () => {
      expect(SlashCommandHandler.isSlashCommand("/test")).toBe(true);
      expect(SlashCommandHandler.isSlashCommand("/exit")).toBe(true);
      expect(SlashCommandHandler.isSlashCommand("/ space")).toBe(true);
    });

    it("should return true for input with leading whitespace", () => {
      expect(SlashCommandHandler.isSlashCommand("  /test")).toBe(true);
      expect(SlashCommandHandler.isSlashCommand("\t/exit")).toBe(true);
    });

    it("should return false for regular text", () => {
      expect(SlashCommandHandler.isSlashCommand("test")).toBe(false);
      expect(SlashCommandHandler.isSlashCommand("hello world")).toBe(false);
      expect(SlashCommandHandler.isSlashCommand("")).toBe(false);
    });

    it("should return false for / in middle of text", () => {
      expect(SlashCommandHandler.isSlashCommand("test / command")).toBe(false);
    });
  });

  describe("register", () => {
    it("should register a command", () => {
      const testCmd = new TestCommand();
      handler.register(testCmd);

      const commands = handler.getCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0]).toBe(testCmd);
    });

    it("should register multiple commands", () => {
      const testCmd = new TestCommand();
      const errorCmd = new ErrorCommand();

      handler.register(testCmd);
      handler.register(errorCmd);

      const commands = handler.getCommands();
      expect(commands).toHaveLength(2);
    });

    it("should overwrite command with same name", () => {
      const testCmd1 = new TestCommand();
      const testCmd2 = new TestCommand();

      handler.register(testCmd1);
      handler.register(testCmd2);

      const commands = handler.getCommands();
      expect(commands).toHaveLength(1);
      expect(commands[0]).toBe(testCmd2);
    });
  });

  describe("execute", () => {
    beforeEach(() => {
      handler.register(new TestCommand());
      handler.register(new ErrorCommand());
    });

    it("should execute registered command", () => {
      const result = handler.execute("/test");

      expect(result).toEqual({ type: "continue" });
    });

    it("should execute command with trailing whitespace", () => {
      const result = handler.execute("/test   ");

      expect(result).toEqual({ type: "continue" });
    });

    it("should execute command with leading whitespace", () => {
      const result = handler.execute("  /test");

      expect(result).toEqual({ type: "continue" });
    });

    it("should return error for unknown command", () => {
      const result = handler.execute("/unknown");

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toContain("Unknown command: /unknown");
      }
    });

    it("should return error for empty command", () => {
      const result = handler.execute("/");

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toContain("Empty command");
      }
    });

    it("should return error for command with only whitespace", () => {
      const result = handler.execute("/   ");

      expect(result.type).toBe("error");
      if (result.type === "error") {
        expect(result.message).toContain("Empty command");
      }
    });

    it("should execute error command correctly", () => {
      const result = handler.execute("/error");

      expect(result).toEqual({ type: "error", message: "Test error" });
    });

    it("should ignore arguments for now", () => {
      const result = handler.execute("/test arg1 arg2");

      expect(result).toEqual({ type: "continue" });
    });
  });

  describe("getCommands", () => {
    it("should return empty array when no commands registered", () => {
      const commands = handler.getCommands();

      expect(commands).toEqual([]);
    });

    it("should return all registered commands", () => {
      const testCmd = new TestCommand();
      const errorCmd = new ErrorCommand();

      handler.register(testCmd);
      handler.register(errorCmd);

      const commands = handler.getCommands();
      expect(commands).toHaveLength(2);
      expect(commands).toContain(testCmd);
      expect(commands).toContain(errorCmd);
    });
  });
});
