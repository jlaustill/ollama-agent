/**
 * Global application state and actions for the TUI
 */

import type { Message } from "./Message";

export interface AppState {
  messages: Message[];
  currentInput: string;
  debugMode: boolean;
  cwd: string;
  terminalHeight: number;
  scrollOffset: number; // 0 = showing latest messages (bottom), >0 = scrolled up
}

export type AppAction =
  | { type: "ADD_MESSAGE"; message: Message }
  | { type: "UPDATE_INPUT"; input: string }
  | { type: "SUBMIT_INPUT" }
  | { type: "CLEAR_INPUT" }
  | { type: "SCROLL_UP"; lines: number }
  | { type: "SCROLL_DOWN"; lines: number }
  | { type: "SCROLL_TO_BOTTOM" }
  | { type: "TERMINAL_RESIZE"; height: number };

export const initialState: AppState = {
  messages: [],
  currentInput: "",
  debugMode: false,
  cwd: process.cwd(),
  terminalHeight: 24, // Default, will be updated on mount
  scrollOffset: 0,
};
