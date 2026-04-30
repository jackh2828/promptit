import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors } from './design';
import { supabase } from '../../lib/supabase';

interface Props {
  prompt: { id: string; title?: string };
  visible: boolean;
  onClose: () => void;
}

export function SaveToCollection({ prompt, visible, onClose }: Props) {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [createSaving, setCreateSaving] = useState(false);
  const [alreadySaved, setAlreadySaved] = useState<Set<string>>(new Set());
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setSavedTo(null);
      setCreating(false);
      setNewName('');
      fetchCollections();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  async function fetchCollections() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: cols }, { data: saved }] = await Promise.all([
      supabase.from('collections').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('collection_prompts').select('collection_id').eq('prompt_id', prompt.id).eq('user_id', user.id),
    ]);

    setCollections(cols ?? []);
    setAlreadySaved(new Set((saved ?? []).map((s: any) => s.collection_id)));
    setLoading(false);
  }

  async function saveToCollection(collection: any) {
    if (alreadySaved.has(collection.id)) return;
    setSaving(collection.id);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(null); return; }

    await supabase.from('collection_prompts').insert({
      collection_id: collection.id,
      prompt_id: prompt.id,
      user_id: user.id,
    });

    setAlreadySaved(prev => new Set([...prev, collection.id]));
    setSaving(null);
    setSavedTo(collection.name);
    setTimeout(() => { setSavedTo(null); onClose(); }, 1200);
  }

  async function createAndSave() {
    if (!newName.trim()) return;
    setCreateSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setCreateSaving(false); return; }

    const { data: newCol, error } = await supabase
      .from('collections')
      .insert({ user_id: user.id, name: newName.trim(), is_public: false })
      .select()
      .single();

    if (error || !newCol) { setCreateSaving(false); return; }

    await supabase.from('collection_prompts').insert({
      collection_id: newCol.id,
      prompt_id: prompt.id,
      user_id: user.id,
    });

    setCreateSaving(false);
    setSavedTo(newCol.name);
    setTimeout(() => { setSavedTo(null); onClose(); }, 1200);
  }

  function handleClose() {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(onClose);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          <View style={styles.handle} />

          {savedTo ? (
            <View style={styles.savedState}>
              <Text style={styles.savedIcon}>✓</Text>
              <Text style={styles.savedTitle}>Saved to</Text>
              <Text style={styles.savedCollection}>"{savedTo}"</Text>
            </View>
          ) : (
            <>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Save to Collection</Text>
                {prompt.title && (
                  <Text style={styles.sheetSubtitle} numberOfLines={1}>"{prompt.title}"</Text>
                )}
              </View>

              {loading ? (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator color={colors.purple} />
                </View>
              ) : (
                <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
                  {collections.length === 0 && !creating && (
                    <Text style={styles.emptyText}>You have no collections yet. Create one below.</Text>
                  )}

                  {collections.map(col => {
                    const saved = alreadySaved.has(col.id);
                    const isSaving = saving === col.id;
                    return (
                      <TouchableOpacity
                        key={col.id}
                        style={[styles.collectionRow, saved && styles.collectionRowSaved]}
                        onPress={() => saveToCollection(col)}
                        disabled={saved || !!saving}
                      >
                        <View style={styles.folderIcon}>
                          <Text>📁</Text>
                        </View>
                        <View style={styles.collectionInfo}>
                          <Text style={styles.collectionName}>{col.name}</Text>
                          {col.description && (
                            <Text style={styles.collectionDesc} numberOfLines={1}>{col.description}</Text>
                          )}
                        </View>
                        <View style={styles.collectionAction}>
                          {isSaving ? (
                            <ActivityIndicator size="small" color={colors.purple} />
                          ) : saved ? (
                            <Text style={styles.savedCheck}>✓ Saved</Text>
                          ) : (
                            <Text style={styles.addText}>Add</Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}

                  {creating ? (
                    <View style={styles.createRow}>
                      <TextInput
                        style={styles.createInput}
                        placeholder="Collection name..."
                        placeholderTextColor={colors.textMuted}
                        value={newName}
                        onChangeText={setNewName}
                        autoFocus
                        onSubmitEditing={createAndSave}
                      />
                      <TouchableOpacity
                        style={[styles.createSaveBtn, (!newName.trim() || createSaving) && { opacity: 0.5 }]}
                        onPress={createAndSave}
                        disabled={!newName.trim() || createSaving}
                      >
                        {createSaving ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.createSaveBtnText}>Create & Save</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.newCollectionBtn} onPress={() => setCreating(true)}>
                      <Text style={styles.newCollectionIcon}>+</Text>
                      <Text style={styles.newCollectionText}>New Collection</Text>
                    </TouchableOpacity>
                  )}
                </ScrollView>
              )}
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#13131F',
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 44,
    maxHeight: '75%',
    borderTopWidth: 1, borderColor: colors.border,
  },
  handle: { width: 36, height: 4, backgroundColor: '#2C2C3E', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetHeader: { marginBottom: 16 },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  sheetSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  loadingWrap: { height: 80, justifyContent: 'center', alignItems: 'center' },
  list: { maxHeight: 400 },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 16 },
  collectionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  collectionRowSaved: { opacity: 0.6 },
  folderIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.purpleDim, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  collectionInfo: { flex: 1 },
  collectionName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  collectionDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  collectionAction: { marginLeft: 12 },
  savedCheck: { fontSize: 12, color: colors.success, fontWeight: '700' },
  addText: { fontSize: 13, color: colors.purple, fontWeight: '700' },
  newCollectionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 16, marginTop: 4,
  },
  newCollectionIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.purpleDim, textAlign: 'center', lineHeight: 40, color: colors.purple, fontSize: 22, fontWeight: '300', overflow: 'hidden' },
  newCollectionText: { fontSize: 15, color: colors.purple, fontWeight: '700' },
  createRow: { marginTop: 12, gap: 10 },
  createInput: {
    backgroundColor: '#1A1A2E', borderRadius: 12,
    padding: 14, color: colors.textPrimary, fontSize: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  createSaveBtn: { backgroundColor: colors.purple, borderRadius: 12, padding: 14, alignItems: 'center' },
  createSaveBtnText: { color: '#fff', fontWeight: '700' },
  savedState: { alignItems: 'center', paddingVertical: 32 },
  savedIcon: { fontSize: 40, color: colors.success, marginBottom: 12 },
  savedTitle: { fontSize: 16, color: colors.textSecondary, marginBottom: 4 },
  savedCollection: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
});
