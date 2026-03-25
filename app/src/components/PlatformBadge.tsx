import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, typography } from '../theme';

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: colors.tiktok,
  Instagram: colors.instagram,
  YouTube: colors.youtube,
  Facebook: colors.facebook,
  'Twitter/X': colors.twitter,
};

const PLATFORM_ICONS: Record<string, string> = {
  TikTok: '♪',
  Instagram: '◈',
  YouTube: '▶',
  Facebook: 'f',
  'Twitter/X': '✕',
};

interface Props {
  platform: string;
}

export default function PlatformBadge({ platform }: Props) {
  const color = PLATFORM_COLORS[platform] || colors.primary;
  const icon = PLATFORM_ICONS[platform] || '◉';

  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '44' }]}>
      <Text style={[styles.icon, { color }]}>{icon}</Text>
      <Text style={[styles.label, { color }]}>{platform}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
    gap: 4,
  },
  icon: {
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
});
