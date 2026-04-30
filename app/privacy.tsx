import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.heading}>Privacy Policy</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: April 2026</Text>

        <Section title="What we collect">
          {`When you use PromptIt, we collect:\n\n• Your email address (for account creation)\n• Your chosen username\n• Prompts you save, including their source URL and platform\n• Collections you create`}
        </Section>

        <Section title="How we use it">
          {`We use your information to:\n\n• Provide and improve the PromptIt service\n• Display your public prompts to other users (only if you choose to make them public)\n• Send your video URLs to OpenAI for AI-powered prompt extraction`}
        </Section>

        <Section title="Third-party services">
          {`PromptIt uses the following third-party services:\n\n• Supabase — database and authentication\n• OpenAI — AI transcription (Whisper) and prompt extraction (GPT)\n\nWhen you extract a prompt from a video URL, that URL is sent to OpenAI for processing. Please review OpenAI's privacy policy at openai.com/privacy.`}
        </Section>

        <Section title="Your data">
          {`• Public prompts are visible to all PromptIt users\n• Private prompts are visible only to you\n• You can delete any prompt at any time from My Prompts\n• To delete your account and all associated data, contact us at support@promptit.app`}
        </Section>

        <Section title="Data storage">
          {`Your data is stored securely on Supabase infrastructure. We do not sell your personal data to third parties.`}
        </Section>

        <Section title="Contact">
          {`Questions about your privacy? Email us at support@promptit.app`}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', padding: 16,
    borderBottomWidth: 1, borderBottomColor: '#10101C',
  },
  backBtn: { width: 60 },
  backText: { color: '#7C6FFF', fontSize: 15 },
  heading: { fontSize: 17, fontWeight: '700', color: '#F0EEFF' },
  content: { padding: 24 },
  updated: { color: '#8A8A9A', fontSize: 13, marginBottom: 24 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#F0EEFF', marginBottom: 10 },
  sectionBody: { fontSize: 14, color: '#8A8A9A', lineHeight: 22 },
});
