// PromptIt design system — 2025/2026 premium dark aesthetic

export const colors = {
  bg: '#08080F',
  bgCard: '#10101C',
  bgCardHover: '#15152A',
  border: 'rgba(108, 99, 255, 0.15)',
  borderStrong: 'rgba(108, 99, 255, 0.35)',
  purple: '#7C6FFF',
  purpleMid: '#6C63FF',
  purpleDim: 'rgba(108, 99, 255, 0.12)',
  white: '#FFFFFF',
  textPrimary: '#F0EEFF',
  textSecondary: '#8A8A9A',
  textMuted: '#4A4A5A',
  error: '#FF6B8A',
  success: '#4ADE80',
  TikTok: '#FF0050',
  Instagram: '#C13584',
  'X/Twitter': '#1DA1F2',
  Reddit: '#FF4500',
  YouTube: '#FF0000',
};

export const card = {
  backgroundColor: colors.bgCard,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.border,
  padding: 16,
  marginBottom: 12,
};

export const typography = {
  hero: { fontSize: 30, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -0.5 },
  heading: { fontSize: 22, fontWeight: '800' as const, color: colors.textPrimary, letterSpacing: -0.3 },
  title: { fontSize: 16, fontWeight: '700' as const, color: colors.textPrimary },
  body: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  caption: { fontSize: 12, color: colors.textMuted },
  label: { fontSize: 12, fontWeight: '700' as const, color: colors.textSecondary, textTransform: 'uppercase' as const, letterSpacing: 0.8 },
};
