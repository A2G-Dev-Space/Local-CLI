/**
 * TodoPanel — iOS-style collapsible progress
 *
 * 접힌 상태: 현재 작업 + 프로그레스 인디케이터
 * 펼쳐도 iOS grouped table view 스타일
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, UIManager, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import type { TodoItem } from '../../types';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props { todos: TodoItem[]; }

export default function TodoPanel({ todos }: Props) {
  const { c } = useTheme();
  const [open, setOpen] = useState(false);

  if (!todos.length) return null;

  const done = todos.filter(t => t.status === 'completed').length;
  const current = todos.find(t => t.status === 'in_progress');
  const pct = done / todos.length;

  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(!open);
  };

  const color = (s: string) =>
    s === 'completed' ? c.todoDone : s === 'in_progress' ? c.todoActive : s === 'failed' ? c.todoFailed : c.todoPending;

  const icon = (s: string): keyof typeof Ionicons.glyphMap =>
    s === 'completed' ? 'checkmark-circle-outline' : s === 'in_progress' ? 'ellipsis-horizontal-circle' : s === 'failed' ? 'close-circle-outline' : 'circle-outline';

  return (
    <View style={[styles.wrap, { backgroundColor: c.secondaryBackground }]}>
      <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={styles.header}>
        <View style={[styles.progressRing]}>
          {/* Simple text progress */}
          <Text style={[styles.progressText, { color: c.tint }]}>{Math.round(pct * 100)}%</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerLabel, { color: c.label }]} numberOfLines={1}>
            {current?.title || 'Plan'}
          </Text>
          <Text style={[styles.headerMeta, { color: c.tertiaryLabel }]}>
            {done} of {todos.length} completed
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={c.tertiaryLabel} />
      </TouchableOpacity>

      {open && (
        <View style={[styles.list, { borderTopColor: c.separator }]}>
          {todos.map((t, i) => (
            <View key={t.id} style={[
              styles.item,
              i < todos.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.separator },
            ]}>
              <Ionicons name={icon(t.status)} size={18} color={color(t.status)} />
              <Text style={[
                styles.itemText,
                { color: t.status === 'completed' ? c.tertiaryLabel : c.label },
              ]} numberOfLines={2}>{t.title}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 12, marginVertical: 4, borderRadius: 12, overflow: 'hidden' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10, gap: 10,
  },
  progressRing: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  progressText: { fontSize: 11, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerLabel: { fontSize: 14, fontWeight: '500' },
  headerMeta: { fontSize: 11, marginTop: 1 },
  list: { borderTopWidth: StyleSheet.hairlineWidth },
  item: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 10, gap: 10,
  },
  itemText: { flex: 1, fontSize: 14 },
});
