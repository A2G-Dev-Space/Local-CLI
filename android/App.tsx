/**
 * LOCAL BOT — Android App Entry Point
 *
 * CLI/Electron과 동일한 코어 로직 기반의 Android 바이브 코딩 에이전트
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet } from 'react-native';
import { ThemeProvider } from './src/ui/theme/ThemeContext';
import { configManager } from './src/core/config/config-manager';
import ChatScreen from './src/ui/screens/ChatScreen';
import SettingsScreen from './src/ui/screens/SettingsScreen';
import SessionsScreen from './src/ui/screens/SessionsScreen';

type Screen = 'chat' | 'settings' | 'sessions';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('chat');

  useEffect(() => {
    (async () => {
      await configManager.initialize();
      setIsReady(true);
    })();
  }, []);

  const handleOpenSettings = useCallback(() => setCurrentScreen('settings'), []);
  const handleOpenSessions = useCallback(() => setCurrentScreen('sessions'), []);
  const handleBack = useCallback(() => setCurrentScreen('chat'), []);
  const handleSelectSession = useCallback((sessionId: string) => {
    // Will be handled by ChatScreen via hook
    setCurrentScreen('chat');
  }, []);
  const handleNewSession = useCallback(() => {
    setCurrentScreen('chat');
  }, []);

  if (!isReady) return null;

  const renderScreen = () => {
    switch (currentScreen) {
      case 'settings':
        return <SettingsScreen onBack={handleBack} />;
      case 'sessions':
        return (
          <SessionsScreen
            onBack={handleBack}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
          />
        );
      default:
        return (
          <ChatScreen
            onOpenSettings={handleOpenSettings}
            onOpenSessions={handleOpenSessions}
          />
        );
    }
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          {renderScreen()}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
