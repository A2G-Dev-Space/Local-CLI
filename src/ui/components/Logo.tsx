/**
 * Logo Component
 *
 * ASCII art logo for LOCAL-CLI startup screen
 * With gradient animation and typing effects
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { createRequire } from 'module';

// Get version from package.json
const require = createRequire(import.meta.url);
const pkg = require('../../../package.json') as { version: string };
const VERSION = pkg.version;

// ASCII Art Logo for LOCAL-CLI (Terminal Style)
const LOGO_LINES = [
  '▛▀▀▀▀▀▀▜',
  '▌ ▶ ▁  ▐',
  '▙▄▄▄▄▄▄▟',
];

// Gradient colors (cycle through these)
const GRADIENT_COLORS = ['cyan', 'cyanBright', 'blue', 'magenta', 'magentaBright', 'cyan'] as const;

interface LogoProps {
  variant?: 'default' | 'compact' | 'animated';
  showVersion?: boolean;
  showTagline?: boolean;
  animate?: boolean;
  modelName?: string;
  workingDirectory?: string;
}

export const Logo: React.FC<LogoProps> = ({
  variant: _variant = 'default',
  showVersion = true,
  showTagline = true,
  animate = true,
  modelName,
  workingDirectory,
}) => {
  // variant reserved for future use (compact, animated modes)
  void _variant;
  const [colorIndex, setColorIndex] = useState(0);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const tagline = 'OpenAI-Compatible Local CLI Coding Agent';

  // Gradient color animation
  useEffect(() => {
    if (!animate) return;

    const interval = setInterval(() => {
      setColorIndex((prev) => (prev + 1) % GRADIENT_COLORS.length);
    }, 500);

    return () => clearInterval(interval);
  }, [animate]);

  // Typing effect for tagline
  useEffect(() => {
    if (!animate || !showTagline) {
      return undefined;
    }

    if (taglineIndex < tagline.length) {
      const timeout = setTimeout(() => {
        setTaglineIndex((prev) => prev + 1);
      }, 30);
      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [taglineIndex, animate, showTagline]);

  // Get color for each line (gradient effect)
  const getLineColor = (lineIndex: number): string => {
    const colorOffset = (colorIndex + lineIndex) % GRADIENT_COLORS.length;
    return GRADIENT_COLORS[colorOffset] ?? 'cyan';
  };

  return (
    <Box flexDirection="column" marginTop={2}>
      {/* Logo with info on the right - Claude Code style */}
      <Box flexDirection="row">
        {/* Logo column */}
        <Box flexDirection="column" marginRight={2}>
          {LOGO_LINES.map((line, idx) => (
            <Text key={idx} color={animate ? getLineColor(idx) : 'cyan'} bold>
              {line}
            </Text>
          ))}
        </Box>

        {/* Info column */}
        <Box flexDirection="column" justifyContent="center">
          {showVersion && (
            <Text color="white" bold>
              LOCAL-CLI v{VERSION}
            </Text>
          )}
          {modelName && (
            <Text color="gray" dimColor>
              {modelName}
            </Text>
          )}
          {workingDirectory && (
            <Text color="cyan" dimColor>
              {workingDirectory}
            </Text>
          )}
          {showTagline && !modelName && !workingDirectory && (
            <Text color="magenta" dimColor>
              {animate ? tagline.slice(0, taglineIndex) : tagline}
              {animate && taglineIndex < tagline.length && <Text color="white">_</Text>}
            </Text>
          )}
        </Box>
      </Box>
    </Box>
  );
};

/**
 * Animated Init Step Indicator
 * Shows progress through initialization steps with animations
 */
interface InitStepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  stepText: string;
  stepIcon: string;
}

export const InitStepIndicator: React.FC<InitStepIndicatorProps> = ({
  currentStep,
  totalSteps,
  stepText,
  stepIcon,
}) => {
  const [dotFrame, setDotFrame] = useState(0);
  const dots = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

  useEffect(() => {
    const interval = setInterval(() => {
      setDotFrame((prev) => (prev + 1) % dots.length);
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // Generate step indicators
  const renderSteps = () => {
    const steps = [];
    for (let i = 0; i < totalSteps; i++) {
      let icon: string;
      let color: string;

      if (i < currentStep) {
        // Completed
        icon = '✓';
        color = 'green';
      } else if (i === currentStep) {
        // Current (animated)
        icon = dots[dotFrame] ?? '⠋';
        color = 'yellow';
      } else {
        // Pending
        icon = '○';
        color = 'gray';
      }

      steps.push(
        <Text key={i} color={color}>
          {icon}
        </Text>
      );

      if (i < totalSteps - 1) {
        steps.push(
          <Text key={`arrow-${i}`} color="gray">
            {' → '}
          </Text>
        );
      }
    }
    return steps;
  };

  return (
    <Box flexDirection="column" alignItems="center">
      <Box>
        <Text color="yellow">
          {dots[dotFrame]} {stepIcon} {stepText}
        </Text>
      </Box>
      <Box marginTop={1}>{renderSteps()}</Box>
    </Box>
  );
};

export default Logo;
