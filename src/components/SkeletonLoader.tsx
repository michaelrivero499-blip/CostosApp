/**
 * SkeletonLoader — pantallas de carga esqueleto con efecto shimmer.
 * Usado en HomeScreen mientras loading === true.
 * No requiere librerías externas — usa Animated de React Native.
 */
import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ── Barra shimmer animada ─────────────────────────────────────────────────────
function ShimmerBar({
  width = '100%' as number | `${number}%`,
  height = 16,
  borderRadius = 8,
  shimmer,
}: {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  shimmer: Animated.Value;
}) {
  const { theme } = useTheme();
  const baseColor   = theme.isDark ? '#1E2D42' : '#E8E8F0';
  const flashColor  = theme.isDark ? '#263850' : '#F5F5FF';

  const backgroundColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [baseColor, flashColor],
  });

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor },
      ]}
    />
  );
}

// ── Tarjeta esqueleto de persona ──────────────────────────────────────────────
function SkeletonPersonCard({ shimmer }: { shimmer: Animated.Value }) {
  const { theme } = useTheme();
  return (
    <View style={[S.card, { backgroundColor: theme.card }]}>
      <ShimmerBar width={46} height={46} borderRadius={23} shimmer={shimmer} />
      <View style={S.cardContent}>
        <ShimmerBar width={120} height={15} shimmer={shimmer} />
        <View style={{ height: 6 }} />
        <ShimmerBar width={80} height={11} shimmer={shimmer} />
      </View>
      <View style={S.cardRight}>
        <ShimmerBar width={70} height={15} shimmer={shimmer} />
        <View style={{ height: 6 }} />
        <ShimmerBar width={40} height={11} shimmer={shimmer} />
      </View>
    </View>
  );
}

// ── Tarjeta de resumen esqueleto ──────────────────────────────────────────────
function SkeletonSummaryCard({ shimmer }: { shimmer: Animated.Value }) {
  const { theme } = useTheme();
  return (
    <View style={[S.summary, { backgroundColor: theme.card }]}>
      <ShimmerBar width={100} height={13} shimmer={shimmer} />
      <View style={{ height: 12 }} />
      <ShimmerBar width={160} height={32} shimmer={shimmer} />
      <View style={{ height: 10 }} />
      <View style={S.row}>
        <ShimmerBar width={90} height={13} shimmer={shimmer} />
        <ShimmerBar width={90} height={13} shimmer={shimmer} />
      </View>
    </View>
  );
}

// ── Export principal ──────────────────────────────────────────────────────────
export function HomeSkeletonLoader() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <View style={S.container}>
      <SkeletonSummaryCard shimmer={shimmer} />
      <View style={{ height: 20 }} />
      {[1, 2, 3, 4].map(i => (
        <React.Fragment key={i}>
          <SkeletonPersonCard shimmer={shimmer} />
          <View style={{ height: 8 }} />
        </React.Fragment>
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  summary: {
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  card: {
    borderRadius: 12,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
  },
  cardRight: {
    alignItems: 'flex-end',
  },
});
