import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";
import {
  AppContextProvider,
  useAppContext,
  appReducer,
  createInitialState,
} from "./AppContext";
import { createMessage } from "../types/Message";
import type { AppState } from "../types/AppState";

describe("AppContext", () => {
  describe("createInitialState", () => {
    it("should create initial state with provided values", () => {
      const state = createInitialState("/home/user/project", true);

      expect(state).toEqual({
        messages: [],
        currentInput: "",
        debugMode: true,
        cwd: "/home/user/project",
        terminalHeight: 24,
        scrollOffset: 0,
      });
    });

    it("should create initial state with debug mode false", () => {
      const state = createInitialState("/tmp", false);

      expect(state.debugMode).toBe(false);
      expect(state.cwd).toBe("/tmp");
    });
  });

  describe("appReducer", () => {
    let baseState: AppState;

    beforeEach(() => {
      baseState = createInitialState("/home/user", false);
    });

    describe("ADD_MESSAGE action", () => {
      it("should add message and reset scroll offset", () => {
        const message = createMessage("agent", "Hello!");
        const newState = appReducer(baseState, {
          type: "ADD_MESSAGE",
          message,
        });

        expect(newState.messages).toHaveLength(1);
        expect(newState.messages[0]).toBe(message);
        expect(newState.scrollOffset).toBe(0);
      });

      it("should append to existing messages", () => {
        const msg1 = createMessage("user", "First");
        const msg2 = createMessage("agent", "Second");

        let state = appReducer(baseState, {
          type: "ADD_MESSAGE",
          message: msg1,
        });
        state = appReducer(state, { type: "ADD_MESSAGE", message: msg2 });

        expect(state.messages).toHaveLength(2);
        expect(state.messages[0]).toBe(msg1);
        expect(state.messages[1]).toBe(msg2);
      });

      it("should reset scroll offset even when scrolled up", () => {
        const stateWithScroll = { ...baseState, scrollOffset: 5 };
        const message = createMessage("agent", "New message");

        const newState = appReducer(stateWithScroll, {
          type: "ADD_MESSAGE",
          message,
        });

        expect(newState.scrollOffset).toBe(0);
      });
    });

    describe("UPDATE_INPUT action", () => {
      it("should update currentInput", () => {
        const newState = appReducer(baseState, {
          type: "UPDATE_INPUT",
          input: "Hello, world!",
        });

        expect(newState.currentInput).toBe("Hello, world!");
      });

      it("should replace existing input", () => {
        const stateWithInput = { ...baseState, currentInput: "Old text" };
        const newState = appReducer(stateWithInput, {
          type: "UPDATE_INPUT",
          input: "New text",
        });

        expect(newState.currentInput).toBe("New text");
      });
    });

    describe("SUBMIT_INPUT action", () => {
      it("should create user message and clear input", () => {
        const stateWithInput = { ...baseState, currentInput: "Test message" };
        const newState = appReducer(stateWithInput, { type: "SUBMIT_INPUT" });

        expect(newState.messages).toHaveLength(1);
        expect(newState.messages[0]?.role).toBe("user");
        expect(newState.messages[0]?.content).toBe("Test message");
        expect(newState.currentInput).toBe("");
        expect(newState.scrollOffset).toBe(0);
      });

      it("should not submit empty input", () => {
        const stateWithEmptyInput = { ...baseState, currentInput: "" };
        const newState = appReducer(stateWithEmptyInput, {
          type: "SUBMIT_INPUT",
        });

        expect(newState.messages).toHaveLength(0);
        expect(newState.currentInput).toBe("");
      });

      it("should not submit whitespace-only input", () => {
        const stateWithWhitespace = { ...baseState, currentInput: "   " };
        const newState = appReducer(stateWithWhitespace, {
          type: "SUBMIT_INPUT",
        });

        expect(newState.messages).toHaveLength(0);
      });

      it("should reset scroll offset", () => {
        const stateWithScrollAndInput = {
          ...baseState,
          currentInput: "Test",
          scrollOffset: 10,
        };
        const newState = appReducer(stateWithScrollAndInput, {
          type: "SUBMIT_INPUT",
        });

        expect(newState.scrollOffset).toBe(0);
      });
    });

    describe("CLEAR_INPUT action", () => {
      it("should clear currentInput", () => {
        const stateWithInput = { ...baseState, currentInput: "Some text" };
        const newState = appReducer(stateWithInput, { type: "CLEAR_INPUT" });

        expect(newState.currentInput).toBe("");
      });
    });

    describe("SCROLL_UP action", () => {
      it("should increase scroll offset", () => {
        const msg = createMessage("user", "Test");
        const stateWithMessages = {
          ...baseState,
          messages: [msg, msg, msg],
        };

        const newState = appReducer(stateWithMessages, {
          type: "SCROLL_UP",
          lines: 1,
        });

        expect(newState.scrollOffset).toBe(1);
      });

      it("should not scroll beyond max offset (number of messages - 1)", () => {
        const msg = createMessage("user", "Test");
        const stateWithMessages = {
          ...baseState,
          messages: [msg, msg, msg],
        };

        const newState = appReducer(stateWithMessages, {
          type: "SCROLL_UP",
          lines: 100,
        });

        expect(newState.scrollOffset).toBe(2); // Max is messages.length - 1
      });

      it("should handle scroll up with no messages", () => {
        const newState = appReducer(baseState, {
          type: "SCROLL_UP",
          lines: 5,
        });

        expect(newState.scrollOffset).toBe(0);
      });
    });

    describe("SCROLL_DOWN action", () => {
      it("should decrease scroll offset", () => {
        const stateWithScroll = { ...baseState, scrollOffset: 5 };
        const newState = appReducer(stateWithScroll, {
          type: "SCROLL_DOWN",
          lines: 2,
        });

        expect(newState.scrollOffset).toBe(3);
      });

      it("should not scroll below 0", () => {
        const stateWithScroll = { ...baseState, scrollOffset: 2 };
        const newState = appReducer(stateWithScroll, {
          type: "SCROLL_DOWN",
          lines: 100,
        });

        expect(newState.scrollOffset).toBe(0);
      });

      it("should handle scroll down when already at bottom", () => {
        const newState = appReducer(baseState, {
          type: "SCROLL_DOWN",
          lines: 5,
        });

        expect(newState.scrollOffset).toBe(0);
      });
    });

    describe("SCROLL_TO_BOTTOM action", () => {
      it("should reset scroll offset to 0", () => {
        const stateWithScroll = { ...baseState, scrollOffset: 10 };
        const newState = appReducer(stateWithScroll, {
          type: "SCROLL_TO_BOTTOM",
        });

        expect(newState.scrollOffset).toBe(0);
      });
    });

    describe("TERMINAL_RESIZE action", () => {
      it("should update terminal height", () => {
        const newState = appReducer(baseState, {
          type: "TERMINAL_RESIZE",
          height: 40,
        });

        expect(newState.terminalHeight).toBe(40);
      });

      it("should preserve other state", () => {
        const msg = createMessage("user", "Test");
        const stateWithData = {
          ...baseState,
          messages: [msg],
          currentInput: "Some text",
          scrollOffset: 5,
        };

        const newState = appReducer(stateWithData, {
          type: "TERMINAL_RESIZE",
          height: 50,
        });

        expect(newState.messages).toHaveLength(1);
        expect(newState.currentInput).toBe("Some text");
        expect(newState.scrollOffset).toBe(5);
        expect(newState.terminalHeight).toBe(50);
      });
    });
  });

  describe("AppContextProvider and useAppContext", () => {
    it("should provide context to children", () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: ({ children }) => (
          <AppContextProvider initialCwd="/test" debugMode={false}>
            {children}
          </AppContextProvider>
        ),
      });

      expect(result.current.state.cwd).toBe("/test");
      expect(result.current.state.debugMode).toBe(false);
      expect(result.current.dispatch).toBeDefined();
    });

    it("should allow dispatching actions", () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: ({ children }) => (
          <AppContextProvider initialCwd="/test" debugMode={false}>
            {children}
          </AppContextProvider>
        ),
      });

      act(() => {
        result.current.dispatch({
          type: "UPDATE_INPUT",
          input: "Hello!",
        });
      });

      expect(result.current.state.currentInput).toBe("Hello!");
    });

    it("should throw error when used outside provider", () => {
      // Suppress console.error for this test
      // eslint-disable-next-line no-console
      const originalError = console.error;
      // eslint-disable-next-line no-console
      console.error = vi.fn();

      expect(() => {
        renderHook(() => useAppContext());
      }).toThrow("useAppContext must be used within AppContextProvider");

      // eslint-disable-next-line no-console
      console.error = originalError;
    });

    it("should handle multiple state updates", () => {
      const { result } = renderHook(() => useAppContext(), {
        wrapper: ({ children }) => (
          <AppContextProvider initialCwd="/test" debugMode={false}>
            {children}
          </AppContextProvider>
        ),
      });

      act(() => {
        result.current.dispatch({
          type: "UPDATE_INPUT",
          input: "Message 1",
        });
        result.current.dispatch({ type: "SUBMIT_INPUT" });
        result.current.dispatch({
          type: "UPDATE_INPUT",
          input: "Message 2",
        });
        result.current.dispatch({ type: "SUBMIT_INPUT" });
      });

      expect(result.current.state.messages).toHaveLength(2);
      expect(result.current.state.messages[0]?.content).toBe("Message 1");
      expect(result.current.state.messages[1]?.content).toBe("Message 2");
      expect(result.current.state.currentInput).toBe("");
    });
  });
});
