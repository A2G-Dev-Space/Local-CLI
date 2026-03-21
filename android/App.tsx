/**
 * LOCAL BOT — Android App Entry Point
 *
 * 스플래시 → 메인 전환, 화면 간 애니메이션
 */

import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, StyleSheet, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ThemeProvider } from './src/ui/theme/ThemeContext';
import { configManager } from './src/core/config/config-manager';
import ChatScreen from './src/ui/screens/ChatScreen';
import SettingsScreen from './src/ui/screens/SettingsScreen';
import SessionsScreen from './src/ui/screens/SessionsScreen';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  SlideInLeft,
  SlideOutLeft,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';

type Screen = 'chat' | 'settings' | 'sessions';

function SplashScreen({ onReady }: { onReady: () => void }) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withSequence(
      withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) }),
      withDelay(600, withTiming(1.2, { duration: 300 })),
    );

    const timer = setTimeout(onReady, 1400);
    return () => clearTimeout(timer);
  }, [scale, opacity, onReady]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <LinearGradient
      colors={['#0A0A18', '#12122A', '#0A0A18']}
      style={styles.splash}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0A0A18" />
      <Animated.View style={animStyle}>
        <LinearGradient
          colors={['#7C5CFC', '#A855F7', '#EC4899']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.splashOrb}
        >
          <Ionicons name="terminal" size={32} color="#FFFFFF" />
        </LinearGradient>
      </Animated.View>
    </LinearGradient>
  );
}

export default function App() {
  const [phase, setPhase] = useState<'splash' | 'ready'>('splash');
  const [screen, setScreen] = useState<Screen>('chat');

  useEffect(() => {
    configManager.initialize().catch(() => {});
  }, []);

  const finishSplash = useCallback(() => setPhase('ready'), []);

  if (phase === 'splash') {
    return <SplashScreen onReady={finishSplash} />;
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <ThemeProvider>
          {screen === 'chat' && (
            <Animated.View style={styles.screenFull} entering={FadeIn.duration(300)}>
              <ChatScreen
                onOpenSettings={() => setScreen('settings')}
                onOpenSessions={() => setScreen('sessions')}
              />
            </Animated.View>
          )}
          {screen === 'settings' && (
            <Animated.View
              style={styles.screenFull}
              entering={SlideInRight.duration(250)}
              exiting={SlideOutRight.duration(200)}
            >
              <SettingsScreen onBack={() => setScreen('chat')} />
            </Animated.View>
          )}
          {screen === 'sessions' && (
            <Animated.View
              style={styles.screenFull}
              entering={SlideInLeft.duration(250)}
              exiting={SlideOutLeft.duration(200)}
            >
              <SessionsScreen
                onBack={() => setScreen('chat')}
                onSelectSession={() => setScreen('chat')}
                onNewSession={() => setScreen('chat')}
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
  screenFull: { ...StyleSheet.absoluteFillObject },
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashOrb: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
