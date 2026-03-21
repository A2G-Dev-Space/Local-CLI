/**
 * TodoPanel Component
 *
 * Plan & Execute의 TODO 리스트 표시 — CLI/Electron 패리티
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeContext';
import Animated, { FadeInLeft, FadeIn } from 'react-native-reanimated';
import type { TodoItem } from '../../types';

interface TodoPanelProps {
  todos: TodoItem[];
  title?: string;
}

const statusConfig = {
  pending: { icon: 'ellipse-outline' as const, label: 'Pending' },
  in_progress: { icon: 'sync' as const, label: 'In Progress' },
  completed: { icon: 'checkmark-circle' as const, label: 'Done' },
  failed: { icon: 'close-circle' as const, label: 'Failed' },
};

export default function TodoPanel({ todos, title }: TodoPanelProps) {
  const { colors } = useTheme();

  if (todos.length === 0) return null;

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const progress = todos.length > 0 ? completedCount / todos.length : 0;

  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      style={[styles.container, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="list" size={16} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {title || 'Plan'}
          </Text>
        </View>
        <Text style={[styles.progress, { color: colors.textSecondary }]}>
          {completedCount}/{todos.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: colors.success,
              width: `${progress * 100}%`,
            },
          ]}
        />
      </View>

      {/* Items */}
      <View style={styles.items}>
        {todos.map((todo, index) => {
          const config = statusConfig[todo.status];
          const statusColor =
            todo.status === 'completed' ? colors.todoCompleted
            : todo.status === 'in_progress' ? colors.todoInProgress
            : todo.status === 'failed' ? colors.todoFailed
            : colors.todoPending;

          return (
            <Animated.View
              key={todo.id}
              entering={FadeInLeft.duration(300).delay(index * 50)}
              style={styles.todoItem}
            >
              <Ionicons name={config.icon} size={18} color={statusColor} />
              <Text
                style={[
                  styles.todoTitle,
                  {
                    color: todo.status === 'completed' ? colors.textTertiary : colors.text,
                    textDecorationLine: todo.status === 'completed' ? 'line-through' : 'none',
                  },
                ]}
                numberOfLines={2}
              >
                {todo.title}
              </Text>
            </Animated.View>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  progress: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressBar: {
    height: 3,
    borderRadius: 2,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  items: {
    gap: 8,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  todoTitle: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
});
