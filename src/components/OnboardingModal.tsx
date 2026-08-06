import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Easing,
} from 'react-native';

interface Props {
  visible: boolean;
  onDone: () => void;
}

export function OnboardingModal({ visible, onDone }: Props) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, {
          toValue: 0, duration: 380,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  function handleDone() {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true }),
    ]).start(() => onDone());
  }

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <View style={styles.handle} />

          <Text style={styles.title}>Bienvenido/a a Vera 👋</Text>
          <Text style={styles.subtitle}>Tu registro personal de deudas. Simple, rápido y siempre a mano.</Text>

          <View style={styles.bullets}>
            <BulletRow
              icon="📋"
              text="Llevá el registro de lo que te deben y lo que debés — por persona, en cualquier moneda."
            />
            <BulletRow
              icon="⚡"
              text="Registrá una deuda en segundos, con el teclado o diciéndoselo a Vera por voz."
            />
            <BulletRow
              icon="🔔"
              text="Recordatorios de vencimiento, estadísticas mensuales y mucho más que vas a ir descubriendo."
            />
          </View>

          <TouchableOpacity style={styles.btn} onPress={handleDone} activeOpacity={0.85}>
            <Text style={styles.btnText}>Empezar →</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function BulletRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletIcon}>{icon}</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0A1128',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 28,
    paddingBottom: 40,
    paddingTop: 12,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center', marginBottom: 28,
  },
  title: {
    fontSize: 24, fontWeight: '800', color: '#FFFFFF',
    marginBottom: 8, letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.5)',
    lineHeight: 20, marginBottom: 28,
  },
  bullets: { gap: 20, marginBottom: 36 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  bulletIcon: { fontSize: 22, marginTop: -2 },
  bulletText: {
    flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.82)',
    lineHeight: 21, fontWeight: '400',
  },
  btn: {
    backgroundColor: '#00C4A8',
    paddingVertical: 16, borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#00C4A8', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
});
