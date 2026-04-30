import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';

export default function LoadingScreen() {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <LinearGradient
      colors={['#08080F', '#1A0A4A', '#0D0920', '#08080F']}
      locations={[0, 0.35, 0.6, 1]}
      style={styles.container}
    >
      <View style={styles.top}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
        <Text style={styles.title}>
          <Text style={styles.white}>Prompt</Text>
          <Text style={styles.purple}>It</Text>
        </Text>
        <Text style={styles.tagline}>Your ideas. Perfectly prompted.</Text>
      </View>

      <View style={styles.bottom}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate: spin }] }]} />
        <Text style={styles.loadingText}>Loading amazing ideas...</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 80,
  },
  top: {
    alignItems: 'center',
    gap: 16,
  },
  icon: {
    width: 180,
    height: 180,
    marginBottom: 8,
  },
  title: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  white: { color: '#F0EEFF' },
  purple: { color: '#7C6FFF' },
  tagline: {
    fontSize: 16,
    color: '#8A8A9A',
    letterSpacing: 0.2,
  },
  bottom: {
    alignItems: 'center',
    gap: 16,
  },
  spinner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: 'rgba(124, 111, 255, 0.15)',
    borderTopColor: '#7C6FFF',
    borderRightColor: 'rgba(124, 111, 255, 0.5)',
  },
  loadingText: {
    color: '#8A8A9A',
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
