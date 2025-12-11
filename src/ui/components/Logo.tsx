/**
 * Logo Component
 *
 * ASCII art logo for OPEN-CLI startup screen
 * With gradient animation and typing effects
 */

import React, { useState, useEffect } from 'react';
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

// Gradient colors (cycle through these)
const GRADIENT_COLORS = ['cyan', 'cyanBright', 'blue', 'magenta', 'magentaBright', 'cyan'] as const;

interface LogoProps {
  variant?: 'default' | 'compact' | 'animated';
  showVersion?: boolean;
  showTagline?: boolean;
  animate?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  variant: _variant = 'default',
  showVersion = true,
  showTagline = true,
  animate = true,
}) => {
  // variant reserved for future use (compact, animated modes)
  void _variant;
  const [colorIndex, setColorIndex] = useState(0);
  const [taglineIndex, setTaglineIndex] = useState(0);
  const tagline = 'Enterprise-ready AI for offline environments';

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
    <Box flexDirection="column" alignItems="center">
      {/* Logo */}
      <Box flexDirection="column">
        {LOGO_LINES.map((line, idx) => (
          <Text key={idx} color={animate ? getLineColor(idx) : 'cyan'} bold>
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
            {animate ? tagline.slice(0, taglineIndex) : tagline}
            {animate && taglineIndex < tagline.length && (
              <Text color="white">_</Text>
            )}
          </Text>
        )}
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
