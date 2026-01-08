/**
 * App component - Root component that wires everything together
 *
 * Orchestrates:
 * - AppContextProvider for global state
 * - TopBar, ChatArea, and InputBar layout
 * - Column-based flexbox layout
 */

import React from "react";
import { Box } from "ink";
import { AppContextProvider } from "../context/AppContext";
import TopBar from "./TopBar";
import ChatArea from "./ChatArea";
import InputBar from "./InputBar";

export interface AppProps {
  cwd: string;
  debugMode: boolean;
}

/**
 * App - Root TUI component
 *
 * Layout:
 * ┌─────────────────────┐
 * │ TopBar (sticky)     │
 * ├─────────────────────┤
 * │ ChatArea (scrolling)│
 * │ (flexGrow: 1)       │
 * ├─────────────────────┤
 * │ InputBar (sticky)   │
 * └─────────────────────┘
 */
const App: React.FC<AppProps> = ({ cwd, debugMode }) => (
  <AppContextProvider initialCwd={cwd} debugMode={debugMode}>
    <Box flexDirection="column" minHeight="100%">
      <Box flexShrink={0}>
        <TopBar cwd={cwd} debugMode={debugMode} />
      </Box>
      <ChatArea />
      <Box flexShrink={0}>
        <InputBar />
      </Box>
    </Box>
  </AppContextProvider>
);

export default App;
