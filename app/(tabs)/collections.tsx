import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

export default function CollectionsScreen() {
  const [collections, setCollections] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  useFocusEffect(useCallback(() => {
    fetchCollections();
  }, []));

  async function fetchCollections() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('collections')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) setCollections(data);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchCollections();
    setRefreshing(false);
  }

  async function createCollection() {
    if (!name.trim()) {
      Alert.alert('Name required', 'Give your collection a name.');
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('collections').insert({
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      is_public: isPublic,
    });
    setSaving(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setModalVisible(false);
      setName('');
      setDescription('');
      setIsPublic(false);
      fetchCollections();
    }
  }

  async function deleteCollection(id: string) {
    Alert.alert('Delete Collection', 'This will delete the collection but not the prompts in it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setCollections(prev => prev.filter(c => c.id !== id));
          await supabase.from('collections').delete().eq('id', id);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>Collections</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={collections}
        keyExtractor={item => item.id}
        contentContainerStyle={collections.length === 0 ? styles.emptyContainer : { padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C6FFF" />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>folder</Text>
            <Text style={styles.emptyTitle}>No collections yet</Text>
            <Text style={styles.emptySubtitle}>Create a collection to organise your saved prompts by topic or use case.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.emptyBtnText}>Create your first collection</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardLeft}>
              <View style={styles.folderIcon}>
                <Text style={styles.folderEmoji}>📁</Text>
              </View>
              <View style={styles.cardText}>
                <Text style={styles.collectionName}>{item.name}</Text>
                {item.description ? (
                  <Text style={styles.description} numberOfLines={1}>{item.description}</Text>
                ) : null}
                <Text style={styles.privacyLabel}>{item.is_public ? 'Public' : 'Private'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteCollection(item.id)}>
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      />

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalVisible(false)}>
          <TouchableOpacity style={styles.modal} activeOpacity={1}>
            <Text style={styles.modalTitle}>New Collection</Text>
            <TextInput
              style={styles.input}
              placeholder="Collection name"
              placeholderTextColor="#8A8A9A"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Description (optional)"
              placeholderTextColor="#8A8A9A"
              value={description}
              onChangeText={setDescription}
            />
            <TouchableOpacity
              style={[styles.toggleBtn, isPublic && styles.toggleBtnActive]}
              onPress={() => setIsPublic(!isPublic)}
            >
              <Text style={styles.toggleBtnText}>
                {isPublic ? 'Public — anyone can see this' : 'Private — only you can see this'}
              </Text>
            </TouchableOpacity>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.createBtn, saving && { opacity: 0.6 }]} onPress={createCollection} disabled={saving}>
                <Text style={styles.createText}>{saving ? 'Creating...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  header: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heading: { fontSize: 24, fontWeight: '800', color: '#F0EEFF' },
  addBtn: { backgroundColor: '#7C6FFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#F0EEFF', fontWeight: '700', fontSize: 13 },
  emptyContainer: { flex: 1, justifyContent: 'center', padding: 16 },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 14, color: '#7C6FFF', marginBottom: 8, fontWeight: '700' },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#F0EEFF', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#8A8A9A', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBtn: { backgroundColor: '#7C6FFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#F0EEFF', fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: '#10101C', borderRadius: 12, padding: 16,
    marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  folderIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(108, 99, 255, 0.15)', alignItems: 'center', justifyContent: 'center' },
  folderEmoji: { fontSize: 22 },
  cardText: { flex: 1 },
  collectionName: { fontSize: 16, fontWeight: '700', color: '#F0EEFF', marginBottom: 2 },
  description: { fontSize: 13, color: '#8A8A9A', marginBottom: 4 },
  privacyLabel: { fontSize: 11, color: '#7C6FFF', fontWeight: '600' },
  deleteBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2a1a1a', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  deleteBtnText: { color: '#FF4500', fontSize: 12, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#10101C', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#F0EEFF', marginBottom: 20 },
  input: { backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14, color: '#F0EEFF', fontSize: 14, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(108,99,255,0.25)' },
  toggleBtn: { padding: 14, borderRadius: 12, backgroundColor: '#1A1A2E', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: 'rgba(108,99,255,0.15)' },
  toggleBtnActive: { backgroundColor: '#2C1E6E' },
  toggleBtnText: { color: '#8A8A9A', fontWeight: '600', fontSize: 13 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#1A1A2E', alignItems: 'center' },
  cancelText: { color: '#8A8A9A', fontWeight: '700' },
  createBtn: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#7C6FFF', alignItems: 'center' },
  createText: { color: '#F0EEFF', fontWeight: '700' },
});
