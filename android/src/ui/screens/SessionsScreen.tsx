/**
 * SessionsScreen — 세션 히스토리 화면
 *
 * CLI의 SessionBrowser + Electron의 SessionBrowser에 대응
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { sessionManager, type SessionSummary } from '../../core/session/session-manager';
import Animated, { FadeInRight } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface SessionsScreenProps {
  onBack: () => void;
  onSelectSession: (sessionId: string) => void;
  onNewSession: () => void;
}

export default function SessionsScreen({ onBack, onSelectSession, onNewSession }: SessionsScreenProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const list = await sessionManager.listSessions();
    setSessions(list);
  };

  const handleDelete = (sessionId: string) => {
    Alert.alert('Delete Session', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await sessionManager.deleteSession(sessionId);
          loadSessions();
        },
      },
    ]);
  };

  const handleSelect = (sessionId: string) => {
    Haptics.selectionAsync().catch(() => {});
    onSelectSession(sessionId);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderSession = ({ item, index }: { item: SessionSummary; index: number }) => (
    <Animated.View entering={FadeInRight.duration(300).delay(index * 50)}>
      <TouchableOpacity
        style={[styles.sessionCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => handleSelect(item.id)}
        onLongPress={() => handleDelete(item.id)}
      >
        <View style={styles.sessionLeft}>
          <View style={[styles.sessionIcon, { backgroundColor: colors.primaryGlow }]}>
            <Ionicons name="chatbubbles" size={18} color={colors.primary} />
          </View>
        </View>

        <View style={styles.sessionInfo}>
          <Text style={[styles.sessionName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.sessionMeta}>
            <Text style={[styles.sessionModel, { color: colors.textTertiary }]}>
              {item.model}
            </Text>
            <Text style={[styles.sessionDot, { color: colors.textTertiary }]}>·</Text>
            <Text style={[styles.sessionMessages, { color: colors.textTertiary }]}>
              {item.messageCount} msgs
            </Text>
          </View>
        </View>

        <Text style={[styles.sessionDate, { color: colors.textTertiary }]}>
          {formatDate(item.updatedAt)}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Sessions</Text>
        <TouchableOpacity onPress={onNewSession} style={styles.headerButton}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No Sessions</Text>
          <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
            Start a conversation to see it here
          </Text>
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: { width: 40, alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  list: { padding: 12, gap: 8 },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  sessionLeft: { marginRight: 12 },
  sessionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 15, fontWeight: '500', marginBottom: 4 },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionModel: { fontSize: 12 },
  sessionDot: { fontSize: 12 },
  sessionMessages: { fontSize: 12 },
  sessionDate: { fontSize: 11, marginLeft: 8 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyTitle: { fontSize: 17, fontWeight: '500' },
  emptySubtext: { fontSize: 13 },
});
