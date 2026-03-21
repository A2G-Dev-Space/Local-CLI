/**
 * TodoPanel — 극한 컴팩트 진행 표시
 *
 * 접힌 상태: 1줄 프로그레스 스트립 (현재 작업 + 진행률)
 * 펼친 상태: 전체 리스트 (탭으로 토글)
 * 모바일에서 세로 공간을 최소화하면서 정보는 모두 전달
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import type { TodoItem } from '../../types';
import * as Haptics from 'expo-haptics';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface TodoPanelProps {
  todos: TodoItem[];
  title?: string;
}

const statusIcons: Record<string, { icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { icon: 'ellipse-outline' },
  in_progress: { icon: 'radio-button-on' },
  completed: { icon: 'checkmark-circle' },
  failed: { icon: 'close-circle' },
};

export default function TodoPanel({ todos, title }: TodoPanelProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (todos.length === 0) return null;

  const completed = todos.filter(t => t.status === 'completed').length;
  const current = todos.find(t => t.status === 'in_progress');
  const progress = completed / todos.length;

  const toggle = () => {
    Haptics.selectionAsync().catch(() => {});
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const getColor = (status: string) =>
    status === 'completed' ? colors.todoCompleted
    : status === 'in_progress' ? colors.todoInProgress
    : status === 'failed' ? colors.todoFailed
    : colors.todoPending;

  return (
    <Animated.View entering={FadeIn.duration(250)}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={toggle}
        style={[styles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {/* Progress bar 배경 */}
        <View style={[styles.progressBg, { backgroundColor: colors.border + '40' }]}>
          <View style={[
            styles.progressFill,
            { backgroundColor: colors.success, width: `${progress * 100}%` },
          ]} />
        </View>

        {/* 콘텐츠 */}
        <View style={styles.stripContent}>
          <Ionicons name="list" size={14} color={colors.primary} />
          <Text style={[styles.stripLabel, { color: colors.textSecondary }]} numberOfLines={1}>
            {current ? current.title : (title || 'Plan')}
          </Text>
          <Text style={[styles.stripCount, { color: colors.textTertiary }]}>
            {completed}/{todos.length}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={colors.textTertiary}
          />
        </View>
      </TouchableOpacity>

      {/* 확장된 리스트 */}
      {expanded && (
        <View style={[styles.expandedList, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {todos.map((todo, i) => (
            <Animated.View
              key={todo.id}
              entering={FadeInDown.duration(200).delay(i * 40)}
              style={styles.todoRow}
            >
              <Ionicons
                name={statusIcons[todo.status]?.icon || 'ellipse-outline'}
                size={14}
                color={getColor(todo.status)}
              />
              <Text
                style={[
                  styles.todoText,
                  {
                    color: todo.status === 'completed' ? colors.textTertiary : colors.text,
                    textDecorationLine: todo.status === 'completed' ? 'line-through' : 'none',
                  },
                ]}
                numberOfLines={1}
              >
                {todo.title}
              </Text>
            </Animated.View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  strip: {
    marginHorizontal: 10,
    marginVertical: 3,
    borderRadius: 10,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  progressBg: {
    height: 2,
  },
  progressFill: {
    height: '100%',
  },
  stripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 6,
  },
  stripLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
  },
  stripCount: {
    fontSize: 11,
    fontWeight: '600',
  },
  expandedList: {
    marginHorizontal: 10,
    marginBottom: 3,
    borderRadius: 10,
    borderWidth: 0.5,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  todoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
});
