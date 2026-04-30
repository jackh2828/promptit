import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

export default function UsernameScreen() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function validate(value: string): string {
    if (value.length < 3) return 'Username must be at least 3 characters.';
    if (value.length > 20) return 'Username must be 20 characters or less.';
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores.';
    return '';
  }

  async function handleSubmit() {
    const err = validate(username);
    if (err) { setError(err); return; }

    setLoading(true);
    setError('');

    // Check uniqueness
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', username.toLowerCase())
      .single();

    if (existing) {
      setError('That username is already taken. Try another.');
      setLoading(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ username: username.toLowerCase() })
      .eq('id', user.id);

    setLoading(false);
    if (updateErr) {
      setError(updateErr.message);
    } else {
      // Refresh session so _layout re-checks hasUsername before routing
      await supabase.auth.refreshSession();
      router.replace('/onboarding');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          <Text style={styles.logo}>PromptIt</Text>
          <Text style={styles.heading}>Pick a username</Text>
          <Text style={styles.subheading}>
            This is how others will find you. You can't change it later.
          </Text>

          <View style={styles.inputRow}>
            <Text style={styles.at}>@</Text>
            <TextInput
              style={styles.input}
              placeholder="yourname"
              placeholderTextColor="#8A8A9A"
              value={username}
              onChangeText={v => { setUsername(v); setError(''); }}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              maxLength={20}
            />
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.hint}>Letters, numbers, and underscores only. 3–20 characters.</Text>

          <TouchableOpacity
            style={[styles.button, (loading || username.length < 3) && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading || username.length < 3}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Continue</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  inner: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logo: { fontSize: 20, fontWeight: '800', color: '#7C6FFF', marginBottom: 32, textAlign: 'center' },
  heading: { fontSize: 28, fontWeight: '800', color: '#F0EEFF', marginBottom: 8 },
  subheading: { fontSize: 15, color: '#8A8A9A', marginBottom: 32, lineHeight: 22 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#10101C', borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(108, 99, 255, 0.15)', marginBottom: 8,
  },
  at: { color: '#7C6FFF', fontSize: 18, fontWeight: '700', paddingLeft: 16 },
  input: { flex: 1, padding: 16, fontSize: 18, color: '#F0EEFF' },
  error: { color: '#FF6B6B', fontSize: 13, marginBottom: 8 },
  hint: { color: '#8A8A9A', fontSize: 12, marginBottom: 32 },
  button: { backgroundColor: '#7C6FFF', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#F0EEFF', fontSize: 16, fontWeight: '700' },
});
