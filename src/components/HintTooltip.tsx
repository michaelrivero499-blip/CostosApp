import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Easing,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface Props {
  icon: string;
  text: string;
  onDismiss: () => void;
  /** 'top' = flecha arriba (tooltip debajo del elemento), 'bottom' = flecha abajo (tooltip encima del elemento) */
  arrow?: 'top' | 'bottom' | 'none';
}

export function HintTooltip({ icon, text, onDismiss, arrow = 'top' }: Props) {
  const { theme } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  const bg = theme.isDark ? '#1C2E52' : '#EEF4FF';
  const border = theme.isDark ? '#2D4070' : '#BFCFEF';
  const textColor = theme.isDark ? 'rgba(255,255,255,0.85)' : '#1e2d50';

  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1, duration: 300,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  return (
    <TouchableOpacity onPress={onDismiss} activeOpacity={1} style={styles.wrapper}>
      {/* Flecha apuntando hacia arriba (al elemento que está encima) */}
      {arrow === 'top' && (
        <View style={[styles.arrowUp, { borderBottomColor: border }]} />
      )}
      {arrow === 'top' && (
        <View style={[styles.arrowUpInner, { borderBottomColor: bg }]} />
      )}

      <Animated.View style={[
        styles.bubble,
        { backgroundColor: bg, borderColor: border },
        {
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [arrow === 'bottom' ? 6 : -6, 0] }) }],
        },
      ]}>
        <Text style={styles.icon}>{icon}</Text>
        <View style={styles.body}>
          <Text style={[styles.text, { color: textColor }]}>{text}</Text>
        </View>
        <TouchableOpacity onPress={onDismiss} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={[styles.closeText, { color: theme.subtext }]}>✕</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Flecha apuntando hacia abajo (al elemento que está debajo) */}
      {arrow === 'bottom' && (
        <View style={[styles.arrowDown, { borderTopColor: border }]} />
      )}
      {arrow === 'bottom' && (
        <View style={[styles.arrowDownInner, { borderTopColor: bg }]} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
  },
  arrowUp: {
    width: 0, height: 0,
    borderLeftWidth: 9, borderRightWidth: 9, borderBottomWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginLeft: 24,
  },
  arrowUpInner: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderBottomWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginLeft: 26,
    marginTop: -9,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  arrowDown: {
    width: 0, height: 0,
    borderLeftWidth: 9, borderRightWidth: 9, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    alignSelf: 'flex-end',
    marginRight: 26,
  },
  arrowDownInner: {
    width: 0, height: 0,
    borderLeftWidth: 7, borderRightWidth: 7, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    alignSelf: 'flex-end',
    marginRight: 28,
    marginTop: -9,
  },
  icon: { fontSize: 18, marginTop: 1 },
  body: { flex: 1 },
  text: { fontSize: 13, lineHeight: 19, fontWeight: '500' },
  closeBtn: { padding: 2, marginTop: 1 },
  closeText: { fontSize: 11, fontWeight: '700' },
});
