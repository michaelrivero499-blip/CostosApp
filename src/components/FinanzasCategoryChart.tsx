import React, { useRef, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, Animated, Easing, Pressable } from 'react-native';
import { Category } from '../constants/categories';
import { Theme } from '../context/ThemeContext';

const BAR_MAX_H   = 160;   // fill bars scale to this max
const EXTRA_H     = 36;    // extra container height for budget overflows
const CONTAINER_H = BAR_MAX_H + EXTRA_H;
const BAR_W       = 64;

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`;
  return `${Math.round(n)}`;
}

interface BarProps {
  cat: Category;
  spent: number;
  budget: number | null;
  maxSpent: number;
  theme: Theme;
  onPress: () => void;
  onLongPress: (pageX: number, pageY: number) => void;
}

function CategoryBarColumn({ cat, spent, budget, maxSpent, theme, onPress, onLongPress }: BarProps) {
  const fillAnim   = useRef(new Animated.Value(0)).current;
  const budgetAnim = useRef(new Animated.Value(0)).current;

  const scale   = maxSpent > 0 ? maxSpent : 1;
  // Fill: capped at BAR_MAX_H (1.0 × scale)
  const fillH   = Math.min(spent / scale, 1) * BAR_MAX_H;
  // Budget: can go up to CONTAINER_H, signalling "budget far exceeds spending"
  const budgetH = budget ? Math.min(budget / scale, CONTAINER_H / BAR_MAX_H) * BAR_MAX_H : 0;

  const pct       = budget && budget > 0 ? Math.round((spent / budget) * 100) : null;
  const overBudget = pct !== null && pct > 100;

  useEffect(() => {
    fillAnim.setValue(0);
    budgetAnim.setValue(0);
    Animated.parallel([
      Animated.timing(fillAnim,   { toValue: fillH,   duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(budgetAnim, { toValue: budgetH, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ]).start();
  }, [fillH, budgetH]);

  const barFill  = theme.isDark ? cat.barColor + 'CC' : cat.barColor;
  const pctColor = overBudget ? '#F05B53' : theme.subtext;

  return (
    <Pressable
      style={styles.column}
      onPress={onPress}
      onLongPress={e => onLongPress(e.nativeEvent.pageX, e.nativeEvent.pageY)}
      delayLongPress={400}
    >
      {/* Zona de barra — altura extendida para admitir presupuesto alto */}
      <View style={styles.barArea}>
        {/* Contorno punteado del presupuesto */}
        {budgetH > 0 && (
          <Animated.View style={[
            styles.budgetOutline,
            { borderColor: theme.isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', height: budgetAnim },
          ]} />
        )}
        {/* Barra de gasto rellena */}
        <Animated.View style={[
          styles.filledBar,
          { backgroundColor: barFill, height: fillAnim },
        ]} />
      </View>
      {/* Emoji */}
      <Text style={styles.emoji}>{cat.emoji}</Text>
      {/* Monto */}
      <Text style={[styles.amount, { color: theme.text }]}>{fmtK(spent)}</Text>
      {/* % de presupuesto */}
      {pct !== null && (
        <Text style={[styles.pct, { color: pctColor }]}>{pct}%</Text>
      )}
    </Pressable>
  );
}

interface ChartProps {
  categories: Array<{ cat: Category; spent: number; budget: number | null }>;
  theme: Theme;
  onCategoryPress: (catId: string) => void;
  onCategoryLongPress: (catId: string, pageX: number, pageY: number) => void;
}

export function FinanzasCategoryChart({ categories, theme, onCategoryPress, onCategoryLongPress }: ChartProps) {
  if (categories.length === 0) return null;

  const maxSpent = Math.max(...categories.map(({ spent }) => spent), 1);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16 }]}
    >
      {categories.map(({ cat, spent, budget }) => (
        <CategoryBarColumn
          key={cat.id}
          cat={cat}
          spent={spent}
          budget={budget}
          maxSpent={maxSpent}
          theme={theme}
          onPress={() => onCategoryPress(cat.id)}
          onLongPress={(x, y) => onCategoryLongPress(cat.id, x, y)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    alignItems: 'flex-end',
    gap: 14,
    paddingBottom: 4,
  },
  column: {
    width: BAR_W,
    alignItems: 'center',
    gap: 4,
  },
  barArea: {
    width: BAR_W,
    height: CONTAINER_H,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  budgetOutline: {
    position: 'absolute',
    bottom: 0,
    width: BAR_W,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  filledBar: {
    position: 'absolute',
    bottom: 0,
    width: BAR_W,
    borderRadius: 12,
    minHeight: 4,
  },
  emoji:  { fontSize: 20, marginTop: 2 },
  amount: { fontSize: 12, fontWeight: '700' },
  pct:    { fontSize: 11, fontWeight: '600' },
});
