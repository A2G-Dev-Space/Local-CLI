/**
 * SettingsScreen — 세계 최고 수준의 설정 화면
 *
 * 극한 컴팩트: 섹션 간격 16px, row 높이 42px, 인풋 높이 38px
 * 시각적 계층: Glass card + 미묘한 그림자
 * 인터랙션: 모든 터치에 haptic, 팔레트 선택에 스케일 애니메이션
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { configManager } from '../../core/config/config-manager';
import { ALL_PROVIDERS, PROVIDER_CONFIGS, type LLMProvider } from '../../core/llm/providers';
import type { EndpointConfig, ModelInfo } from '../../types';
import { APP_VERSION } from '../../core/constants';
import type { ColorPalette } from '../theme/colors';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { colors, mode, palette, setMode, setPalette } = useTheme();
  const insets = useSafeAreaInsets();
  const [endpoints, setEndpoints] = useState<EndpointConfig[]>([]);
  const [currentEndpointId, setCurrentEndpointId] = useState<string | undefined>();
  const [currentModelId, setCurrentModelId] = useState<string | undefined>();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', key: '', model: '', provider: 'other' as LLMProvider });

  useEffect(() => { reload(); }, []);
  const reload = () => {
    const c = configManager.getConfig();
    setEndpoints(c.endpoints);
    setCurrentEndpointId(c.currentEndpoint);
    setCurrentModelId(c.currentModel);
  };

  const addEndpoint = async () => {
    if (!form.name.trim() || !form.url.trim()) { Alert.alert('Error', 'Name and URL required'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const ep: EndpointConfig = {
      id: `ep-${Date.now()}`, name: form.name.trim(),
      baseUrl: form.url.trim().replace(/\/$/, ''),
      apiKey: form.key.trim() || undefined, provider: form.provider,
      models: form.model.trim() ? [{ id: form.model.trim(), name: form.model.trim(), maxTokens: 4096, enabled: true }] : [],
      createdAt: new Date(), updatedAt: new Date(),
    };
    await configManager.addEndpoint(ep); reload();
    setShowForm(false); setForm({ name: '', url: '', key: '', model: '', provider: 'other' });
  };

  const palettes: { id: ColorPalette; c1: string; c2: string }[] = [
    { id: 'default', c1: '#7C5CFC', c2: '#A855F7' },
    { id: 'rose', c1: '#F43F5E', c2: '#FB7185' },
    { id: 'mint', c1: '#10B981', c2: '#06B6D4' },
    { id: 'lavender', c1: '#A855F7', c2: '#EC4899' },
    { id: 'peach', c1: '#F97316', c2: '#F43F5E' },
    { id: 'sky', c1: '#0EA5E9', c2: '#6366F1' },
  ];

  const PaletteOrb = ({ p }: { p: typeof palettes[0] }) => {
    const s = useSharedValue(1);
    const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={() => { s.value = withSpring(0.85); }}
        onPressOut={() => { s.value = withSpring(1); }}
        onPress={() => { Haptics.selectionAsync().catch(() => {}); setPalette(p.id); }}
      >
        <Animated.View style={a}>
          <LinearGradient
            colors={[p.c1, p.c2]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[styles.paletteOrb, palette === p.id && styles.paletteSelected]}
          >
            {palette === p.id && <Ionicons name="checkmark" size={14} color="#FFF" />}
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const Row = ({ icon, label, selected, onPress, last }: {
    icon: keyof typeof Ionicons.glyphMap; label: string; selected: boolean; onPress: () => void; last?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.row, !last && { borderBottomWidth: 0.5, borderBottomColor: colors.separator }]}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress(); }}
      activeOpacity={0.7}
    >
      <Ionicons name={icon} size={16} color={selected ? colors.primary : colors.textTertiary} />
      <Text style={[styles.rowLabel, { color: colors.text }]}>{label}</Text>
      {selected && <Ionicons name="checkmark" size={16} color={colors.primary} />}
    </TouchableOpacity>
  );

  const Input = ({ value, onChangeText, placeholder, secure, kb }: {
    value: string; onChangeText: (t: string) => void; placeholder: string; secure?: boolean; kb?: 'url' | 'default';
  }) => (
    <TextInput
      style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
      value={value} onChangeText={onChangeText} placeholder={placeholder}
      placeholderTextColor={colors.placeholder} secureTextEntry={secure}
      autoCapitalize="none" keyboardType={kb || 'default'} selectionColor={colors.primary}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Compact header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* THEME */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>THEME</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Row icon="moon" label="Dark" selected={mode === 'dark'} onPress={() => setMode('dark')} />
          <Row icon="sunny" label="Light" selected={mode === 'light'} onPress={() => setMode('light')} />
          <Row icon="phone-portrait" label="System" selected={mode === 'system'} onPress={() => setMode('system')} last />
        </View>

        {/* PALETTE */}
        <View style={styles.paletteRow}>
          {palettes.map(p => <PaletteOrb key={p.id} p={p} />)}
        </View>

        {/* ENDPOINTS */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.textTertiary }]}>ENDPOINTS</Text>
          <TouchableOpacity onPress={() => setShowForm(!showForm)}>
            <Ionicons name={showForm ? 'close-circle' : 'add-circle'} size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {showForm && (
          <Animated.View entering={FadeInDown.duration(250)} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.formInner}>
              <Input value={form.name} onChangeText={v => setForm(p => ({ ...p, name: v }))} placeholder="Name" />
              <Input value={form.url} onChangeText={v => setForm(p => ({ ...p, url: v }))} placeholder="Base URL" kb="url" />
              <Input value={form.key} onChangeText={v => setForm(p => ({ ...p, key: v }))} placeholder="API Key" secure />
              <Input value={form.model} onChangeText={v => setForm(p => ({ ...p, model: v }))} placeholder="Model ID" />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {ALL_PROVIDERS.map(p => (
                  <TouchableOpacity
                    key={p} onPress={() => setForm(prev => ({ ...prev, provider: p }))}
                    style={[styles.chip, {
                      backgroundColor: form.provider === p ? colors.primary : colors.inputBackground,
                      borderColor: form.provider === p ? colors.primary : colors.inputBorder,
                    }]}
                  >
                    <Text style={[styles.chipText, { color: form.provider === p ? '#FFF' : colors.textSecondary }]}>
                      {PROVIDER_CONFIGS[p].name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={[styles.submitBtn, { backgroundColor: colors.primary }]} onPress={addEndpoint}>
                <Text style={styles.submitText}>Add</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {endpoints.map((ep, i) => (
          <Animated.View key={ep.id} entering={FadeInDown.duration(200).delay(i * 60)}>
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.epRow}
                onPress={async () => { Haptics.selectionAsync().catch(() => {}); await configManager.setCurrentEndpoint(ep.id); reload(); }}
              >
                <Ionicons
                  name={currentEndpointId === ep.id ? 'radio-button-on' : 'radio-button-off'}
                  size={16} color={currentEndpointId === ep.id ? colors.primary : colors.textTertiary}
                />
                <View style={styles.epInfo}>
                  <Text style={[styles.epName, { color: colors.text }]}>{ep.name}</Text>
                  <Text style={[styles.epUrl, { color: colors.textTertiary }]} numberOfLines={1}>{ep.baseUrl}</Text>
                </View>
                {ep.provider && (
                  <View style={[styles.providerBadge, { backgroundColor: colors.primaryGlow }]}>
                    <Text style={[styles.providerBadgeText, { color: colors.primary }]}>
                      {PROVIDER_CONFIGS[ep.provider]?.name || ep.provider}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={() => Alert.alert('Delete?', ep.name, [
                    { text: 'No', style: 'cancel' },
                    { text: 'Yes', style: 'destructive', onPress: async () => { await configManager.removeEndpoint(ep.id); reload(); } },
                  ])}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={15} color={colors.error + '80'} />
                </TouchableOpacity>
              </TouchableOpacity>

              {currentEndpointId === ep.id && ep.models.length > 0 && (
                <View style={[styles.modelSection, { borderTopColor: colors.separator }]}>
                  {ep.models.map(m => (
                    <TouchableOpacity
                      key={m.id} style={styles.modelRow}
                      onPress={async () => { Haptics.selectionAsync().catch(() => {}); await configManager.setCurrentModel(m.id); reload(); }}
                    >
                      <Ionicons
                        name={currentModelId === m.id ? 'checkmark-circle' : 'ellipse-outline'}
                        size={14} color={currentModelId === m.id ? colors.success : colors.textTertiary}
                      />
                      <Text style={[styles.modelText, { color: colors.text }]}>{m.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </Animated.View>
        ))}

        {endpoints.length === 0 && !showForm && (
          <View style={[styles.emptyCard, { borderColor: colors.border }]}>
            <Ionicons name="cloud-offline-outline" size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>No endpoints</Text>
          </View>
        )}

        {/* ABOUT */}
        <Text style={[styles.sectionLabel, { color: colors.textTertiary, marginTop: 20 }]}>ABOUT</Text>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Version</Text>
            <Text style={[styles.aboutVal, { color: colors.text }]}>v{APP_VERSION}</Text>
          </View>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
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
  scroll: { paddingHorizontal: 14, paddingTop: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1, marginBottom: 6, marginLeft: 2 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  card: { borderRadius: 12, borderWidth: 0.5, marginBottom: 8, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 10 },
  rowLabel: { flex: 1, fontSize: 14 },
  paletteRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginVertical: 12 },
  paletteOrb: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  paletteSelected: { borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.6)' },
  formInner: { padding: 10, gap: 6 },
  input: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 0.5, fontSize: 13,
  },
  chipScroll: { marginVertical: 4 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, borderWidth: 0.5, marginRight: 5 },
  chipText: { fontSize: 11, fontWeight: '500' },
  submitBtn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 2 },
  submitText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  epRow: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 8 },
  epInfo: { flex: 1 },
  epName: { fontSize: 13, fontWeight: '500' },
  epUrl: { fontSize: 10, marginTop: 1 },
  providerBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  providerBadgeText: { fontSize: 9, fontWeight: '600' },
  modelSection: { borderTopWidth: 0.5, paddingVertical: 2 },
  modelRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 28, paddingVertical: 6, gap: 6 },
  modelText: { fontSize: 12 },
  emptyCard: { borderRadius: 12, borderWidth: 0.5, borderStyle: 'dashed', padding: 24, alignItems: 'center', gap: 6, marginBottom: 8 },
  emptyText: { fontSize: 13 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10 },
  aboutLabel: { fontSize: 13 },
  aboutVal: { fontSize: 13, fontWeight: '500' },
});
