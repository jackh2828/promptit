import { useFocusEffect, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../components/design';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [totalPrompts, setTotalPrompts] = useState(0);
  const [publicPrompts, setPublicPrompts] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useFocusEffect(useCallback(() => { fetchProfile(); }, []));

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [{ data: profileData }, { count: total }, { count: pub }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('prompts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_public', true),
    ]);
    if (profileData) setProfile({ ...profileData, email: user.email });
    setTotalPrompts(total ?? 0);
    setPublicPrompts(pub ?? 0);
  }

  async function onRefresh() {
    setRefreshing(true);
    await fetchProfile();
    setRefreshing(false);
  }

  function openEdit() {
    setEditUsername(profile?.username ?? '');
    setEditDisplayName(profile?.display_name ?? '');
    setEditBio(profile?.bio ?? '');
    setEditVisible(true);
  }

  async function saveProfile() {
    if (!editUsername.trim() || editUsername.length < 3) {
      Alert.alert('Username must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(editUsername)) {
      Alert.alert('Username can only contain letters, numbers, and underscores');
      return;
    }
    setEditSaving(true);

    // Check username uniqueness if changed
    if (editUsername.toLowerCase() !== profile?.username) {
      const { data: existing } = await supabase
        .from('profiles').select('id').eq('username', editUsername.toLowerCase()).single();
      if (existing) {
        Alert.alert('That username is already taken.');
        setEditSaving(false);
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('profiles').update({
      username: editUsername.toLowerCase().trim(),
      display_name: editDisplayName.trim() || null,
      bio: editBio.trim() || null,
    }).eq('id', user.id);

    setEditSaving(false);
    if (error) { Alert.alert('Error', error.message); return; }
    await fetchProfile();
    setEditVisible(false);
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    setAvatarUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const filePath = `${user.id}/avatar.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const arrayBuffer = await new Response(blob).arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const urlWithBust = `${publicUrl}?t=${Date.now()}`;

      await supabase.from('profiles').update({ avatar_url: urlWithBust }).eq('id', user.id);
      setProfile((p: any) => ({ ...p, avatar_url: urlWithBust }));
    } catch (e: any) {
      Alert.alert('Upload failed', e.message);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function signOut() {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }

  const displayName = profile?.display_name || profile?.username || '—';
  const initial = displayName[0]?.toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Profile</Text>
          <TouchableOpacity style={styles.editProfileBtn} onPress={openEdit}>
            <Text style={styles.editProfileBtnText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar + info */}
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.avatarWrap} onPress={pickAvatar} disabled={avatarUploading}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditIcon}>{avatarUploading ? '…' : '📷'}</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.profileInfo}>
            <Text style={styles.displayName}>{displayName}</Text>
            {profile?.username && profile?.display_name && (
              <Text style={styles.usernameLabel}>@{profile.username}</Text>
            )}
            {!profile?.display_name && profile?.username && (
              <Text style={styles.usernameLabel}>@{profile.username}</Text>
            )}
            <Text style={styles.email}>{profile?.email}</Text>
          </View>
        </View>

        {/* Bio */}
        {profile?.bio ? (
          <View style={styles.bioCard}>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.bioEmpty} onPress={openEdit}>
            <Text style={styles.bioEmptyText}>+ Add a bio</Text>
          </TouchableOpacity>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{totalPrompts}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{publicPrompts}</Text>
            <Text style={styles.statLabel}>Public</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNumber}>{totalPrompts - publicPrompts}</Text>
            <Text style={styles.statLabel}>Private</Text>
          </View>
        </View>

        {/* Actions */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.privacyBtn} onPress={() => router.push('/privacy' as any)}>
          <Text style={styles.privacyText}>Privacy Policy</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} transparent animationType="slide" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditVisible(false)}>
            <TouchableOpacity style={styles.modal} activeOpacity={1}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Edit Profile</Text>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalLabel}>Display Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Your name (shown on your profile)"
                  placeholderTextColor={colors.textMuted}
                  value={editDisplayName}
                  onChangeText={setEditDisplayName}
                />

                <Text style={styles.modalLabel}>Username</Text>
                <View style={styles.usernameInputRow}>
                  <Text style={styles.atSign}>@</Text>
                  <TextInput
                    style={styles.usernameInput}
                    placeholder="username"
                    placeholderTextColor={colors.textMuted}
                    value={editUsername}
                    onChangeText={setEditUsername}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>

                <Text style={styles.modalLabel}>Bio</Text>
                <TextInput
                  style={[styles.modalInput, styles.bioInput]}
                  placeholder="Tell the community a little about yourself..."
                  placeholderTextColor={colors.textMuted}
                  value={editBio}
                  onChangeText={setEditBio}
                  multiline
                  textAlignVertical="top"
                  maxLength={160}
                />
                <Text style={styles.charCount}>{editBio.length}/160</Text>

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setEditVisible(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSave, editSaving && { opacity: 0.6 }]}
                    onPress={saveProfile}
                    disabled={editSaving}
                  >
                    <Text style={styles.modalSaveText}>{editSaving ? 'Saving...' : 'Save'}</Text>
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
  scroll: { padding: 20, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  heading: { fontSize: 28, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5 },
  editProfileBtn: { backgroundColor: colors.purpleDim, borderWidth: 1, borderColor: colors.borderStrong, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  editProfileBtnText: { color: colors.purple, fontSize: 13, fontWeight: '700' },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  avatarWrap: { position: 'relative', marginRight: 16 },
  avatarImage: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: colors.purple },
  avatarPlaceholder: { width: 76, height: 76, borderRadius: 38, backgroundColor: colors.purpleDim, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 30, fontWeight: '800', color: colors.purple },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.bgCard, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  avatarEditIcon: { fontSize: 12 },
  profileInfo: { flex: 1 },
  displayName: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  usernameLabel: { fontSize: 13, color: colors.purple, marginBottom: 2 },
  email: { fontSize: 12, color: colors.textMuted },
  bioCard: { backgroundColor: colors.bgCard, borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
  bioText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  bioEmpty: { alignItems: 'center', padding: 12, marginBottom: 16 },
  bioEmptyText: { color: colors.purple, fontSize: 14, fontWeight: '600' },
  statsRow: { flexDirection: 'row', backgroundColor: colors.bgCard, borderRadius: 20, padding: 20, marginBottom: 24, justifyContent: 'space-around', alignItems: 'center', borderWidth: 1, borderColor: colors.border },
  stat: { alignItems: 'center', flex: 1 },
  statNumber: { fontSize: 26, fontWeight: '800', color: colors.purple, marginBottom: 4 },
  statLabel: { fontSize: 12, color: colors.textMuted },
  statDivider: { width: 1, height: 40, backgroundColor: colors.border },
  signOutBtn: { backgroundColor: colors.bgCard, borderRadius: 16, padding: 16, alignItems: 'center', marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  signOutText: { color: '#FF6B6B', fontWeight: '700', fontSize: 15 },
  privacyBtn: { alignItems: 'center', padding: 12 },
  privacyText: { color: colors.textMuted, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#13131F', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40, maxHeight: '90%', borderTopWidth: 1, borderColor: colors.border },
  modalHandle: { width: 36, height: 4, backgroundColor: '#2C2C3E', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 20 },
  modalLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginTop: 8 },
  modalInput: { backgroundColor: '#1A1A2E', borderRadius: 12, padding: 14, color: colors.textPrimary, fontSize: 14, marginBottom: 4, borderWidth: 1, borderColor: colors.border },
  bioInput: { height: 100, textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: colors.textMuted, textAlign: 'right', marginBottom: 16 },
  usernameInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A2E', borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginBottom: 4 },
  atSign: { color: colors.purple, fontSize: 16, fontWeight: '700', paddingLeft: 14 },
  usernameInput: { flex: 1, padding: 14, fontSize: 14, color: colors.textPrimary },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: '#1A1A2E', alignItems: 'center' },
  modalCancelText: { color: colors.textSecondary, fontWeight: '700' },
  modalSave: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: colors.purple, alignItems: 'center' },
  modalSaveText: { color: '#fff', fontWeight: '700' },
});
