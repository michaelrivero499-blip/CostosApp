import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { formatAmount } from '../utils';

interface Props {
  total: number;
  personCount: number;
  debtCount: number;
  pendingPersonCount: number;
}

export function SummaryCard({ total, personCount, debtCount, pendingPersonCount }: Props) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    Animated.sequence([
      Animated.timing(pulseAnim, {
        toValue: 1.05,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [total]);

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Total general</Text>
      <Animated.Text style={[styles.amount, { transform: [{ scale: pulseAnim }] }]}>
        {formatAmount(total)}
      </Animated.Text>
      <View style={styles.footer}>
        <Text style={styles.subtitle}>
          {personCount} {personCount === 1 ? 'persona' : 'personas'} · {debtCount} {debtCount === 1 ? 'deuda' : 'deudas'}
        </Text>
        {pendingPersonCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {pendingPersonCount} {pendingPersonCount === 1 ? 'pendiente' : 'pendientes'}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 16,
    marginBottom: 24,
  },
  label: {
    color: '#8E8E93',
    fontSize: 13,
    marginBottom: 6,
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
    marginBottom: 10,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subtitle: {
    color: '#8E8E93',
    fontSize: 13,
  },
  badge: {
    backgroundColor: '#FF4757',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
