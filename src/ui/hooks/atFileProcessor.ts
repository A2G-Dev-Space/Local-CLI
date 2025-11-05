/**
 * @ File Processor
 *
 * Utilities for detecting @ triggers and processing file selections
 */

export interface AtTriggerInfo {
  detected: boolean;
  position: number;
  filter: string;
}

/**
 * Detect '@' trigger in input string
 * Returns position and filter text after @
 */
export function detectAtTrigger(input: string): AtTriggerInfo {
  // Find '@' at start or after space
  const atMatch = input.match(/(^|[\s])@([^\s]*?)$/);

  if (!atMatch) {
    return { detected: false, position: -1, filter: '' };
  }

  const position = atMatch.index! + atMatch[1]!.length; // Position of '@'
  const filter = atMatch[2] || ''; // Text after '@'

  return {
    detected: true,
    position,
    filter,
  };
}

/**
 * Insert file paths into input string at cursor position
 * Removes the '@' trigger and filter text
 * Ensures cursor is positioned right after the inserted path for continued typing
 */
export function insertFilePaths(
  input: string,
  atPosition: number,
  filterLength: number,
  filePaths: string[]
): string {
  // Remove '@filter' from input
  const before = input.slice(0, atPosition);
  const after = input.slice(atPosition + 1 + filterLength);

  // Format file paths as @path1 @path2 @path3
  const formattedPaths = filePaths.map((p) => `@${p}`).join(' ');

  // Insert paths with space after for continued typing
  // If there's text after the cursor, trim the result
  // Otherwise, keep trailing space so user can continue typing immediately
  if (after.trim()) {
    return `${before}${formattedPaths} ${after}`.trim();
  } else {
    // No text after cursor - add space for continued typing
    return `${before}${formattedPaths} `;
  }
}
