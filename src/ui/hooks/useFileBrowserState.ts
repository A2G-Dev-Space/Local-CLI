/**
 * useFileBrowserState Hook
 *
 * Manages file browser state and file list caching
 */

import { useState, useEffect, useCallback } from 'react';
import { loadFileList, FileItem } from './useFileList.js';
import { detectAtTrigger, insertFilePaths } from './atFileProcessor.js';

export interface FileBrowserState {
  showFileBrowser: boolean;
  atPosition: number;
  filterText: string;
  cachedFileList: FileItem[];
  isLoadingFiles: boolean;
}

export interface FileBrowserActions {
  handleFileSelect: (filePaths: string[], input: string) => string;
  handleFileBrowserCancel: () => void;
  resetFileBrowser: () => void;
}

export function useFileBrowserState(
  input: string,
  isProcessing: boolean
): FileBrowserState & FileBrowserActions {
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [atPosition, setAtPosition] = useState(-1);
  const [filterText, setFilterText] = useState('');
  const [cachedFileList, setCachedFileList] = useState<FileItem[]>([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(true);

  // Load file list once on mount (background loading)
  useEffect(() => {
    let mounted = true;

    const preloadFiles = async () => {
      try {
        const files = await loadFileList();
        if (mounted) {
          setCachedFileList(files);
          setIsLoadingFiles(false);
        }
      } catch (error) {
        if (mounted) {
          console.error('Failed to preload file list:', error);
          setIsLoadingFiles(false);
        }
      }
    };

    preloadFiles();

    return () => {
      mounted = false;
    };
  }, []);

  // Monitor input for '@' trigger
  useEffect(() => {
    if (isProcessing) {
      return;
    }

    const triggerInfo = detectAtTrigger(input);

    if (triggerInfo.detected && !showFileBrowser) {
      setShowFileBrowser(true);
      setAtPosition(triggerInfo.position);
      setFilterText(triggerInfo.filter);
    } else if (triggerInfo.detected && showFileBrowser) {
      setFilterText(triggerInfo.filter);
    } else if (!triggerInfo.detected && showFileBrowser) {
      setShowFileBrowser(false);
      setAtPosition(-1);
      setFilterText('');
    }
  }, [input, isProcessing, showFileBrowser]);

  const handleFileSelect = useCallback(
    (filePaths: string[], currentInput: string): string => {
      const newInput = insertFilePaths(currentInput, atPosition, filterText.length, filePaths);
      setShowFileBrowser(false);
      setAtPosition(-1);
      setFilterText('');
      return newInput;
    },
    [atPosition, filterText.length]
  );

  const handleFileBrowserCancel = useCallback(() => {
    setShowFileBrowser(false);
    setAtPosition(-1);
    setFilterText('');
  }, []);

  const resetFileBrowser = useCallback(() => {
    setShowFileBrowser(false);
    setAtPosition(-1);
    setFilterText('');
  }, []);

  return {
    showFileBrowser,
    atPosition,
    filterText,
    cachedFileList,
    isLoadingFiles,
    handleFileSelect,
    handleFileBrowserCancel,
    resetFileBrowser,
  };
}
