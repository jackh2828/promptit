import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import {
  Linking,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const AI_OPTIONS = [
  { name: 'ChatGPT', emoji: '🤖', color: '#10A37F', url: 'https://chat.openai.com' },
  { name: 'Claude', emoji: '🟠', color: '#CC785C', url: 'https://claude.ai/new' },
  { name: 'Gemini', emoji: '✨', color: '#4285F4', url: 'https://gemini.google.com/app' },
  { name: 'Perplexity', emoji: '🔍', color: '#20B2AA', url: 'https://www.perplexity.ai' },
  { name: 'Grok', emoji: '⚡', color: '#1DA1F2', url: 'https://x.com/i/grok' },
  { name: 'Meta AI', emoji: '🌐', color: '#0668E1', url: 'https://www.meta.ai' },
];

interface Props {
  prompt: string;
}

export function OpenInAIButton({ prompt }: Props) {
  const [visible, setVisible] = useState(false);
  const [launched, setLaunched] = useState('');

  async function openIn(option: typeof AI_OPTIONS[0]) {
    await Clipboard.setStringAsync(prompt);
    setLaunched(option.name);
    await Linking.openURL(option.url);
    setTimeout(() => {
      setVisible(false);
      setLaunched('');
    }, 800);
  }

  return (
    <>
      <TouchableOpacity style={styles.triggerBtn} onPress={() => setVisible(true)}>
        <Text style={styles.triggerText}>Use in AI ↗</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setVisible(false)}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Open in AI</Text>
            <Text style={styles.sheetSubtitle}>Prompt is copied — just paste it when the app opens</Text>

            <View style={styles.grid}>
              {AI_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.name}
                  style={[styles.aiCard, launched === opt.name && styles.aiCardLaunched]}
                  onPress={() => openIn(opt)}
                >
                  <Text style={styles.aiEmoji}>{opt.emoji}</Text>
                  <Text style={styles.aiName}>{opt.name}</Text>
                  {launched === opt.name && (
                    <Text style={styles.aiOpened}>Opening...</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setVisible(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerBtn: {
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.4)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  triggerText: {
    color: '#A78BFA',
    fontSize: 12,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#13131F',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderColor: 'rgba(108, 99, 255, 0.2)',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#2C2C3E',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#9E9E9E',
    marginBottom: 24,
    lineHeight: 18,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  aiCard: {
    width: '30%',
    backgroundColor: '#1C1C2E',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    flexGrow: 1,
  },
  aiCardLaunched: {
    borderColor: 'rgba(108, 99, 255, 0.5)',
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  aiEmoji: { fontSize: 26 },
  aiName: { fontSize: 12, fontWeight: '700', color: '#fff' },
  aiOpened: { fontSize: 10, color: '#A78BFA' },
  cancelBtn: {
    backgroundColor: '#1C1C2E',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  cancelText: { color: '#9E9E9E', fontWeight: '700' },
});
