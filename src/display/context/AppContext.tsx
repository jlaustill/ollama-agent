/**
 * AppContext - Global state management for the TUI
 *
 * Provides:
 * - AppContextProvider: Wraps the app with state management
 * - useAppContext: Hook to access state and dispatch actions
 * - Reducer: Pure function handling all state transitions
 */

import React, {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from "react";
import type { AppState, AppAction } from "../types/AppState";
import { createMessage } from "../types/Message";

/**
 * Initial application state
 */
export const createInitialState = (
  cwd: string,
  debugMode: boolean,
): AppState => ({
  messages: [],
  currentInput: "",
  debugMode,
  cwd,
  terminalHeight: 24, // Default terminal height
  scrollOffset: 0, // 0 = showing latest messages
});

/**
 * App reducer - handles all state transitions
 */
export const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.message],
        scrollOffset: 0, // Auto-scroll to bottom on new message
      };

    case "UPDATE_INPUT":
      return {
        ...state,
        currentInput: action.input,
      };

    case "SUBMIT_INPUT": {
      // Don't submit if input is empty
      if (state.currentInput.trim() === "") {
        return state;
      }

      const userMessage = createMessage("user", state.currentInput);
      return {
        ...state,
        messages: [...state.messages, userMessage],
        currentInput: "", // Clear input after submit
        scrollOffset: 0, // Auto-scroll to bottom
      };
    }

    case "CLEAR_INPUT":
      return {
        ...state,
        currentInput: "",
      };

    case "SCROLL_UP": {
      // Calculate max scroll offset (can't scroll past first message)
      const maxScroll = Math.max(0, state.messages.length - 1);
      const newOffset = Math.min(state.scrollOffset + action.lines, maxScroll);
      return {
        ...state,
        scrollOffset: newOffset,
      };
    }

    case "SCROLL_DOWN": {
      // Can't scroll below 0 (bottom of messages)
      const newOffset = Math.max(0, state.scrollOffset - action.lines);
      return {
        ...state,
        scrollOffset: newOffset,
      };
    }

    case "SCROLL_TO_BOTTOM":
      return {
        ...state,
        scrollOffset: 0,
      };

    case "TERMINAL_RESIZE":
      return {
        ...state,
        terminalHeight: action.height,
      };

    default: {
      // Exhaustive check - TypeScript ensures this never happens
      const exhaustiveCheck: never = action;
      throw new Error(
        `Unhandled action type: ${JSON.stringify(exhaustiveCheck)}`,
      );
    }
  }
};

/**
 * Context type definition
 */
interface AppContextType {
  state: AppState;
  dispatch: Dispatch<AppAction>;
}

/**
 * Create the context
 */
const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * AppContextProvider props
 */
interface AppContextProviderProps {
  children: ReactNode;
  initialCwd: string;
  debugMode: boolean;
}

/**
 * AppContextProvider - Wraps the application with state management
 */
export const AppContextProvider: React.FC<AppContextProviderProps> = ({
  children,
  initialCwd,
  debugMode,
}) => {
  const [state, dispatch] = useReducer(
    appReducer,
    createInitialState(initialCwd, debugMode),
  );

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

/**
 * useAppContext - Hook to access app state and dispatch
 *
 * @throws Error if used outside AppContextProvider
 */
export const useAppContext = (): AppContextType => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within AppContextProvider");
  }
  return context;
};
