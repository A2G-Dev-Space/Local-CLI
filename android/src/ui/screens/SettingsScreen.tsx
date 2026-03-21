/**
 * SettingsScreen — iOS Settings.app style
 *
 * Grouped inset table view, hairline separators, no borders
 * SF-style typography hierarchy
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { configManager } from '../../core/config/config-manager';
import { ALL_PROVIDERS, PROVIDER_CONFIGS, type LLMProvider } from '../../core/llm/providers';
import type { EndpointConfig, ModelInfo } from '../../types';
import { APP_VERSION } from '../../core/constants';
import type { ColorPalette } from '../theme/colors';
import * as Haptics from 'expo-haptics';

interface Props { onBack: () => void; }

export default function SettingsScreen({ onBack }: Props) {
  const { c, isDark, mode, palette, setMode, setPalette } = useTheme();
  const insets = useSafeAreaInsets();
  const [eps, setEps] = useState<EndpointConfig[]>([]);
  const [curEp, setCurEp] = useState<string>();
  const [curModel, setCurModel] = useState<string>();
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ name: '', url: '', key: '', model: '', provider: 'other' as LLMProvider });

  useEffect(() => { reload(); }, []);
  const reload = () => { const cfg = configManager.getConfig(); setEps(cfg.endpoints); setCurEp(cfg.currentEndpoint); setCurModel(cfg.currentModel); };

  const addEp = async () => {
    if (!f.name.trim() || !f.url.trim()) { Alert.alert('Error', 'Name and URL required'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    await configManager.addEndpoint({
      id: `ep-${Date.now()}`, name: f.name.trim(), baseUrl: f.url.trim().replace(/\/$/, ''),
      apiKey: f.key.trim() || undefined, provider: f.provider,
      models: f.model.trim() ? [{ id: f.model.trim(), name: f.model.trim(), maxTokens: 4096, enabled: true }] : [],
      createdAt: new Date(), updatedAt: new Date(),
    });
    reload(); setShowForm(false); setF({ name: '', url: '', key: '', model: '', provider: 'other' });
  };

  // iOS-style grouped cell
  const Cell = ({ label, icon, checked, onPress, destructive, last }: {
    label: string; icon?: keyof typeof Ionicons.glyphMap; checked?: boolean; onPress?: () => void; destructive?: boolean; last?: boolean;
  }) => (
    <TouchableOpacity
      style={[styles.cell, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.separator }]}
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      activeOpacity={0.6}
    >
      {icon && <Ionicons name={icon} size={17} color={destructive ? c.destructive : c.tint} style={styles.cellIcon} />}
      <Text style={[styles.cellLabel, { color: destructive ? c.destructive : c.label }]}>{label}</Text>
      {checked && <Ionicons name="checkmark" size={18} color={c.tint} />}
    </TouchableOpacity>
  );

  const palettes: { id: ColorPalette; c1: string; c2: string }[] = [
    { id: 'default', c1: '#0A84FF', c2: '#5E5CE6' },
    { id: 'rose', c1: '#FF375F', c2: '#FF9F0A' },
    { id: 'mint', c1: '#00C7BE', c2: '#30D158' },
    { id: 'lavender', c1: '#BF5AF2', c2: '#FF375F' },
    { id: 'peach', c1: '#FF9F0A', c2: '#FF375F' },
    { id: 'sky', c1: '#64D2FF', c2: '#5E5CE6' },
  ];

  const Input = ({ value, onChange, placeholder, secure, kb }: any) => (
    <TextInput
      style={[styles.input, { color: c.label, backgroundColor: c.searchBar }]}
      value={value} onChangeText={onChange} placeholder={placeholder}
      placeholderTextColor={c.tertiaryLabel} secureTextEntry={secure}
      autoCapitalize="none" keyboardType={kb || 'default'} selectionColor={c.tint}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: c.groupedBackground, paddingTop: insets.top }]}>
      {/* iOS nav bar */}
      <View style={[styles.navBar, { backgroundColor: c.navBar, borderBottomColor: c.separator }]}>
        <TouchableOpacity onPress={onBack} hitSlop={12}>
          <View style={styles.backRow}>
            <Ionicons name="chevron-back" size={22} color={c.tint} />
            <Text style={[styles.backText, { color: c.tint }]}>Back</Text>
          </View>
        </TouchableOpacity>
        <Text style={[styles.navTitle, { color: c.navBarTitle }]}>Settings</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* APPEARANCE */}
        <Text style={[styles.sectionHeader, { color: c.secondaryLabel }]}>APPEARANCE</Text>
        <View style={[styles.group, { backgroundColor: c.elevated }]}>
          <Cell icon="moon-outline" label="Dark" checked={mode === 'dark'} onPress={() => setMode('dark')} />
          <Cell icon="sunny-outline" label="Light" checked={mode === 'light'} onPress={() => setMode('light')} />
          <Cell icon="phone-portrait-outline" label="System" checked={mode === 'system'} onPress={() => setMode('system')} last />
        </View>

        {/* Palette */}
        <View style={styles.paletteRow}>
          {palettes.map(p => (
            <TouchableOpacity
              key={p.id}
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setPalette(p.id); }}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[p.c1, p.c2]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[styles.paletteOrb, palette === p.id && styles.paletteActive]}
              >
                {palette === p.id && <Ionicons name="checkmark" size={16} color="#FFF" />}
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </View>

        {/* ENDPOINTS */}
        <View style={styles.sectionRow}>
          <Text style={[styles.sectionHeader, { color: c.secondaryLabel }]}>ENDPOINTS</Text>
          <TouchableOpacity onPress={() => setShowForm(!showForm)}>
            <Ionicons name={showForm ? 'close-circle' : 'add-circle'} size={20} color={c.tint} />
          </TouchableOpacity>
        </View>

        {showForm && (
          <View style={[styles.group, { backgroundColor: c.elevated }]}>
            <View style={styles.formInner}>
              <Input value={f.name} onChange={(v: string) => setF(p => ({ ...p, name: v }))} placeholder="Name" />
              <Input value={f.url} onChange={(v: string) => setF(p => ({ ...p, url: v }))} placeholder="https://api.example.com/v1" kb="url" />
              <Input value={f.key} onChange={(v: string) => setF(p => ({ ...p, key: v }))} placeholder="API Key" secure />
              <Input value={f.model} onChange={(v: string) => setF(p => ({ ...p, model: v }))} placeholder="Model ID (e.g. gpt-4o)" />

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                {ALL_PROVIDERS.map(p => (
                  <TouchableOpacity
                    key={p} onPress={() => setF(prev => ({ ...prev, provider: p }))}
                    style={[styles.chip, { backgroundColor: f.provider === p ? c.tint : c.searchBar }]}
                  >
                    <Text style={[styles.chipText, { color: f.provider === p ? '#FFF' : c.secondaryLabel }]}>
                      {PROVIDER_CONFIGS[p].name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity style={[styles.addBtn, { backgroundColor: c.tint }]} onPress={addEp}>
                <Text style={styles.addBtnText}>Add Endpoint</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {eps.map(ep => (
          <View key={ep.id} style={[styles.group, { backgroundColor: c.elevated }]}>
            <TouchableOpacity
              style={styles.epRow}
              onPress={async () => { Haptics.selectionAsync().catch(() => {}); await configManager.setCurrentEndpoint(ep.id); reload(); }}
              activeOpacity={0.6}
            >
              <Ionicons
                name={curEp === ep.id ? 'checkmark-circle-fill' : 'circle'}
                size={20} color={curEp === ep.id ? c.tint : c.tertiaryLabel}
              />
              <View style={styles.epInfo}>
                <Text style={[styles.epName, { color: c.label }]}>{ep.name}</Text>
                <Text style={[styles.epUrl, { color: c.tertiaryLabel }]} numberOfLines={1}>{ep.baseUrl}</Text>
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert('Delete Endpoint?', ep.name, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: async () => { await configManager.removeEndpoint(ep.id); reload(); } },
                ])}
                hitSlop={12}
              >
                <Ionicons name="trash-outline" size={16} color={c.destructive} />
              </TouchableOpacity>
            </TouchableOpacity>

            {curEp === ep.id && ep.models.map((m, mi) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.modelRow, mi === 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.separator }]}
                onPress={async () => { Haptics.selectionAsync().catch(() => {}); await configManager.setCurrentModel(m.id); reload(); }}
                activeOpacity={0.6}
              >
                <Ionicons
                  name={curModel === m.id ? 'checkmark' : 'remove'}
                  size={16} color={curModel === m.id ? c.todoDone : 'transparent'}
                />
                <Text style={[styles.modelText, { color: c.label }]}>{m.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}

        {eps.length === 0 && !showForm && (
          <View style={[styles.emptyGroup, { backgroundColor: c.elevated }]}>
            <Ionicons name="cloud-offline-outline" size={24} color={c.tertiaryLabel} />
            <Text style={[styles.emptyText, { color: c.tertiaryLabel }]}>No endpoints configured</Text>
          </View>
        )}

        {/* ABOUT */}
        <Text style={[styles.sectionHeader, { color: c.secondaryLabel, marginTop: 20 }]}>ABOUT</Text>
        <View style={[styles.group, { backgroundColor: c.elevated }]}>
          <View style={styles.aboutRow}>
            <Text style={[styles.aboutLabel, { color: c.label }]}>Version</Text>
            <Text style={[styles.aboutVal, { color: c.secondaryLabel }]}>v{APP_VERSION}</Text>
          </View>
        </View>

        <Text style={[styles.footer, { color: c.quaternaryLabel }]}>
          LOCAL BOT — OpenAI Compatible Agent
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  scroll: { paddingTop: 20 },
  sectionHeader: { fontSize: 13, fontWeight: '400', marginBottom: 6, paddingHorizontal: 32, textTransform: 'uppercase' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 32, marginBottom: 6 },
  group: {
    marginHorizontal: 16, borderRadius: 10, marginBottom: 16, overflow: 'hidden',
    // iOS uses elevation via shadow, not border
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cell: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 16,
  },
  cellIcon: { marginRight: 12, width: 22 },
  cellLabel: { flex: 1, fontSize: 16, letterSpacing: -0.3 },
  paletteRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 },
  paletteOrb: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  paletteActive: { borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  formInner: { padding: 12, gap: 8 },
  input: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, fontSize: 15 },
  chipScroll: { marginVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginRight: 6 },
  chipText: { fontSize: 13, fontWeight: '500' },
  addBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  addBtnText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
  epRow: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 10 },
  epInfo: { flex: 1 },
  epName: { fontSize: 16 },
  epUrl: { fontSize: 12, marginTop: 1 },
  modelRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 44, paddingVertical: 10, gap: 8 },
  modelText: { fontSize: 15 },
  emptyGroup: {
    marginHorizontal: 16, borderRadius: 10, padding: 28, alignItems: 'center', gap: 8, marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  emptyText: { fontSize: 14 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  aboutLabel: { fontSize: 16 },
  aboutVal: { fontSize: 16 },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 16, marginBottom: 8 },
});
