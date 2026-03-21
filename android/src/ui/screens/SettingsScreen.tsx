/**
 * SettingsScreen — 설정 화면
 *
 * CLI의 SettingsDialog + Electron의 Settings에 대응
 * 엔드포인트/모델/프로바이더 관리
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { configManager } from '../../core/config/config-manager';
import { ALL_PROVIDERS, PROVIDER_CONFIGS, type LLMProvider } from '../../core/llm/providers';
import type { EndpointConfig, ModelInfo } from '../../types';
import { APP_VERSION } from '../../core/constants';
import type { ColorPalette } from '../theme/colors';
import * as Haptics from 'expo-haptics';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { colors, mode, palette, setMode, setPalette, resolvedMode } = useTheme();
  const insets = useSafeAreaInsets();
  const [endpoints, setEndpoints] = useState<EndpointConfig[]>([]);
  const [currentEndpointId, setCurrentEndpointId] = useState<string | undefined>();
  const [currentModelId, setCurrentModelId] = useState<string | undefined>();
  const [showAddEndpoint, setShowAddEndpoint] = useState(false);

  // Add endpoint form
  const [newName, setNewName] = useState('');
  const [newBaseUrl, setNewBaseUrl] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newProvider, setNewProvider] = useState<LLMProvider>('other');
  const [newModelName, setNewModelName] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const config = configManager.getConfig();
    setEndpoints(config.endpoints);
    setCurrentEndpointId(config.currentEndpoint);
    setCurrentModelId(config.currentModel);
  };

  const handleAddEndpoint = async () => {
    if (!newName.trim() || !newBaseUrl.trim()) {
      Alert.alert('Error', 'Name and Base URL are required');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

    const models: ModelInfo[] = newModelName.trim()
      ? [{
          id: newModelName.trim(),
          name: newModelName.trim(),
          maxTokens: 4096,
          enabled: true,
        }]
      : [];

    const endpoint: EndpointConfig = {
      id: `ep-${Date.now()}`,
      name: newName.trim(),
      baseUrl: newBaseUrl.trim().replace(/\/$/, ''),
      apiKey: newApiKey.trim() || undefined,
      provider: newProvider,
      models,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await configManager.addEndpoint(endpoint);
    loadSettings();
    setShowAddEndpoint(false);
    setNewName('');
    setNewBaseUrl('');
    setNewApiKey('');
    setNewModelName('');
    setNewProvider('other');
  };

  const handleSelectEndpoint = async (endpointId: string) => {
    Haptics.selectionAsync().catch(() => {});
    await configManager.setCurrentEndpoint(endpointId);
    loadSettings();
  };

  const handleSelectModel = async (modelId: string) => {
    Haptics.selectionAsync().catch(() => {});
    await configManager.setCurrentModel(modelId);
    loadSettings();
  };

  const handleDeleteEndpoint = (endpointId: string) => {
    Alert.alert('Delete Endpoint', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await configManager.removeEndpoint(endpointId);
          loadSettings();
        },
      },
    ]);
  };

  const palettes: { id: ColorPalette; name: string; color: string }[] = [
    { id: 'default', name: 'Violet', color: '#7C5CFC' },
    { id: 'rose', name: 'Rose', color: '#F43F5E' },
    { id: 'mint', name: 'Mint', color: '#10B981' },
    { id: 'lavender', name: 'Lavender', color: '#A855F7' },
    { id: 'peach', name: 'Peach', color: '#F97316' },
    { id: 'sky', name: 'Sky', color: '#0EA5E9' },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Settings</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Theme Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>APPEARANCE</Text>

          {/* Theme mode */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(['dark', 'light', 'system'] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.optionRow,
                  m !== 'system' && { borderBottomWidth: 1, borderBottomColor: colors.separator },
                ]}
                onPress={() => setMode(m)}
              >
                <Ionicons
                  name={m === 'dark' ? 'moon' : m === 'light' ? 'sunny' : 'phone-portrait'}
                  size={20}
                  color={mode === m ? colors.primary : colors.textSecondary}
                />
                <Text style={[styles.optionText, { color: colors.text }]}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </Text>
                {mode === m && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Color palette */}
          <View style={[styles.paletteRow]}>
            {palettes.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => setPalette(p.id)}
                style={[
                  styles.paletteCircle,
                  { backgroundColor: p.color },
                  palette === p.id && styles.paletteSelected,
                ]}
              >
                {palette === p.id && (
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Endpoints Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ENDPOINTS</Text>
            <TouchableOpacity onPress={() => setShowAddEndpoint(!showAddEndpoint)}>
              <Ionicons
                name={showAddEndpoint ? 'close' : 'add-circle'}
                size={22}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>

          {/* Add endpoint form */}
          {showAddEndpoint && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                placeholder="Endpoint Name"
                placeholderTextColor={colors.placeholder}
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                placeholder="Base URL (e.g., https://api.openai.com/v1)"
                placeholderTextColor={colors.placeholder}
                value={newBaseUrl}
                onChangeText={setNewBaseUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                placeholder="API Key (optional)"
                placeholderTextColor={colors.placeholder}
                value={newApiKey}
                onChangeText={setNewApiKey}
                secureTextEntry
                autoCapitalize="none"
              />
              <TextInput
                style={[styles.input, { color: colors.text, backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}
                placeholder="Model Name (e.g., gpt-4o)"
                placeholderTextColor={colors.placeholder}
                value={newModelName}
                onChangeText={setNewModelName}
                autoCapitalize="none"
              />

              {/* Provider picker */}
              <Text style={[styles.label, { color: colors.textSecondary }]}>Provider</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.providerScroll}>
                {ALL_PROVIDERS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setNewProvider(p)}
                    style={[
                      styles.providerChip,
                      {
                        backgroundColor: newProvider === p ? colors.primary : colors.inputBackground,
                        borderColor: newProvider === p ? colors.primary : colors.inputBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.providerChipText,
                        { color: newProvider === p ? '#FFFFFF' : colors.textSecondary },
                      ]}
                    >
                      {PROVIDER_CONFIGS[p].name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: colors.primary }]}
                onPress={handleAddEndpoint}
              >
                <Text style={styles.addButtonText}>Add Endpoint</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Endpoint list */}
          {endpoints.map((ep) => (
            <View key={ep.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                style={styles.endpointHeader}
                onPress={() => handleSelectEndpoint(ep.id)}
              >
                <View style={styles.endpointInfo}>
                  <View style={styles.endpointNameRow}>
                    <Ionicons
                      name={currentEndpointId === ep.id ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={currentEndpointId === ep.id ? colors.primary : colors.textTertiary}
                    />
                    <Text style={[styles.endpointName, { color: colors.text }]}>{ep.name}</Text>
                  </View>
                  <Text style={[styles.endpointUrl, { color: colors.textTertiary }]} numberOfLines={1}>
                    {ep.baseUrl}
                  </Text>
                  {ep.provider && (
                    <Text style={[styles.endpointProvider, { color: colors.primary }]}>
                      {PROVIDER_CONFIGS[ep.provider]?.name || ep.provider}
                    </Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDeleteEndpoint(ep.id)}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </TouchableOpacity>
              </TouchableOpacity>

              {/* Models */}
              {currentEndpointId === ep.id && ep.models.length > 0 && (
                <View style={[styles.modelList, { borderTopColor: colors.separator }]}>
                  {ep.models.map((model) => (
                    <TouchableOpacity
                      key={model.id}
                      style={styles.modelRow}
                      onPress={() => handleSelectModel(model.id)}
                    >
                      <Ionicons
                        name={currentModelId === model.id ? 'checkmark-circle' : 'ellipse-outline'}
                        size={16}
                        color={currentModelId === model.id ? colors.success : colors.textTertiary}
                      />
                      <Text style={[styles.modelName, { color: colors.text }]}>{model.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ))}

          {endpoints.length === 0 && !showAddEndpoint && (
            <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="cloud-offline" size={32} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No endpoints configured
              </Text>
              <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
                Tap + to add an endpoint
              </Text>
            </View>
          )}
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ABOUT</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.aboutRow}>
              <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Version</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]}>v{APP_VERSION}</Text>
            </View>
            <View style={[styles.aboutRow, { borderTopWidth: 1, borderTopColor: colors.separator }]}>
              <Text style={[styles.aboutLabel, { color: colors.textSecondary }]}>Platform</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]}>Android</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  backButton: { width: 40 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  scroll: { flex: 1 },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 10,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  optionText: { flex: 1, fontSize: 15 },
  paletteRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
    justifyContent: 'center',
  },
  paletteCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteSelected: {
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  input: {
    marginHorizontal: 12,
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
  },
  label: {
    marginHorizontal: 14,
    marginTop: 12,
    fontSize: 12,
    fontWeight: '500',
  },
  providerScroll: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  providerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 6,
  },
  providerChipText: { fontSize: 12, fontWeight: '500' },
  addButton: {
    margin: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  endpointHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  endpointInfo: { flex: 1 },
  endpointNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  endpointName: { fontSize: 15, fontWeight: '500' },
  endpointUrl: { fontSize: 12, marginTop: 2, marginLeft: 26 },
  endpointProvider: { fontSize: 11, marginTop: 2, marginLeft: 26, fontWeight: '500' },
  modelList: { borderTopWidth: 1, paddingVertical: 4 },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 8,
    gap: 8,
  },
  modelName: { fontSize: 13 },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 15, fontWeight: '500' },
  emptySubtext: { fontSize: 13 },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  aboutLabel: { fontSize: 14 },
  aboutValue: { fontSize: 14, fontWeight: '500' },
});
