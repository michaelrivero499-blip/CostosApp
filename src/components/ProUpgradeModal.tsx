import React, { useRef, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, Animated, Easing, Image,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../context/ThemeContext';
import { FREE_PERSONS_LIMIT, FREE_DEBTS_LIMIT } from '../utils/pro';

// ── Ícono por feature (círculo de color + emoji) ──────────────────────────────
function FeatureIcon({ icon, color }: { icon: string; color: string }) {
  return (
    <View style={[iconStyles.wrap, { backgroundColor: color + '18' }]}>
      <Text style={iconStyles.emoji}>{icon}</Text>
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap:  { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 17 },
});

// ── Lista de features Pro ─────────────────────────────────────────────────────
const PRO_FEATURES: { icon: string; color: string; label: string }[] = [
  { icon: '🫂',  color: '#5E60CE', label: 'Personas ilimitadas'           },
  { icon: '🪙',  color: '#2ED573', label: 'Deudas ilimitadas'              },
  { icon: '🎤',  color: '#F05B53', label: 'Registro por voz con IA'       },
  { icon: '🔄',  color: '#4B8BFF', label: 'Sincronización en la nube'     },
  { icon: '🖼️', color: '#FF9F0A', label: 'Fotos adjuntas en deudas'      },
  { icon: '📈',  color: '#5E60CE', label: 'Estadísticas completas'         },
  { icon: '🛎️', color: '#FF6B6B', label: 'Notificaciones de vencimiento'  },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
  reason?: 'persons' | 'debts' | 'voice';
}

// ── Modal principal ───────────────────────────────────────────────────────────
export function ProUpgradeModal({ visible, onClose, reason }: Props) {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(60)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      slideAnim.setValue(60);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 60, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(onClose);
  }

  const limitMsg = reason === 'persons'
    ? `Alcanzaste el límite de ${FREE_PERSONS_LIMIT} personas en la versión gratis.`
    : reason === 'debts'
    ? `Alcanzaste el límite de ${FREE_DEBTS_LIMIT} deudas activas en la versión gratis.`
    : reason === 'voice'
    ? 'El registro por voz con IA es una función exclusiva de Vera Pro.'
    : null;

  const bg = theme.isDark ? '#0D1B2A' : '#FFFFFF';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <StatusBar style="light" />
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={handleClose} activeOpacity={1} />

        <Animated.View style={[
          styles.sheet,
          { backgroundColor: bg, transform: [{ translateY: slideAnim }] },
        ]}>

          {/* ── Pill ── */}
          <View style={styles.header}>
            <View style={[styles.pill, { backgroundColor: theme.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)' }]} />
          </View>

          {/* ── Header premium: wordmark PNG transparente + chip PRO ── */}
          <View style={styles.proHeader}>
            <View style={styles.wordmarkWrap}>
              <Image
                source={require('../../assets/vera-logos/vera_wordmark_transparent.png')}
                style={styles.wordmarkImg}
                resizeMode="contain"
              />
              {/* Chip PRO en esquina superior derecha del logo */}
              <View style={styles.proBadge}>
                <Text style={styles.proBadgeText}>PRO</Text>
              </View>
            </View>
          </View>

          {/* ── Subtítulo ── */}
          <Text style={[styles.title, { color: theme.text }]}>
            Desbloqueá todo sin límites
          </Text>

          {/* ── Banner de límite ── */}
          {limitMsg && (
            <View style={[styles.limitBanner, {
              backgroundColor: theme.isDark ? 'rgba(240,91,83,0.08)' : 'rgba(240,91,83,0.06)',
              borderColor: 'rgba(240,91,83,0.22)',
            }]}>
              <Text style={styles.limitIcon}>{reason === 'voice' ? '🎤' : '🔒'}</Text>
              <Text style={[styles.limitText, { color: theme.text }]}>{limitMsg}</Text>
            </View>
          )}

          {/* ── Lista de features ── */}
          <View style={styles.featureList}>
            {PRO_FEATURES.map((f, i) => (
              <View key={i} style={[
                styles.featureRow,
                i < PRO_FEATURES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)' },
              ]}>
                <FeatureIcon icon={f.icon} color={f.color} />
                <Text style={[styles.featureLabel, { color: theme.text }]}>{f.label}</Text>
                {/* Check circle */}
                <View style={styles.checkCircle}>
                  <Text style={styles.checkChar}>✓</Text>
                </View>
              </View>
            ))}
          </View>

          {/* ── Botón Pro ── */}
          <TouchableOpacity style={styles.proBtn} activeOpacity={0.85} onPress={handleClose}>
            <View style={styles.proBtnDiamond} />
            <Text style={styles.proBtnText}>Próximamente</Text>
          </TouchableOpacity>

          {/* ── Pie ── */}
          <Text style={[styles.freeNote, { color: theme.subtext }]}>
            Gratis: hasta {FREE_PERSONS_LIMIT} personas · {FREE_DEBTS_LIMIT} deudas activas
          </Text>

          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 20, right: 20 }}>
            <Text style={[styles.closeLink, { color: theme.subtext }]}>Volver a la app</Text>
          </TouchableOpacity>

          <View style={styles.bottomPad} />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const ACCENT = '#F05B53';
const TEAL   = '#00C4A8';

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },

  // Pill
  header: { alignItems: 'center', paddingTop: 12, marginBottom: 8 },
  pill:   { width: 40, height: 4, borderRadius: 2 },

  // Header premium — wordmark
  proHeader: { alignItems: 'center', marginBottom: 12 },
  // Contenedor relativo para el badge absoluto
  wordmarkWrap: {
    position: 'relative',
    alignSelf: 'center',
  },
  // PNG 2148 × 1267 → ratio 1.695
  wordmarkImg: {
    width: 160,
    height: 94,
  },
  // Badge superpuesto sobre la esquina derecha del wordmark
  proBadge: {
    position: 'absolute',
    top: 38,
    right: -8,
    backgroundColor: TEAL,
    paddingHorizontal: 9, paddingVertical: 3,
    borderRadius: 20,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.45,
    shadowRadius: 6,
    elevation: 4,
  },
  proBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 2 },

  // Subtítulo
  title: {
    fontSize: 15, fontWeight: '500',
    textAlign: 'center', lineHeight: 22, marginBottom: 20,
    opacity: 0.6,
  },

  // Banner
  limitBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 20,
  },
  limitIcon: { fontSize: 16, marginTop: 1 },
  limitText: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 19 },

  // Features
  featureList: { marginBottom: 24 },
  featureRow:  {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 11,
  },
  featureLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: '#2ED573',
    alignItems: 'center', justifyContent: 'center',
  },
  checkChar: { color: '#fff', fontSize: 12, fontWeight: '900' },

  // Botón
  proBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: TEAL,
    borderRadius: 16, paddingVertical: 16,
    marginBottom: 14,
    shadowColor: TEAL,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 4,
  },
  proBtnDiamond: {
    width: 7, height: 7,
    backgroundColor: 'rgba(255,255,255,0.7)',
    transform: [{ rotate: '45deg' }],
  },
  proBtnText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

  // Pie
  freeNote:  { fontSize: 12, textAlign: 'center', marginBottom: 10 },
  closeLink: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 4 },
  bottomPad: { height: 16 },
});
