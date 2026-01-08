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
): AppState => {
  // Create test messages for scrolling development
  const testMessages = [
    createMessage("user", "Hello! Can you help me with a project?"),
    createMessage(
      "agent",
      "Of course! I'd be happy to help. What kind of project are you working on?",
    ),
    createMessage(
      "user",
      "I'm building a TUI application with React and Ink. I need to implement scrolling functionality.",
    ),
    createMessage(
      "agent",
      "Great choice! React Ink is perfect for terminal UIs. For scrolling, you'll want to: 1) Track scroll offset in state, 2) Calculate visible messages based on terminal height, 3) Wire up keyboard handlers for arrow keys. Let me know which part you'd like to focus on first.",
    ),
    createMessage("user", "How do I calculate which messages are visible?"),
    createMessage(
      "agent",
      "You'll need to slice your messages array based on the visible area. Here's the approach:\n\n1. Get terminal height (using useStdout hook)\n2. Subtract reserved lines (top bar, input bar)\n3. Calculate how many lines each message takes (accounting for wrapping)\n4. Work backwards from the end, accumulating line counts\n5. Stop when you've filled the visible area\n\nThis ensures multi-line messages don't overflow the screen.",
    ),
    createMessage(
      "user",
      "What about handling arrow keys for scrolling up and down?",
    ),
    createMessage(
      "agent",
      "Use Ink's useInput hook! Here's a pattern:\n\nif (key.upArrow) {\n  dispatch({ type: 'SCROLL_UP', lines: 1 });\n}\n\nMake sure to handle this BEFORE other input handlers, and use return to prevent the arrow key from being treated as text input.",
    ),
    createMessage("user", "Should I use overflow: hidden on the chat area?"),
    createMessage(
      "agent",
      "Actually, no! If you're implementing manual scrolling with state, overflow: hidden will fight against your logic. Remove it and let your slicing algorithm control what's visible.",
    ),
    createMessage("user", "How do I handle terminal resizing?"),
    createMessage(
      "agent",
      "Ink's useStdout hook gives you stdout.rows and stdout.columns, which update automatically on resize. Just recalculate your visible messages whenever these values change. React will handle the re-render for you.",
    ),
    createMessage(
      "user",
      "This is really helpful! One more question: what about PageUp and PageDown?",
    ),
    createMessage(
      "agent",
      "Same pattern as arrow keys, just scroll more lines at once:\n\nif (key.pageUp) {\n  dispatch({ type: 'SCROLL_UP', lines: 10 });\n}\n\nif (key.pageDown) {\n  dispatch({ type: 'SCROLL_DOWN', lines: 10 });\n}\n\nYou can adjust the '10' based on typical terminal height for comfortable jumping.",
    ),
    createMessage("user", "Perfect! Let me implement this now."),
    createMessage(
      "agent",
      "Sounds good! Remember to test with: 1) Short messages, 2) Very long messages that wrap, 3) Terminal resizing, 4) Scrolling to top/bottom boundaries. Good luck!",
    ),
    createMessage("user", "Thanks for all the help!"),
    createMessage(
      "agent",
      "You're welcome! Feel free to ask if you run into any issues. Happy coding! 🚀",
    ),
  ];

  return {
    messages: testMessages,
    currentInput: "",
    debugMode,
    cwd,
    terminalHeight: 24, // Default terminal height
    scrollOffset: 0, // 0 = showing latest messages
  };
};

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
