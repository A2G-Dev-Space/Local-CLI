/**
 * SessionsScreen — iOS-style grouped list
 */

import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { sessionManager, type SessionSummary } from '../../core/session/session-manager';
import Animated, { FadeIn } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface Props {
  onBack: () => void;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export default function SessionsScreen({ onBack, onSelectSession, onNewSession }: Props) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [sessions, setSessions] = useState<SessionSummary[]>([]);

  useEffect(() => { load(); }, []);
  const load = async () => setSessions(await sessionManager.listSessions());

  const fmt = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  const renderItem = ({ item }: { item: SessionSummary }) => (
    <TouchableOpacity
      style={[styles.cell, { borderBottomColor: c.separator }]}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onSelectSession(item.id); }}
      onLongPress={() => Alert.alert('Delete?', item.name, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => { await sessionManager.deleteSession(item.id); load(); } },
      ])}
      activeOpacity={0.6}
    >
      <View style={styles.cellContent}>
        <Text style={[styles.cellTitle, { color: c.label }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.cellSub, { color: c.tertiaryLabel }]}>
          {item.model} · {item.messageCount} messages
        </Text>
      </View>
      <View style={styles.cellRight}>
        <Text style={[styles.cellTime, { color: c.tertiaryLabel }]}>{fmt(item.updatedAt)}</Text>
        <Ionicons name="chevron-forward" size={14} color={c.quaternaryLabel} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.groupedBackground, paddingTop: insets.top }]}>
      <View style={[styles.navBar, { backgroundColor: c.navBar, borderBottomColor: c.separator }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <View style={styles.backRow}>
            <Ionicons name="chevron-back" size={22} color={c.tint} />
            <Text style={[styles.backText, { color: c.tint }]}>Chat</Text>
          </View>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: c.navBarTitle }]}>History</Text>
        <TouchableOpacity onPress={onNewSession} hitSlop={12}>
          <Ionicons name="create-outline" size={22} color={c.tint} />
        </TouchableOpacity>
      </View>

      {sessions.length === 0 ? (
        <Animated.View entering={FadeIn.duration(500)} style={styles.empty}>
          <Ionicons name="chatbubbles-outline" size={36} color={c.tertiaryLabel} />
          <Text style={[styles.emptyTitle, { color: c.secondaryLabel }]}>No Conversations</Text>
          <Text style={[styles.emptySub, { color: c.tertiaryLabel }]}>
            Your chats will appear here
          </Text>
        </Animated.View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.list, { backgroundColor: c.elevated }]}
          style={{ marginTop: 20, marginHorizontal: 16, borderRadius: 10, overflow: 'hidden' }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  navBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    height: 44, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backRow: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 17, marginLeft: -2 },
  navTitle: { fontSize: 17, fontWeight: '600' },
  list: {},
  cell: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cellContent: { flex: 1 },
  cellTitle: { fontSize: 16, fontWeight: '400', marginBottom: 2 },
  cellSub: { fontSize: 13 },
  cellRight: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 },
  cellTime: { fontSize: 13 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '500' },
  emptySub: { fontSize: 14 },
});
