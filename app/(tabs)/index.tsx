import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../components/design';
import { OpenInAIButton } from '../components/OpenInAI';
import { SaveToCollection } from '../components/SaveToCollection';
import { supabase } from '../../lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  TikTok: '#FF0050',
  Instagram: '#C13584',
  'X/Twitter': '#1DA1F2',
  Reddit: '#FF4500',
  YouTube: '#FF0000',
};

const PLATFORMS = ['All', 'TikTok', 'Reddit', 'YouTube', 'Instagram', 'X/Twitter'];
const TABS = ['For You', 'Trending', 'New'] as const;
type Tab = typeof TABS[number];

// ─── Component ────────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [userPlatforms, setUserPlatforms] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('For You');
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saveTarget, setSaveTarget] = useState<{ id: string; title?: string } | null>(null);
  const tabAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(useCallback(() => {
    loadAll();
  }, []));

  async function loadAll() {
    const { data: { user } } = await supabase.auth.getUser();
    const [promptsResult, userPromptsResult] = await Promise.all([
      supabase
        .from('prompts')
        .select('*, profiles(username, display_name, avatar_url)')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(200),
      user
        ? supabase
            .from('prompts')
            .select('source_platform')
            .eq('user_id', user.id)
            .not('source_platform', 'is', null)
        : Promise.resolve({ data: [] }),
    ]);

    if (promptsResult.data) setPrompts(promptsResult.data);

    // Build platform preference list for For You
    const platformCounts: Record<string, number> = {};
    (userPromptsResult.data ?? []).forEach((p: any) => {
      if (p.source_platform) {
        platformCounts[p.source_platform] = (platformCounts[p.source_platform] ?? 0) + 1;
      }
    });
    const sorted = Object.entries(platformCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([platform]) => platform);
    setUserPlatforms(sorted);
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  async function copyPrompt(id: string, content: string) {
    await Clipboard.setStringAsync(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function switchTab(t: Tab, idx: number) {
    setTab(t);
    setPlatformFilter('All');
    setSearch('');
    Animated.spring(tabAnim, { toValue: idx, useNativeDriver: false, tension: 120, friction: 10 }).start();
  }

  // ─── Feed sorting ────────────────────────────────────────────────────────────

  const sortedPrompts = useMemo(() => {
    let base = [...prompts];

    if (tab === 'Trending') {
      base.sort((a, b) => (b.save_count ?? 0) - (a.save_count ?? 0) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (tab === 'New') {
      base.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      // For You: weight by platform match, then recency
      base.sort((a, b) => {
        const aScore = userPlatforms.indexOf(a.source_platform);
        const bScore = userPlatforms.indexOf(b.source_platform);
        const aW = aScore === -1 ? 0 : userPlatforms.length - aScore;
        const bW = bScore === -1 ? 0 : userPlatforms.length - bScore;
        if (bW !== aW) return bW - aW;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    return base;
  }, [prompts, tab, userPlatforms]);

  // ─── Search + platform filter ─────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return sortedPrompts.filter(p => {
      const matchPlatform = platformFilter === 'All' || p.source_platform === platformFilter;
      const matchSearch = !q ||
        p.title?.toLowerCase().includes(q) ||
        p.content?.toLowerCase().includes(q) ||
        p.source_platform?.toLowerCase().includes(q);
      return matchPlatform && matchSearch;
    });
  }, [sortedPrompts, search, platformFilter]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>PromptIt</Text>
          <Text style={styles.tagline}>Discover prompts from the community</Text>
        </View>
        <View style={styles.promptCount}>
          <Text style={styles.promptCountNum}>{filtered.length}</Text>
          <Text style={styles.promptCountLabel}>prompts</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, content, or platform..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearSearch}>
            <Text style={styles.clearSearchText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {TABS.map((t, idx) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => switchTab(t, idx)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            {tab === t && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Platform filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.platformRow}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
      >
        {PLATFORMS.map(p => (
          <TouchableOpacity
            key={p}
            style={[
              styles.platformChip,
              platformFilter === p && styles.platformChipActive,
              p !== 'All' && platformFilter === p && { borderColor: `${PLATFORM_COLORS[p]}88`, backgroundColor: `${PLATFORM_COLORS[p]}18` },
            ]}
            onPress={() => setPlatformFilter(p)}
          >
            <Text style={[
              styles.platformChipText,
              platformFilter === p && (p === 'All' ? styles.platformChipTextActive : { color: PLATFORM_COLORS[p] }),
            ]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Feed */}
      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        contentContainerStyle={filtered.length === 0 ? styles.emptyWrap : { padding: 16, paddingTop: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.purple} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✦</Text>
            <Text style={styles.emptyTitle}>
              {search ? 'No results found' : tab === 'For You' ? 'Start saving prompts to personalise this feed' : 'Nothing here yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {search ? 'Try different keywords or clear your filters.' : 'Check back soon as the community grows.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => <PromptCard
          item={item}
          copiedId={copiedId}
          onCopy={copyPrompt}
          onSave={() => setSaveTarget({ id: item.id, title: item.title })}
        />}
      />

      {/* Save to collection sheet */}
      <SaveToCollection
        prompt={saveTarget ?? { id: '' }}
        visible={!!saveTarget}
        onClose={() => setSaveTarget(null)}
      />
    </SafeAreaView>
  );
}

// ─── Prompt Card ──────────────────────────────────────────────────────────────

function PromptCard({
  item,
  copiedId,
  onCopy,
  onSave,
}: {
  item: any;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
  onSave: () => void;
}) {
  const accent = PLATFORM_COLORS[item.source_platform] || colors.purple;
  const [expanded, setExpanded] = useState(false);
  const authorName = item.profiles?.display_name || item.profiles?.username;

  return (
    <View style={cardStyles.card}>
      <View style={[cardStyles.accentBar, { backgroundColor: accent }]} />
      <View style={cardStyles.inner}>

        {/* Top meta row */}
        <View style={cardStyles.metaRow}>
          <View style={[cardStyles.platformBadge, { backgroundColor: `${accent}18`, borderColor: `${accent}44` }]}>
            <Text style={[cardStyles.platformText, { color: accent }]}>
              {item.source_platform || 'Other'}
            </Text>
          </View>
          {authorName && (
            <Text style={cardStyles.author}>@{authorName}</Text>
          )}
          {(item.save_count ?? 0) > 0 && (
            <View style={cardStyles.saveCountWrap}>
              <Text style={cardStyles.saveCountText}>⬆ {item.save_count}</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={cardStyles.title}>{item.title || 'Untitled Prompt'}</Text>

        {/* Content preview / expanded */}
        <TouchableOpacity activeOpacity={0.8} onPress={() => setExpanded(e => !e)}>
          <Text
            style={cardStyles.preview}
            numberOfLines={expanded ? undefined : 3}
          >
            {item.content}
          </Text>
          {item.content?.length > 120 && (
            <Text style={cardStyles.expandToggle}>{expanded ? 'Show less ↑' : 'Show more ↓'}</Text>
          )}
        </TouchableOpacity>

        {/* Actions */}
        <View style={cardStyles.actions}>
          <TouchableOpacity style={cardStyles.saveBtn} onPress={onSave}>
            <Text style={cardStyles.saveBtnText}>＋ Save</Text>
          </TouchableOpacity>
          <OpenInAIButton prompt={item.content} />
          <TouchableOpacity
            style={[cardStyles.copyBtn, copiedId === item.id && cardStyles.copyBtnDone]}
            onPress={() => onCopy(item.id, item.content)}
          >
            <Text style={cardStyles.copyBtnText}>
              {copiedId === item.id ? 'Copied ✓' : 'Copy'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 },
  logo: { fontSize: 26, fontWeight: '800', color: colors.purple, letterSpacing: -0.5 },
  tagline: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  promptCount: { alignItems: 'center', backgroundColor: colors.purpleDim, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: colors.border },
  promptCountNum: { fontSize: 16, fontWeight: '800', color: colors.purple },
  promptCountLabel: { fontSize: 10, color: colors.textMuted },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: colors.bgCard, borderRadius: 14,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14,
  },
  searchIcon: { fontSize: 18, color: colors.textMuted, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 13, fontSize: 14, color: colors.textPrimary },
  clearSearch: { padding: 4 },
  clearSearchText: { color: colors.textMuted, fontSize: 14 },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 10, position: 'relative' },
  tabActive: {},
  tabText: { fontSize: 14, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.purple, fontWeight: '800' },
  tabUnderline: { position: 'absolute', bottom: -1, left: '15%', right: '15%', height: 2, backgroundColor: colors.purple, borderRadius: 1 },
  platformRow: { maxHeight: 44, marginBottom: 4 },
  platformChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  platformChipActive: { backgroundColor: colors.purpleDim, borderColor: colors.borderStrong },
  platformChipText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  platformChipTextActive: { color: colors.purple, fontWeight: '700' },
  emptyWrap: { flex: 1, justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 36, color: colors.purple, marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard, borderRadius: 18,
    marginBottom: 12, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', flexDirection: 'row',
  },
  accentBar: { width: 3 },
  inner: { flex: 1, padding: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  platformBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  platformText: { fontSize: 11, fontWeight: '700' },
  author: { fontSize: 12, color: colors.purple, fontWeight: '700', flex: 1 },
  saveCountWrap: {},
  saveCountText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  title: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 8, lineHeight: 22 },
  preview: { fontSize: 13, color: colors.textSecondary, lineHeight: 20, marginBottom: 4 },
  expandToggle: { fontSize: 12, color: colors.purple, marginBottom: 10, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' },
  saveBtn: {
    backgroundColor: colors.purple, paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 20,
  },
  saveBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  copyBtn: {
    backgroundColor: colors.purpleDim, borderWidth: 1,
    borderColor: colors.borderStrong, paddingHorizontal: 14,
    paddingVertical: 6, borderRadius: 20,
  },
  copyBtnDone: { backgroundColor: 'rgba(74,222,128,0.1)', borderColor: 'rgba(74,222,128,0.4)' },
  copyBtnText: { color: colors.purple, fontSize: 12, fontWeight: '700' },
});
