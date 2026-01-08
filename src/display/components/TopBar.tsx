/**
 * TopBar component - Sticky header showing current working directory and debug status
 */

import React from "react";
import { Box, Text } from "ink";

interface TopBarProps {
  cwd: string;
  debugMode: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ cwd, debugMode }) => (
  <Box
    borderStyle="single"
    borderBottom
    paddingX={1}
    justifyContent="space-between"
    width="100%"
  >
    <Text dimColor>{cwd}</Text>
    {debugMode && (
      <Text bold color="yellow">
        DEBUG
      </Text>
    )}
  </Box>
);

export default TopBar;
