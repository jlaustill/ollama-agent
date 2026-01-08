import { describe, it, expect } from "vitest";
import { initialState } from "./AppState";
import type { AppState, AppAction } from "./AppState";
import { createMessage } from "./Message";

describe("AppState", () => {
  describe("initialState", () => {
    it("should have empty messages array", () => {
      expect(initialState.messages).toEqual([]);
      expect(initialState.messages).toHaveLength(0);
    });

    it("should have empty currentInput", () => {
      expect(initialState.currentInput).toBe("");
    });

    it("should have debugMode disabled by default", () => {
      expect(initialState.debugMode).toBe(false);
    });

    it("should have cwd set to process.cwd()", () => {
      expect(initialState.cwd).toBe(process.cwd());
      expect(initialState.cwd).toBeTypeOf("string");
      expect(initialState.cwd.length).toBeGreaterThan(0);
    });

    it("should have default terminalHeight of 24", () => {
      expect(initialState.terminalHeight).toBe(24);
    });

    it("should have scrollOffset at 0 (bottom)", () => {
      expect(initialState.scrollOffset).toBe(0);
    });
  });

  describe("AppState interface", () => {
    it("should allow valid state objects", () => {
      const validState: AppState = {
        messages: [createMessage("user", "Test")],
        currentInput: "Hello",
        debugMode: true,
        cwd: "/home/test",
        terminalHeight: 30,
        scrollOffset: 5,
      };

      expect(validState.messages).toHaveLength(1);
      expect(validState.currentInput).toBe("Hello");
      expect(validState.debugMode).toBe(true);
      expect(validState.cwd).toBe("/home/test");
      expect(validState.terminalHeight).toBe(30);
      expect(validState.scrollOffset).toBe(5);
    });
  });

  describe("AppAction discriminated union", () => {
    it("should allow ADD_MESSAGE action", () => {
      const message = createMessage("user", "Test");
      const action: AppAction = {
        type: "ADD_MESSAGE",
        message,
      };

      expect(action.type).toBe("ADD_MESSAGE");
      expect(action.message).toBe(message);
    });

    it("should allow UPDATE_INPUT action", () => {
      const action: AppAction = {
        type: "UPDATE_INPUT",
        input: "Hello",
      };

      expect(action.type).toBe("UPDATE_INPUT");
      expect(action.input).toBe("Hello");
    });

    it("should allow SUBMIT_INPUT action", () => {
      const action: AppAction = {
        type: "SUBMIT_INPUT",
      };

      expect(action.type).toBe("SUBMIT_INPUT");
    });

    it("should allow CLEAR_INPUT action", () => {
      const action: AppAction = {
        type: "CLEAR_INPUT",
      };

      expect(action.type).toBe("CLEAR_INPUT");
    });

    it("should allow SCROLL_UP action", () => {
      const action: AppAction = {
        type: "SCROLL_UP",
        lines: 5,
      };

      expect(action.type).toBe("SCROLL_UP");
      expect(action.lines).toBe(5);
    });

    it("should allow SCROLL_DOWN action", () => {
      const action: AppAction = {
        type: "SCROLL_DOWN",
        lines: 3,
      };

      expect(action.type).toBe("SCROLL_DOWN");
      expect(action.lines).toBe(3);
    });

    it("should allow SCROLL_TO_BOTTOM action", () => {
      const action: AppAction = {
        type: "SCROLL_TO_BOTTOM",
      };

      expect(action.type).toBe("SCROLL_TO_BOTTOM");
    });

    it("should allow TERMINAL_RESIZE action", () => {
      const action: AppAction = {
        type: "TERMINAL_RESIZE",
        height: 40,
      };

      expect(action.type).toBe("TERMINAL_RESIZE");
      expect(action.height).toBe(40);
    });
  });
});
