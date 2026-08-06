import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  icon: string;
  title: string;
  text: string;
  onDismiss: () => void;
}

export function HintCard({ icon, title, text, onDismiss }: Props) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 340,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  function handleDismiss() {
    Animated.timing(anim, {
      toValue: 0, duration: 200, useNativeDriver: true,
    }).start(() => onDismiss());
  }

  const style = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  };

  return (
    <Animated.View style={[
      styles.card,
      { backgroundColor: theme.isDark ? '#1a2744' : '#EEF2FF', borderColor: theme.isDark ? '#2a3a6a' : '#C7D2FE' },
      style,
    ]}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.body}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.text, { color: theme.subtext }]}>{text}</Text>
      </View>
      <TouchableOpacity onPress={handleDismiss} style={styles.closeBtn} activeOpacity={0.7}>
        <Text style={[styles.closeText, { color: theme.subtext }]}>✕</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  icon: { fontSize: 22, marginTop: 1 },
  body: { flex: 1, gap: 3 },
  title: { fontSize: 13, fontWeight: '700' },
  text: { fontSize: 12, lineHeight: 18 },
  closeBtn: { padding: 4, marginTop: -2 },
  closeText: { fontSize: 12, fontWeight: '600' },
});
