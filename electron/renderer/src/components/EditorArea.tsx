/**
 * EditorArea Component
 * Extracted from App.tsx for better code splitting
 * Handles the main editor area with split view support
 */

import React, { memo, useMemo } from 'react';
import type { EditorTab } from '../App';
import Editor from './Editor';
import SplitView, { type SplitPane } from './SplitView';

interface EditorAreaProps {
  tabs: EditorTab[];
  activeTab: EditorTab | null;
  activeTabId: string | null;
  setActiveTabId: (id: string | null) => void;
  closeTab: (id: string) => void;
  updateTabContent: (id: string, content: string) => void;
  saveFile: (id: string) => void;
  editorSplitEnabled: boolean;
  bottomPanelOpen: boolean;
  bottomPanelHeight: number;
}

const EditorArea: React.FC<EditorAreaProps> = ({
  tabs,
  activeTab,
  setActiveTabId,
  closeTab,
  updateTabContent,
  saveFile,
  editorSplitEnabled,
  bottomPanelOpen,
  bottomPanelHeight,
}) => {
  // Memoize the editor component to prevent re-renders
  const editorElement = useMemo(() => (
    <Editor
      tabs={tabs}
      activeTab={activeTab}
      onTabSelect={setActiveTabId}
      onTabClose={closeTab}
      onContentChange={updateTabContent}
      onSave={saveFile}
    />
  ), [tabs, activeTab, setActiveTabId, closeTab, updateTabContent, saveFile]);

  // Split view panes (only computed when split is enabled)
  const editorPanes = useMemo<SplitPane[]>(() => {
    if (!editorSplitEnabled) return [];

    return [
      {
        id: 'editor-left',
        content: editorElement,
        initialSize: 0.5,
        minSize: 200,
      },
      {
        id: 'editor-right',
        content: (
          <Editor
            tabs={tabs}
            activeTab={activeTab}
            onTabSelect={setActiveTabId}
            onTabClose={closeTab}
            onContentChange={updateTabContent}
            onSave={saveFile}
          />
        ),
        initialSize: 0.5,
        minSize: 200,
      },
    ];
  }, [editorSplitEnabled, tabs, activeTab, setActiveTabId, closeTab, updateTabContent, saveFile, editorElement]);

  return (
    <div
      className="editor-area"
      style={{ height: bottomPanelOpen ? `calc(100% - ${bottomPanelHeight}px)` : '100%' }}
    >
      {editorSplitEnabled ? (
        <SplitView
          direction="horizontal"
          panes={editorPanes}
          storageKey="editor-split"
          splitterSize={4}
        />
      ) : (
        editorElement
      )}
    </div>
  );
};

export default memo(EditorArea);
