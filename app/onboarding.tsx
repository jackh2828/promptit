import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '✦',
    title: 'Save AI prompts\nfrom any video',
    body: 'See a great AI prompt on TikTok, Reddit, or YouTube? Save it to your library in seconds.',
  },
  {
    icon: '⚡',
    title: 'AI extracts it\nfor you',
    body: 'Paste the link and our AI watches the video, transcribes it, and pulls out the exact prompt — ready to use.',
  },
  {
    icon: '📋',
    title: 'Copy and use\nanywhere',
    body: 'One tap to copy any saved prompt straight to ChatGPT, Claude, Midjourney — wherever you need it.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  function next() {
    if (isLast) {
      router.replace('/(tabs)');
    } else {
      setStep(s => s + 1);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        {/* Skip */}
        <TouchableOpacity style={styles.skip} onPress={() => router.replace('/(tabs)')}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        {/* Slide content */}
        <View style={styles.slide}>
          <View style={styles.iconCircle}>
            <Text style={styles.icon}>{slide.icon}</Text>
          </View>
          <Text style={styles.title}>{slide.title}</Text>
          <Text style={styles.body}>{slide.body}</Text>
        </View>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>

        {/* Button */}
        <TouchableOpacity style={styles.button} onPress={next}>
          <Text style={styles.buttonText}>{isLast ? 'Get Started' : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08080F' },
  inner: { flex: 1, paddingHorizontal: 28, paddingBottom: 24 },
  skip: { alignSelf: 'flex-end', paddingVertical: 12 },
  skipText: { color: '#8A8A9A', fontSize: 14 },
  slide: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: '#10101C', alignItems: 'center',
    justifyContent: 'center', marginBottom: 40,
  },
  icon: { fontSize: 40, color: '#7C6FFF' },
  title: {
    fontSize: 32, fontWeight: '800', color: '#F0EEFF',
    textAlign: 'center', marginBottom: 20, lineHeight: 40,
  },
  body: {
    fontSize: 16, color: '#8A8A9A', textAlign: 'center',
    lineHeight: 24, maxWidth: width * 0.8,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 32 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(108, 99, 255, 0.15)' },
  dotActive: { backgroundColor: '#7C6FFF', width: 24 },
  button: {
    backgroundColor: '#7C6FFF', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center',
  },
  buttonText: { color: '#F0EEFF', fontSize: 16, fontWeight: '700' },
});
