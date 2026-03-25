import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Platform,
  Linking,
} from 'react-native';
import { colors, spacing, radius, typography } from '../theme';
import PlatformBadge from '../components/PlatformBadge';
import { getMediaInfo, MediaInfo } from '../services/api';
import RNFS from 'react-native-fs';
import api from '../services/api';

type DownloadState = 'idle' | 'fetching_info' | 'ready' | 'downloading' | 'done' | 'error';

export default function HomeScreen() {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<DownloadState>('idle');
  const [mediaInfo, setMediaInfo] = useState<MediaInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [progress, setProgress] = useState(0);
  const [selectedQuality, setSelectedQuality] = useState<'best' | 'medium' | 'low'>('best');
  const [savedPath, setSavedPath] = useState('');
  const progressAnim = useRef(new Animated.Value(0)).current;

  const animateProgress = (to: number) => {
    Animated.timing(progressAnim, {
      toValue: to,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleFetchInfo = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      Alert.alert('Paste a URL', 'Paste a link from TikTok, Instagram, YouTube or Facebook.');
      return;
    }

    setState('fetching_info');
    setMediaInfo(null);
    setErrorMsg('');
    setProgress(0);
    animateProgress(0);

    try {
      const info = await getMediaInfo(trimmed);
      setMediaInfo(info);
      setState('ready');
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to fetch media info.';
      setErrorMsg(msg);
      setState('error');
    }
  }, [url]);

  const handleDownload = useCallback(async () => {
    if (!mediaInfo || !url) return;
    setState('downloading');
    setProgress(0);
    animateProgress(0);

    try {
      const filename = `skoros_${Date.now()}.mp4`;
      const destPath = Platform.OS === 'android'
        ? `${RNFS.DownloadDirectoryPath}/${filename}`
        : `${RNFS.DocumentDirectoryPath}/${filename}`;

      const downloadDest = await RNFS.downloadFile({
        fromUrl: `${api.defaults.baseURL}/download`,
        toFile: destPath,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          quality: selectedQuality,
          media_type: mediaInfo.is_image ? 'image' : 'video',
        }),
        progress: (res) => {
          if (res.contentLength > 0) {
            const pct = res.bytesWritten / res.contentLength;
            setProgress(pct);
            animateProgress(pct);
          }
        },
      }).promise;

      if (downloadDest.statusCode === 200) {
        setSavedPath(destPath);
        setState('done');
        animateProgress(1);

        // On Android, scan the file so it appears in gallery
        if (Platform.OS === 'android') {
          await RNFS.scanFile(destPath);
        }
      } else {
        throw new Error(`Server returned ${downloadDest.statusCode}`);
      }
    } catch (err: any) {
      const msg = err?.message || 'Download failed. Please try again.';
      setErrorMsg(msg);
      setState('error');
    }
  }, [url, mediaInfo, selectedQuality]);

  const handleReset = () => {
    setState('idle');
    setUrl('');
    setMediaInfo(null);
    setErrorMsg('');
    setProgress(0);
    setSavedPath('');
    animateProgress(0);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>skoros</Text>
        <Text style={styles.tagline}>Download videos & images from social media</Text>
      </View>

      {/* Supported platforms row */}
      <View style={styles.platformRow}>
        {['TikTok', 'Instagram', 'YouTube', 'Facebook', 'Twitter/X'].map(p => (
          <PlatformBadge key={p} platform={p} />
        ))}
      </View>

      {/* URL Input */}
      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>Paste link here</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="https://www.tiktok.com/..."
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            multiline={false}
            editable={state !== 'fetching_info' && state !== 'downloading'}
          />
          {url.length > 0 && (
            <TouchableOpacity onPress={() => setUrl('')} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.fetchBtn,
            (state === 'fetching_info' || state === 'downloading') && styles.btnDisabled,
          ]}
          onPress={handleFetchInfo}
          disabled={state === 'fetching_info' || state === 'downloading'}
        >
          {state === 'fetching_info' ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.fetchBtnText}>Check Link</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Error */}
      {state === 'error' && (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMsg}>{errorMsg}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleFetchInfo}>
            <Text style={styles.retryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Media Info Card */}
      {(state === 'ready' || state === 'downloading' || state === 'done') && mediaInfo && (
        <View style={styles.mediaCard}>
          {/* Thumbnail */}
          {mediaInfo.thumbnail && (
            <Image
              source={{ uri: mediaInfo.thumbnail }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          )}

          <View style={styles.mediaInfo}>
            <PlatformBadge platform={mediaInfo.platform} />
            <Text style={styles.mediaTitle} numberOfLines={2}>{mediaInfo.title}</Text>
            {mediaInfo.uploader && (
              <Text style={styles.mediaUploader}>by {mediaInfo.uploader}</Text>
            )}
            {mediaInfo.duration && (
              <Text style={styles.mediaMeta}>{formatDuration(mediaInfo.duration)}</Text>
            )}
          </View>

          {/* Quality selector */}
          {!mediaInfo.is_image && state !== 'done' && (
            <View style={styles.qualitySection}>
              <Text style={styles.qualityLabel}>Quality</Text>
              <View style={styles.qualityRow}>
                {(['best', 'medium', 'low'] as const).map(q => (
                  <TouchableOpacity
                    key={q}
                    style={[
                      styles.qualityBtn,
                      selectedQuality === q && styles.qualityBtnActive,
                    ]}
                    onPress={() => setSelectedQuality(q)}
                    disabled={state === 'downloading'}
                  >
                    <Text style={[
                      styles.qualityBtnText,
                      selectedQuality === q && styles.qualityBtnTextActive,
                    ]}>
                      {q === 'best' ? 'Best' : q === 'medium' ? '720p' : '480p'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Download progress */}
          {state === 'downloading' && (
            <View style={styles.progressSection}>
              <Text style={styles.progressLabel}>
                Downloading... {Math.round(progress * 100)}%
              </Text>
              <View style={styles.progressTrack}>
                <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
              </View>
            </View>
          )}

          {/* Download button */}
          {state === 'ready' && (
            <TouchableOpacity style={styles.downloadBtn} onPress={handleDownload}>
              <Text style={styles.downloadBtnText}>
                {mediaInfo.is_image ? 'Save Image' : 'Download Video'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Done state */}
          {state === 'done' && (
            <View style={styles.doneSection}>
              <View style={styles.doneIcon}>
                <Text style={styles.doneIconText}>✓</Text>
              </View>
              <Text style={styles.doneTitle}>Saved successfully!</Text>
              <Text style={styles.donePath} numberOfLines={2}>{savedPath}</Text>
              <TouchableOpacity style={styles.newDownloadBtn} onPress={handleReset}>
                <Text style={styles.newDownloadBtnText}>Download Another</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Footer */}
      <Text style={styles.footer}>skoros — save anything, anywhere</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  logo: {
    fontSize: 42,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -2,
  },
  tagline: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  platformRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: spacing.md,
  },
  clearBtn: {
    padding: spacing.xs,
  },
  clearBtnText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  fetchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.5,
  },
  fetchBtnText: {
    ...typography.button,
    color: colors.white,
  },
  errorCard: {
    backgroundColor: colors.error + '15',
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error + '40',
    marginBottom: spacing.md,
  },
  errorTitle: {
    ...typography.h3,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  errorMsg: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  retryBtn: {
    backgroundColor: colors.error + '20',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  retryBtnText: {
    ...typography.button,
    color: colors.error,
  },
  mediaCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  thumbnail: {
    width: '100%',
    height: 200,
    backgroundColor: colors.surfaceElevated,
  },
  mediaInfo: {
    padding: spacing.lg,
    gap: spacing.xs,
  },
  mediaTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.xs,
  },
  mediaUploader: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  mediaMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  qualitySection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  qualityLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  qualityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  qualityBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  qualityBtnActive: {
    backgroundColor: colors.primary + '22',
    borderColor: colors.primary,
  },
  qualityBtnText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  qualityBtnTextActive: {
    color: colors.primaryLight,
  },
  progressSection: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  progressLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  downloadBtn: {
    margin: spacing.lg,
    marginTop: 0,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  downloadBtnText: {
    ...typography.button,
    color: colors.white,
  },
  doneSection: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  doneIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.success,
  },
  doneIconText: {
    fontSize: 24,
    color: colors.success,
    fontWeight: '700',
  },
  doneTitle: {
    ...typography.h3,
    color: colors.success,
    marginBottom: spacing.xs,
  },
  donePath: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  newDownloadBtn: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  newDownloadBtnText: {
    ...typography.button,
    color: colors.text,
  },
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
