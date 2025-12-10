/**
 * Logo Component
 *
 * ASCII art logo for OPEN-CLI startup screen
 */

import React from 'react';
import { Box, Text } from 'ink';

// ASCII Art Logo for OPEN-CLI
const LOGO_LINES = [
  '   ____  _____  ______ _   _        _____ _      _____ ',
  '  / __ \\|  __ \\|  ____| \\ | |      / ____| |    |_   _|',
  ' | |  | | |__) | |__  |  \\| |_____| |    | |      | |  ',
  ' | |  | |  ___/|  __| | . ` |_____| |    | |      | |  ',
  ' | |__| | |    | |____| |\\  |     | |____| |____ _| |_ ',
  '  \\____/|_|    |______|_| \\_|      \\_____|______|_____|',
];

const COMPACT_LOGO_LINES = [
  ' ██████╗ ██████╗ ███████╗███╗   ██╗     ██████╗██╗     ██╗',
  '██╔═══██╗██╔══██╗██╔════╝████╗  ██║    ██╔════╝██║     ██║',
  '██║   ██║██████╔╝█████╗  ██╔██╗ ██║    ██║     ██║     ██║',
  '██║   ██║██╔═══╝ ██╔══╝  ██║╚██╗██║    ██║     ██║     ██║',
  '╚██████╔╝██║     ███████╗██║ ╚████║    ╚██████╗███████╗██║',
  ' ╚═════╝ ╚═╝     ╚══════╝╚═╝  ╚═══╝     ╚═════╝╚══════╝╚═╝',
];

interface LogoProps {
  variant?: 'default' | 'compact';
  showVersion?: boolean;
  showTagline?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  variant = 'default',
  showVersion = true,
  showTagline = true,
}) => {
  const logoLines = variant === 'compact' ? COMPACT_LOGO_LINES : LOGO_LINES;

  return (
    <Box flexDirection="column" alignItems="center">
      {/* Logo */}
      <Box flexDirection="column">
        {logoLines.map((line, idx) => (
          <Text key={idx} color="cyan" bold>
            {line}
          </Text>
        ))}
      </Box>

      {/* Version and Tagline */}
      <Box marginTop={1} flexDirection="column" alignItems="center">
        {showVersion && (
          <Text color="gray">
            v0.1.0 - Local LLM Coding Assistant
          </Text>
        )}
        {showTagline && (
          <Text color="magenta" dimColor>
            Enterprise-ready AI for offline environments
          </Text>
        )}
      </Box>
    </Box>
  );
};

export default Logo;
