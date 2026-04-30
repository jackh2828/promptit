import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

type Mode = 'url' | 'extracting' | 'review' | 'manual';

const PLATFORMS = ['TikTok', 'Instagram', 'X/Twitter', 'Reddit'];
const PLATFORM_COLORS: Record<string, string> = {
  TikTok: '#FF0050',
  Instagram: '#C13584',
  'X/Twitter': '#1DA1F2',
  Reddit: '#FF4500',
};

function detectPlatform(url: string): string {
  if (url.includes('tiktok.com')) return 'TikTok';
  if (url.includes('instagram.com')) return 'Instagram';
  if (url.includes('twitter.com') || url.includes('x.com')) return 'X/Twitter';
  if (url.includes('reddit.com')) return 'Reddit';
  return '';
}

export default function SavePromptScreen() {
  const [mode, setMode] = useState<Mode>('url');
  const [sourceUrl, setSourceUrl] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [platform, setPlatform] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extractError, setExtractError] = useState('');

  async function extractFromUrl() {
    if (!sourceUrl.trim()) {
      setExtractError('Paste a URL first.');
      return;
    }
    setExtractError('');
    setMode('extracting');
    try {
      const { data, error } = await supabase.functions.invoke('extract-prompt', {
        body: { url: sourceUrl.trim() },
      });
      if (error) throw error;
      setTitle(data.title ?? '');
      setContent(data.content ?? '');
      setPlatform(data.platform ?? detectPlatform(sourceUrl));
      setMode('review');
    } catch (e: any) {
      setExtractError('Could not extract a prompt from that URL. Try entering it manually.');
      setMode('url');
    }
  }

  async function savePrompt() {
    if (!content.trim()) {
      Alert.alert('Error', 'Prompt content is required');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Alert.alert('Error', 'You must be logged in');
      setSaving(false);
      return;
    }
    const { error } = await supabase.from('prompts').insert({
      user_id: user.id,
      title: title.trim() || null,
      content: content.trim(),
      source_platform: platform || null,
      source_url: sourceUrl.trim() || null,
      is_public: isPublic,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Saved!', 'Your prompt has been saved.');
      reset();
    }
  }

  function reset() {
    setMode('url');
    setSourceUrl('');
    setTitle('');
    setContent('');
    setPlatform('');
    setIsPublic(false);
  }

  if (mode === 'extracting') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#7C6FFF" />
          <Text style={styles.extractingText}>Extracting prompt...</Text>
          <Text style={styles.extractingSubtext}>This may take a few seconds</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (mode === 'review') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.reviewHeader}>
            <Text style={styles.heading}>Review Prompt</Text>
            <TouchableOpacity onPress={reset}>
              <Text style={styles.startOver}>Start over</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.urlPill, { borderColor: PLATFORM_COLORS[platform] ?? '#7C6FFF' }]}>
            <Text style={[styles.urlPillPlatform, { color: PLATFORM_COLORS[platform] ?? '#7C6FFF' }]}>
              {platform || 'Link'}
            </Text>
            <Text style={styles.urlPillText} numberOfLines={1}>{sourceUrl}</Text>
          </View>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="Give it a title..."
            placeholderTextColor="#8A8A9A"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Prompt Content *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Extracted prompt will appear here..."
            placeholderTextColor="#8A8A9A"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Platform</Text>
          <View style={styles.chips}>
            {PLATFORMS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, platform === p && { backgroundColor: PLATFORM_COLORS[p] }]}
                onPress={() => setPlatform(p)}
              >
                <Text style={[styles.chipText, platform === p && styles.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.toggle}>
            <View>
              <Text style={styles.label}>Make Public</Text>
              <Text style={styles.sublabel}>Others can discover this prompt</Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: '#10101C', true: '#7C6FFF' }}
              thumbColor={isPublic ? '#fff' : '#8A8A9A'}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={savePrompt}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save Prompt</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (mode === 'manual') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.reviewHeader}>
            <Text style={styles.heading}>Enter Manually</Text>
            <TouchableOpacity onPress={() => setMode('url')}>
              <Text style={styles.startOver}>Use URL instead</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Perfect Cover Letter Prompt"
            placeholderTextColor="#8A8A9A"
            value={title}
            onChangeText={setTitle}
          />

          <Text style={styles.label}>Prompt Content *</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Paste the prompt here..."
            placeholderTextColor="#8A8A9A"
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
          />

          <Text style={styles.label}>Source Platform</Text>
          <View style={styles.chips}>
            {PLATFORMS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, platform === p && { backgroundColor: PLATFORM_COLORS[p] }]}
                onPress={() => setPlatform(p)}
              >
                <Text style={[styles.chipText, platform === p && styles.chipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Source URL (optional)</Text>
          <TextInput
            style={styles.input}
            placeholder="https://tiktok.com/..."
            placeholderTextColor="#8A8A9A"
            value={sourceUrl}
            onChangeText={setSourceUrl}
            autoCapitalize="none"
            keyboardType="url"
          />

          <View style={styles.toggle}>
            <View>
              <Text style={styles.label}>Make Public</Text>
              <Text style={styles.sublabel}>Others can discover this prompt</Text>
            </View>
            <Switch
              value={isPublic}
              onValueChange={setIsPublic}
              trackColor={{ false: '#10101C', true: '#7C6FFF' }}
              thumbColor={isPublic ? '#fff' : '#8A8A9A'}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, saving && styles.buttonDisabled]}
            onPress={savePrompt}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save Prompt</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Default: url mode
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.heading}>Save a Prompt</Text>
        <Text style={styles.subheading}>Paste a link from TikTok, Instagram, X, or Reddit</Text>

        <View style={styles.urlBox}>
          <TextInput
            style={styles.urlInput}
            placeholder="https://tiktok.com/..."
            placeholderTextColor="#8A8A9A"
            value={sourceUrl}
            onChangeText={setSourceUrl}
            autoCapitalize="none"
            keyboardType="url"
            autoCorrect={false}
          />
          {sourceUrl.length > 0 && (
            <TouchableOpacity style={styles.clearBtn} onPress={() => { setSourceUrl(''); setExtractError(''); }}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {extractError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{extractError}</Text>
          </View>
        ) : null}

        <TouchableOpacity style={styles.button} onPress={extractFromUrl}>
          <Text style={styles.buttonText}>✦  Extract with AI</Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.manualLink} onPress={() => setMode('manual')}>
          <Text style={styles.manualLinkText}>Enter prompt manually</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  scroll: { padding: 24, flexGrow: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  heading: { fontSize: 26, fontWeight: '800', color: '#F0EEFF', marginBottom: 6 },
  subheading: { fontSize: 14, color: '#8A8A9A', marginBottom: 28 },
  urlBox: {
    backgroundColor: '#10101C',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.15)',
    marginBottom: 16,
  },
  urlInput: {
    flex: 1,
    padding: 16,
    fontSize: 15,
    color: '#F0EEFF',
  },
  clearBtn: { paddingRight: 16 },
  clearBtnText: { color: '#8A8A9A', fontSize: 16 },
  errorBox: { backgroundColor: '#2a1a1a', borderRadius: 10, padding: 12, marginBottom: 12 },
  errorText: { color: '#FF6B6B', fontSize: 13, lineHeight: 18 },
  button: {
    backgroundColor: '#7C6FFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#F0EEFF', fontSize: 16, fontWeight: '700' },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 28,
    gap: 12,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(108, 99, 255, 0.15)' },
  dividerText: { color: '#8A8A9A', fontSize: 13 },
  manualLink: { alignItems: 'center' },
  manualLinkText: { color: '#7C6FFF', fontSize: 15, fontWeight: '600' },
  extractingText: { color: '#F0EEFF', fontSize: 18, fontWeight: '700', marginTop: 16 },
  extractingSubtext: { color: '#8A8A9A', fontSize: 14 },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  startOver: { color: '#8A8A9A', fontSize: 14 },
  urlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#10101C',
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  urlPillPlatform: { fontSize: 12, fontWeight: '700' },
  urlPillText: { flex: 1, color: '#8A8A9A', fontSize: 12 },
  label: { fontSize: 13, fontWeight: '700', color: '#F0EEFF', marginBottom: 8, marginTop: 16 },
  sublabel: { fontSize: 12, color: '#8A8A9A', marginTop: 2 },
  input: {
    backgroundColor: '#10101C',
    borderRadius: 12,
    padding: 14,
    color: '#F0EEFF',
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.15)',
  },
  textarea: { height: 160, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#10101C',
  },
  chipText: { color: '#8A8A9A', fontSize: 13 },
  chipTextActive: { color: '#F0EEFF', fontWeight: '700' },
  toggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#10101C',
    padding: 16,
    borderRadius: 12,
  },
});
