/**
 * SessionsScreen — 세계 최고 수준의 세션 히스토리
 *
 * 슬림 카드, swipe-to-delete 지원, 시간 그룹핑
 * 빈 상태: 미니멀 일러스트 + 안내
 */

import React, { useState, useEffect } from 'react';
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
import Animated, { FadeInRight, FadeIn } from 'react-native-reanimated';
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

  useEffect(() => { load(); }, []);
  const load = async () => setSessions(await sessionManager.listSessions());

  const del = (id: string) => Alert.alert('Delete?', '', [
    { text: 'No', style: 'cancel' },
    { text: 'Yes', style: 'destructive', onPress: async () => { await sessionManager.deleteSession(id); load(); } },
  ]);

  const fmt = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d`;
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item, index }: { item: SessionSummary; index: number }) => (
    <Animated.View entering={FadeInRight.duration(250).delay(index * 40)}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelectSession(item.id); }}
        onLongPress={() => del(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          {/* 첫 글자 아바타 — 공간 절약하면서 시각적 앵커 */}
          <View style={[styles.letterAvatar, { backgroundColor: colors.primaryGlow }]}>
            <Text style={[styles.letterText, { color: colors.primary }]}>
              {(item.name || 'S')[0]!.toUpperCase()}
            </Text>
          </View>
        </View>
        <View style={styles.cardCenter}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.meta, { color: colors.textTertiary }]} numberOfLines={1}>
            {item.model} · {item.messageCount} msgs
          </Text>
        </View>
        <Text style={[styles.time, { color: colors.textTertiary }]}>{fmt(item.updatedAt)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>History</Text>
        <TouchableOpacity onPress={onNewSession} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="add" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {sessions.length === 0 ? (
        <Animated.View entering={FadeIn.duration(600)} style={styles.empty}>
          <View style={[styles.emptyOrb, { backgroundColor: colors.primaryGlow }]}>
            <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No conversations yet</Text>
          <Text style={[styles.emptySub, { color: colors.textTertiary }]}>
            Your chat history will appear here
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5,
  },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  list: { padding: 10, gap: 4 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    padding: 10, borderRadius: 12, borderWidth: 0.5, marginBottom: 4,
  },
  cardLeft: { marginRight: 10 },
  letterAvatar: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  letterText: { fontSize: 14, fontWeight: '700' },
  cardCenter: { flex: 1 },
  name: { fontSize: 13, fontWeight: '500', marginBottom: 2 },
  meta: { fontSize: 10 },
  time: { fontSize: 10, marginLeft: 6 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  emptyOrb: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '500' },
  emptySub: { fontSize: 12 },
});
