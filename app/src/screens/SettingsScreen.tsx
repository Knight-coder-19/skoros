import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import { checkHealth, setBaseUrl } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_URL = 'http://10.0.2.2:8000';
const STORAGE_KEY = '@skoros_server_url';

export default function SettingsScreen() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_URL);
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'fail'>('idle');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved) {
        setServerUrl(saved);
        setBaseUrl(saved);
      }
    });
  }, []);

  const handleSave = async () => {
    const trimmed = serverUrl.trim().replace(/\/$/, '');
    await AsyncStorage.setItem(STORAGE_KEY, trimmed);
    setBaseUrl(trimmed);
    Alert.alert('Saved', 'Server URL updated.');
  };

  const handleTest = async () => {
    setTesting(true);
    setStatus('idle');
    const trimmed = serverUrl.trim().replace(/\/$/, '');
    setBaseUrl(trimmed);
    const ok = await checkHealth();
    setStatus(ok ? 'ok' : 'fail');
    setTesting(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Server Configuration</Text>
        <Text style={styles.sectionDesc}>
          Skoros needs a backend server to download media. You can run it locally or host it online.
        </Text>

        <Text style={styles.label}>Backend URL</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="http://192.168.1.x:8000"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <View style={styles.btnRow}>
          <TouchableOpacity style={styles.testBtn} onPress={handleTest} disabled={testing}>
            {testing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.testBtnText}>Test Connection</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        {status === 'ok' && (
          <Text style={styles.statusOk}>Connected successfully</Text>
        )}
        {status === 'fail' && (
          <Text style={styles.statusFail}>Could not connect. Make sure the server is running.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>How to run the server</Text>
        <View style={styles.step}>
          <Text style={styles.stepNum}>1</Text>
          <Text style={styles.stepText}>On your computer, go to the <Text style={styles.code}>skoros/backend</Text> folder</Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNum}>2</Text>
          <Text style={styles.stepText}>Run: <Text style={styles.code}>./start.sh</Text></Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNum}>3</Text>
          <Text style={styles.stepText}>Find your computer's local IP (e.g. 192.168.1.x) and enter it above</Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNum}>4</Text>
          <Text style={styles.stepText}>Make sure your phone and computer are on the same WiFi</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>Skoros v1.0.0</Text>
        <Text style={styles.aboutDesc}>
          Download videos and images from TikTok, Instagram, YouTube, Facebook and Twitter/X.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...typography.h1, color: colors.text, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  sectionTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  sectionDesc: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.md },
  label: { ...typography.bodySmall, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontSize: 14,
    marginBottom: spacing.md,
  },
  btnRow: { flexDirection: 'row', gap: spacing.sm },
  testBtn: {
    flex: 1,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    minHeight: 40,
    justifyContent: 'center',
  },
  testBtnText: { ...typography.button, color: colors.primary },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  saveBtnText: { ...typography.button, color: colors.white },
  statusOk: { ...typography.bodySmall, color: colors.success, marginTop: spacing.sm },
  statusFail: { ...typography.bodySmall, color: colors.error, marginTop: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, alignItems: 'flex-start' },
  stepNum: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary + '22',
    color: colors.primary,
    fontWeight: '700', fontSize: 12,
    textAlign: 'center', lineHeight: 24,
    borderWidth: 1, borderColor: colors.primary + '44',
  },
  stepText: { ...typography.bodySmall, color: colors.textSecondary, flex: 1 },
  code: { color: colors.primaryLight, fontFamily: 'monospace' },
  aboutText: { ...typography.body, color: colors.text, marginBottom: spacing.xs },
  aboutDesc: { ...typography.bodySmall, color: colors.textSecondary },
});
