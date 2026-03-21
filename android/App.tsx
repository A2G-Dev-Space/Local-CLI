/**
 * LOCAL BOT — Android App (iOS-level design)
 *
 * Browser automation, localhost testing, file tools 지원
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider } from './src/ui/theme/ThemeContext';
import { configManager } from './src/core/config/config-manager';
import ChatScreen from './src/ui/screens/ChatScreen';
import SettingsScreen from './src/ui/screens/SettingsScreen';
import SessionsScreen from './src/ui/screens/SessionsScreen';
import BrowserScreen from './src/ui/screens/BrowserScreen';
import Animated, {
  FadeIn, FadeOut,
  SlideInRight, SlideOutRight,
  SlideInLeft, SlideOutLeft,
  SlideInUp, SlideOutDown,
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence, withDelay, Easing,
} from 'react-native-reanimated';

type Screen = 'chat' | 'settings' | 'sessions' | 'browser';

function Splash({ onDone }: { onDone: () => void }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 });
    scale.value = withSequence(
      withTiming(1, { duration: 500, easing: Easing.out(Easing.back(1.4)) }),
      withDelay(500, withTiming(0.9, { duration: 200 })),
    );
    const t = setTimeout(onDone, 1200);
    return () => clearTimeout(t);
  }, [scale, opacity, onDone]);

  const s = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));

  return (
    <View style={styles.splash}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      <Animated.View style={[styles.splashIcon, s]}>
        <Ionicons name="terminal" size={40} color="#0A84FF" />
      </Animated.View>
    </View>
  );
}

export default function App() {
  const [phase, setPhase] = useState<'splash' | 'app'>('splash');
  const [screen, setScreen] = useState<Screen>('chat');
  const [browserUrl, setBrowserUrl] = useState<string | undefined>(undefined);

  useEffect(() => { configManager.initialize().catch(() => {}); }, []);

  const openBrowser = useCallback((url?: string) => {
    setBrowserUrl(url);
    setScreen('browser');
  }, []);

  if (phase === 'splash') return <Splash onDone={() => setPhase('app')} />;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          {screen === 'chat' && (
            <Animated.View style={StyleSheet.absoluteFill} entering={FadeIn.duration(250)}>
              <ChatScreen
                onOpenSettings={() => setScreen('settings')}
                onOpenSessions={() => setScreen('sessions')}
                onOpenBrowser={openBrowser}
              />
            </Animated.View>
          )}
          {screen === 'settings' && (
            <Animated.View style={StyleSheet.absoluteFill}
              entering={SlideInRight.duration(300).easing(Easing.out(Easing.cubic))}
              exiting={SlideOutRight.duration(250)}
            >
              <SettingsScreen onBack={() => setScreen('chat')} />
            </Animated.View>
          )}
          {screen === 'sessions' && (
            <Animated.View style={StyleSheet.absoluteFill}
              entering={SlideInLeft.duration(300).easing(Easing.out(Easing.cubic))}
              exiting={SlideOutLeft.duration(250)}
            >
              <SessionsScreen
                onBack={() => setScreen('chat')}
                onSelectSession={() => setScreen('chat')}
                onNewSession={() => setScreen('chat')}
              />
            </Animated.View>
          )}
          {screen === 'browser' && (
            <Animated.View style={StyleSheet.absoluteFill}
              entering={SlideInUp.duration(300).easing(Easing.out(Easing.cubic))}
              exiting={SlideOutDown.duration(250)}
            >
              <BrowserScreen
                onBack={() => setScreen('chat')}
                initialUrl={browserUrl}
              />
            </Animated.View>
          )}
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  splashIcon: { width: 80, height: 80, borderRadius: 20, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
});
