/**
 * Progress Bar Component
 *
 * Displays a visual progress bar for task completion
 */

import React from 'react';
import { Box, Text } from 'ink';
import chalk from 'chalk';

export interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  width?: number;
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  current,
  total,
  label,
  width = 40,
  showPercentage = true,
}) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const filledWidth = Math.round((width * current) / total);
  const emptyWidth = width - filledWidth;

  const filledBar = '█'.repeat(filledWidth);
  const emptyBar = '░'.repeat(emptyWidth);

  return (
    <Box flexDirection="column">
      {label && (
        <Box marginBottom={0}>
          <Text>{label}</Text>
        </Box>
      )}
      <Box>
        <Text>
          {chalk.greenBright(filledBar)}
          {chalk.white(emptyBar)}
          {showPercentage && (
            <Text color="cyan"> {percentage}% ({current}/{total})</Text>
          )}
        </Text>
      </Box>
    </Box>
  );
};
