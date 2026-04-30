import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../components/design';
import { OpenInAIButton } from '../components/OpenInAI';
import { supabase } from '../../lib/supabase';

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: '#FF0050',
  Instagram: '#C13584',
  'X/Twitter': '#1DA1F2',
  Reddit: '#FF4500',
  YouTube: '#FF0000',
};

const PLATFORMS = ['All', 'TikTok', 'Instagram', 'X/Twitter', 'Reddit', 'YouTube'];

export default function MyPromptsScreen() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editPlatform, setEditPlatform] = useState('');
  const [editPublic, setEditPublic] = useState(false);
  const [editSaving, setEditSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchMyPrompts();
  }, []));

  async function fetchMyPrompts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('prompts').select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setPrompts(data);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchMyPrompts();
    setRefreshing(false);
  }

  async function togglePublic(id: string, current: boolean) {
    const next = !current;
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, is_public: next } : p));
    await supabase.from('prompts').update({ is_public: next }).eq('id', id);
  }

  async function deletePrompt(id: string) {
    Alert.alert('Delete Prompt', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        setPrompts(prev => prev.filter(p => p.id !== id));
        await supabase.from('prompts').delete().eq('id', id);
      }},
    ]);
  }

  async function copyPrompt(id: string, content: string) {
    await Clipboard.setStringAsync(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function openEdit(item: any) {
    setEditing(item);
    setEditTitle(item.title ?? '');
    setEditContent(item.content ?? '');
    setEditPlatform(item.source_platform ?? '');
    setEditPublic(item.is_public ?? false);
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editContent.trim()) { Alert.alert('Content is required'); return; }
    setEditSaving(true);
    const { error } = await supabase.from('prompts').update({
      title: editTitle.trim() || null,
      content: editContent.trim(),
      source_platform: editPlatform || null,
      is_public: editPublic,
    }).eq('id', editing.id);
    setEditSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setPrompts(prev => prev.map(p => p.id === editing.id
      ? { ...p, title: editTitle.trim() || null, content: editContent.trim(), source_platform: editPlatform || null, is_public: editPublic }
      : p
    ));
    setEditing(null);
  }

  const filtered = prompts.filter(p => {
    const matchSearch =
      p.title?.toLowerCase().includes(search.toLowerCase()) ||
      p.content?.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'All' || p.source_platform === filter;
    return matchSearch && matchFilter;
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>My Prompts</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{prompts.length}</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.search}
          placeholder="Search your prompts..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        horizontal
        data={PLATFORMS}
        keyExtractor={i => i}
        style={styles.filters}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, filter === item && styles.chipActive]}
            onPress={() => setFilter(item)}
          >
            <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>{item}</Text>
          </TouchableOpacity>
        )}
      />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : { padding: 16, paddingTop: 4 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyTitle}>No prompts yet</Text>
            <Text style={styles.emptySubtitle}>
              {search || filter !== 'All'
                ? 'No prompts match your filters.'
                : 'Go to Save and paste a TikTok or Reddit link to get started.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const accent = PLATFORM_COLORS[item.source_platform] || colors.purple;
          return (
            <View style={styles.card}>
              <View style={[styles.accentLine, { backgroundColor: accent }]} />
              <View style={styles.cardInner}>
                <View style={styles.cardTop}>
                  <Text style={styles.title} numberOfLines={1}>{item.title || 'Untitled Prompt'}</Text>
                  <View style={styles.cardTopActions}>
                    <TouchableOpacity onPress={() => openEdit(item)} style={styles.editBtn}>
                      <Text style={styles.editBtnText}>✎</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deletePrompt(item.id)} style={styles.deleteBtn}>
                      <Text style={styles.deleteBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.preview} numberOfLines={2}>{item.content}</Text>

                <View style={styles.actions}>
                  <View style={[styles.badge, { backgroundColor: `${accent}22`, borderColor: `${accent}55` }]}>
                    <Text style={[styles.badgeText, { color: accent }]}>{item.source_platform || 'Other'}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.privacyBadge, { backgroundColor: item.is_public ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)' }]}
                    onPress={() => togglePublic(item.id, item.is_public)}
                  >
                    <Text style={[styles.privacyText, { color: item.is_public ? colors.success : colors.textMuted }]}>
                      {item.is_public ? 'Public' : 'Private'}
                    </Text>
                  </TouchableOpacity>
                  <OpenInAIButton prompt={item.content} />
                  <TouchableOpacity
                    style={[styles.copyBtn, copiedId === item.id && styles.copyBtnDone]}
                    onPress={() => copyPrompt(item.id, item.content)}
                  >
                    <Text style={styles.copyBtnText}>{copiedId === item.id ? 'Copied ✓' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        }}
      />

      {/* Edit Modal */}
      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditing(null)}>
            <TouchableOpacity style={styles.modal} activeOpacity={1}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Edit Prompt</Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalLabel}>Title</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Give it a title..."
                  placeholderTextColor={colors.textMuted}
                  value={editTitle}
                  onChangeText={setEditTitle}
                />

                <Text style={styles.modalLabel}>Prompt Content *</Text>
                <TextInput
                  style={[styles.modalInput, styles.modalTextarea]}
                  placeholder="Prompt content..."
                  placeholderTextColor={colors.textMuted}
                  value={editContent}
                  onChangeText={setEditContent}
                  multiline
                  textAlignVertical="top"
                />

                <Text style={styles.modalLabel}>Platform</Text>
                <View style={styles.chipRow}>
                  {['TikTok','Instagram','X/Twitter','Reddit','YouTube'].map(p => (
                    <TouchableOpacity
                      key={p}
                      style={[styles.chip, editPlatform === p && styles.chipActive]}
                      onPress={() => setEditPlatform(editPlatform === p ? '' : p)}
                    >
                      <Text style={[styles.chipText, editPlatform === p && styles.chipTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.modalToggleRow}>
                  <Text style={styles.modalLabel}>Make Public</Text>
                  <Switch
                    value={editPublic}
                    onValueChange={setEditPublic}
                    trackColor={{ false: '#1A1A2E', true: colors.purple }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setEditing(null)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSave, editSaving && { opacity: 0.6 }]}
                    onPress={saveEdit}
                    disabled={editSaving}
                  >
                    <Text style={styles.modalSaveText}>{editSaving ? 'Saving...' : 'Save Changes'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  countBadge: { backgroundColor: colors.purpleDim, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: colors.border },
  countText: { color: colors.purple, fontSize: 13, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 10,
    backgroundColor: colors.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14,
  },
  searchIcon: { color: colors.textMuted, fontSize: 18, marginRight: 8 },
  search: { flex: 1, paddingVertical: 13, fontSize: 14, color: colors.textPrimary },
  filters: { paddingLeft: 16, marginBottom: 4, maxHeight: 44 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: colors.bgCard, marginRight: 8, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.purpleDim, borderColor: colors.borderStrong },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.purple, fontWeight: '700' },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 36, color: colors.purple, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  card: { backgroundColor: colors.bgCard, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', flexDirection: 'row' },
  accentLine: { width: 3 },
  cardInner: { flex: 1, padding: 14 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, flex: 1, marginRight: 8 },
  preview: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 12 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  privacyBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  privacyText: { fontSize: 11, fontWeight: '700' },
  copyBtn: { backgroundColor: colors.purpleDim, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  copyBtnDone: { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.4)' },
  copyBtnText: { color: colors.purple, fontSize: 12, fontWeight: '700' },
  deleteBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,100,100,0.1)', alignItems: 'center', justifyContent: 'center' },
  deleteBtnText: { color: '#FF6B6B', fontSize: 11, fontWeight: '700' },
  cardTopActions: { flexDirection: 'row', gap: 6 },
  editBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.purpleDim, alignItems: 'center', justifyContent: 'center' },
  editBtnText: { color: colors.purple, fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#13131F', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '90%', borderTopWidth: 1, borderColor: colors.border },
  modalHandle: { width: 36, height: 4, backgroundColor: '#2C2C3E', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 20 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  modalInput: { backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14, color: colors.textPrimary, fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  modalTextarea: { height: 140, textAlignVertical: 'top' },
  modalToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: '#1A1A2E', alignItems: 'center' },
  modalCancelText: { color: colors.textSecondary, fontWeight: '700' },
  modalSave: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: colors.purple, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '700' },
});
