import React, { useRef, useEffect, useMemo } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View, Easing, Image } from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { Person, Debt } from '../types';
import { useTheme, Theme } from '../context/ThemeContext';
import {
  getPersonStatus, getPersonNetByCurrency,
  formatAmountCurrency, STATUS_COLORS, DIRECTION_COLORS,
} from '../utils';

interface Props {
  person: Person;
  debts: Debt[];
  onPress: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isNew?: boolean;
  isExiting?: boolean;
  onExitComplete?: () => void;
}

export function PersonCard({ person, debts, onPress, onEdit, onDelete, isNew, isExiting, onExitComplete }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const swipeableRef = useRef<Swipeable>(null);

  const status = getPersonStatus(debts);
  const activeCount = debts.filter(d => d.status === 'pendiente').length;

  const currencyNets = getPersonNetByCurrency(debts);
  const primaryNet   = currencyNets[0] ?? null;
  const extraCount   = currencyNets.length - 1;

  const amountColor = !primaryNet ? theme.text
    : primaryNet.net > 0 ? DIRECTION_COLORS.me_debe
    : DIRECTION_COLORS.le_debo;

  const statusLabel = !primaryNet
    ? (debts.length > 0 ? 'al día' : '')
    : primaryNet.net > 0 ? 'me debe' : 'le debo';

  const statusColor = primaryNet ? amountColor : STATUS_COLORS[status];

  const opacity    = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const scale      = useRef(new Animated.Value(isNew ? 0.95 : 1)).current;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1, duration: 250,
          easing: Easing.out(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1, duration: 250,
          easing: Easing.out(Easing.ease), useNativeDriver: true,
        }),
      ]).start();
    }
  }, []);

  useEffect(() => {
    if (isExiting) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0, duration: 250,
          easing: Easing.in(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -60, duration: 250,
          easing: Easing.in(Easing.ease), useNativeDriver: true,
        }),
      ]).start(() => onExitComplete?.());
    }
  }, [isExiting]);

  function renderRightActions() {
    return (
      <View style={styles.swipeActions}>
        <RectButton
          style={[styles.swipeBtn, styles.swipeBtnEdit]}
          onPress={() => { swipeableRef.current?.close(); onEdit?.(); }}
        >
          <Text style={styles.swipeBtnText}>Editar</Text>
        </RectButton>
        <RectButton
          style={[styles.swipeBtn, styles.swipeBtnDelete]}
          onPress={() => { swipeableRef.current?.close(); onDelete?.(); }}
        >
          <Text style={styles.swipeBtnText}>Eliminar</Text>
        </RectButton>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ scale }, { translateX }] }]}>
      <Swipeable
        ref={swipeableRef}
        friction={2}
        rightThreshold={40}
        overshootRight={false}
        renderRightActions={onEdit || onDelete ? renderRightActions : undefined}
      >
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
          {person.avatarUrl ? (
            <Image source={{ uri: person.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: person.color }]}>
              <Text style={styles.avatarEmoji}>{person.avatar}</Text>
            </View>
          )}
          <View style={styles.info}>
            <Text style={styles.name}>{person.name}</Text>
            <Text style={styles.debtsCount}>
              {activeCount === 0
                ? 'Al día'
                : `${activeCount} ${activeCount === 1 ? 'deuda activa' : 'deudas activas'}`}
            </Text>
          </View>
          <View style={styles.right}>
            <View style={styles.amountRow}>
              <Text style={[styles.amount, { color: amountColor }]}>
                {primaryNet
                  ? formatAmountCurrency(Math.abs(primaryNet.net), primaryNet.currency)
                  : formatAmountCurrency(0)}
              </Text>
              {extraCount > 0 && (
                <View style={styles.extraBadge}>
                  <Text style={styles.extraBadgeText}>+{extraCount}</Text>
                </View>
              )}
            </View>
            {statusLabel ? (
              <Text style={[styles.status, { color: statusColor }]}>{statusLabel}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      </Swipeable>
    </Animated.View>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      marginHorizontal: 16,
    },
    card: {
      backgroundColor: t.card,
      borderRadius: 12,
      padding: 14,
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
    avatarEmoji: { fontSize: 22 },
    info: { flex: 1 },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: t.text,
      marginBottom: 2,
    },
    debtsCount: {
      fontSize: 12,
      color: t.subtext,
    },
    right: { alignItems: 'flex-end' },
    amountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 2,
    },
    amount: {
      fontSize: 16,
      fontWeight: '700',
      color: t.text,
    },
    extraBadge: {
      backgroundColor: t.border,
      borderRadius: 8,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    extraBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: t.subtext,
    },
    status: { fontSize: 12, fontWeight: '500' },
    swipeActions: {
      flexDirection: 'row',
      marginBottom: 8,
      marginLeft: -12,
      borderTopRightRadius: 12,
      borderBottomRightRadius: 12,
      overflow: 'hidden',
    },
    swipeBtn: {
      width: 72,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swipeBtnEdit: {
      backgroundColor: '#3B82F6',
    },
    swipeBtnDelete: {
      backgroundColor: '#F05B53',
    },
    swipeBtnText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
