import React, { useRef, useEffect } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Easing } from 'react-native';
import { Person, Debt } from '../types';
import { getPersonStatus, getPersonTotal, formatAmount, STATUS_COLORS, DIRECTION_COLORS } from '../utils';

interface Props {
  person: Person;
  debts: Debt[];
  onPress: () => void;
  isNew?: boolean;
  isExiting?: boolean;
  onExitComplete?: () => void;
}

export function PersonCard({ person, debts, onPress, isNew, isExiting, onExitComplete }: Props) {
  const total = getPersonTotal(debts);
  const status = getPersonStatus(debts);
  const activeCount = debts.filter(d => d.status === 'pendiente').length;

  const amountColor = total > 0 ? DIRECTION_COLORS.me_debe
    : total < 0 ? DIRECTION_COLORS.le_debo
    : '#1A1A2E';
  const statusLabel = total > 0 ? 'me debe'
    : total < 0 ? 'le debo'
    : debts.length > 0 ? 'pagado' : '';
  const statusColor = total !== 0 ? amountColor : STATUS_COLORS[status];

  const opacity = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const scale = useRef(new Animated.Value(isNew ? 0.95 : 1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 250,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, []);

  useEffect(() => {
    if (isExiting) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -60,
          duration: 250,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => onExitComplete?.());
    }
  }, [isExiting]);

  return (
    <Animated.View style={{ opacity, transform: [{ scale }, { translateX }] }}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.avatar, { backgroundColor: person.color }]}>
          <Text style={styles.avatarEmoji}>{person.avatar}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{person.name}</Text>
          <Text style={styles.debtsCount}>
            {activeCount} {activeCount === 1 ? 'deuda activa' : 'deudas activas'}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.amount, { color: amountColor }]}>{formatAmount(total)}</Text>
          {statusLabel ? (
            <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  info: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  debtsCount: {
    fontSize: 12,
    color: '#8E8E93',
  },
  right: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 2,
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
  },
});
