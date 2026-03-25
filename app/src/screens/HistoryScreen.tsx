import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, typography } from '../theme';
import PlatformBadge from '../components/PlatformBadge';

const HISTORY_KEY = '@skoros_history';

export interface HistoryItem {
  id: string;
  url: string;
  title: string;
  platform: string;
  savedPath: string;
  date: string;
}

export const addToHistory = async (item: Omit<HistoryItem, 'id' | 'date'>) => {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const history: HistoryItem[] = raw ? JSON.parse(raw) : [];
    history.unshift({
      ...item,
      id: Date.now().toString(),
      date: new Date().toISOString(),
    });
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
  } catch {}
};

export default function HistoryScreen() {
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const load = useCallback(async () => {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    setHistory(raw ? JSON.parse(raw) : []);
  }, []);

  useEffect(() => { load(); }, []);

  const clearAll = () => {
    Alert.alert('Clear History', 'Remove all download history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear', style: 'destructive',
        onPress: async () => {
          await AsyncStorage.removeItem(HISTORY_KEY);
          setHistory([]);
        },
      },
    ]);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (history.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>↓</Text>
        <Text style={styles.emptyTitle}>No downloads yet</Text>
        <Text style={styles.emptyDesc}>Your download history will appear here.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <TouchableOpacity onPress={clearAll}>
          <Text style={styles.clearBtn}>Clear all</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={history}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemTop}>
              <PlatformBadge platform={item.platform} />
              <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
            </View>
            <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
            <Text style={styles.itemPath} numberOfLines={1}>{item.savedPath}</Text>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h2, color: colors.text },
  clearBtn: { ...typography.bodySmall, color: colors.error },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs },
  itemDate: { ...typography.caption, color: colors.textMuted },
  itemTitle: { ...typography.body, color: colors.text, marginBottom: spacing.xs },
  itemPath: { ...typography.caption, color: colors.textMuted },
  sep: { height: spacing.sm },
  empty: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyIcon: { fontSize: 48, color: colors.textMuted, marginBottom: spacing.md },
  emptyTitle: { ...typography.h3, color: colors.text, marginBottom: spacing.xs },
  emptyDesc: { ...typography.bodySmall, color: colors.textSecondary, textAlign: 'center' },
});
