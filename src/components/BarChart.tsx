import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { DebtDirection } from '../types';
import { DIRECTION_COLORS, formatAmountShort, formatAmount } from '../utils';
import { useTheme, Theme } from '../context/ThemeContext';

interface DebtItem {
  description: string;
  amount: number;
  direction: DebtDirection;
}

interface BarData {
  label: string;
  value: number;
  direction: DebtDirection;
  color: string;
  debts: DebtItem[];
}

interface Props {
  data: BarData[];
}

const CHART_HEIGHT = 140;
const MAX_BAR_RATIO = 0.80;
const LABEL_INSIDE_PX = 65;

export function BarChart({ data }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const chartWidth = width - 32;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const barWidth = Math.min(60, (chartWidth - 40) / data.length - 16);
  const spacing = (chartWidth - data.length * barWidth) / (data.length + 1);
  const maxBarHeight = CHART_HEIGHT * MAX_BAR_RATIO;

  const selected = selectedIndex !== null ? data[selectedIndex] : null;

  function handleBarPress(index: number) {
    setSelectedIndex(prev => (prev === index ? null : index));
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Deuda por persona</Text>
        <Text style={styles.period}>Este mes</Text>
      </View>

      <Svg width={chartWidth} height={CHART_HEIGHT + 30}>
        {data.map((item, index) => {
          const barHeight = Math.max(
            Math.min((item.value / maxValue) * maxBarHeight, maxBarHeight),
            item.value > 0 ? 6 : 0,
          );
          const x = spacing + index * (barWidth + spacing);
          const y = CHART_HEIGHT - barHeight;
          const color = item.color;
          const labelX = x + barWidth / 2;
          const isSelected = selectedIndex === index;
          const isDimmed = selectedIndex !== null && !isSelected;
          const showInside = barHeight >= LABEL_INSIDE_PX;

          return (
            <G key={item.label + index} opacity={isDimmed ? 0.3 : 1}>
              <Rect
                x={x} y={y}
                width={barWidth} height={barHeight}
                fill={color} rx={6}
                onPress={() => handleBarPress(index)}
              />
              <Rect
                x={x - 8} y={0}
                width={barWidth + 16} height={CHART_HEIGHT + 20}
                fill="transparent"
                onPress={() => handleBarPress(index)}
              />
              {item.value > 0 && (
                showInside ? (
                  <SvgText
                    x={labelX}
                    y={y + barHeight / 2 + 4}
                    textAnchor="middle"
                    fontSize={10}
                    fill="white"
                    fontWeight="700"
                  >
                    {formatAmountShort(item.value)}
                  </SvgText>
                ) : (
                  <SvgText
                    x={labelX}
                    y={y - 6}
                    textAnchor="middle"
                    fontSize={11}
                    fill={isSelected ? color : theme.subtext}
                    fontWeight="600"
                  >
                    {formatAmountShort(item.value)}
                  </SvgText>
                )
              )}
              <SvgText
                x={labelX}
                y={CHART_HEIGHT + 16}
                textAnchor="middle"
                fontSize={12}
                fill={isSelected ? theme.text : theme.subtext}
                fontWeight={isSelected ? '700' : '400'}
              >
                {item.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {selected !== null && (
        <View style={styles.breakdown}>
          <View style={styles.breakdownHeader}>
            <View style={[styles.breakdownDot, { backgroundColor: selected.color }]} />
            <Text style={styles.breakdownName}>{selected.label}</Text>
            <Text style={styles.breakdownClose} onPress={() => setSelectedIndex(null)}>✕</Text>
          </View>

          {selected.debts.length === 0 ? (
            <Text style={styles.breakdownEmpty}>Sin deudas activas</Text>
          ) : (
            selected.debts.map((d, i) => (
              <View key={i} style={styles.breakdownRow}>
                <Text style={[styles.breakdownArrow, { color: DIRECTION_COLORS[d.direction] }]}>
                  {d.direction === 'me_debe' ? '→' : '←'}
                </Text>
                <Text style={styles.breakdownDesc} numberOfLines={1}>{d.description}</Text>
                <Text style={styles.breakdownAmt}>{formatAmount(d.amount)}</Text>
              </View>
            ))
          )}

          <View style={styles.breakdownDivider} />
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownTotalLabel}>Neto</Text>
            <Text style={[
              styles.breakdownTotal,
              { color: DIRECTION_COLORS[selected.direction] },
            ]}>
              {selected.direction === 'me_debe' ? '+' : '-'}{formatAmount(selected.value)}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: DIRECTION_COLORS.me_debe }]} />
          <Text style={styles.legendText}>Me deben</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: DIRECTION_COLORS.le_debo }]} />
          <Text style={styles.legendText}>Les debo</Text>
        </View>
      </View>
    </View>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      backgroundColor: t.card,
      borderRadius: 16,
      padding: 16,
      marginHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: { fontSize: 15, fontWeight: '700', color: t.text },
    period: {
      fontSize: 12,
      color: t.subtext,
      backgroundColor: t.isDark ? t.bg : '#F5F5F5',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 8,
    },
    breakdown: {
      backgroundColor: t.isDark ? t.bg : '#F8F8F8',
      borderRadius: 12,
      padding: 12,
      marginTop: 4,
      marginBottom: 12,
    },
    breakdownHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    breakdownDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    breakdownName: { flex: 1, fontSize: 14, fontWeight: '700', color: t.text },
    breakdownClose: { fontSize: 14, color: t.subtext, paddingLeft: 8 },
    breakdownRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
    breakdownArrow: { fontSize: 14, fontWeight: '700', width: 16 },
    breakdownDesc: { flex: 1, fontSize: 13, color: t.subtext },
    breakdownAmt: { fontSize: 13, fontWeight: '600', color: t.text },
    breakdownEmpty: { fontSize: 13, color: t.subtext, textAlign: 'center', paddingVertical: 4 },
    breakdownDivider: { height: 1, backgroundColor: t.border, marginVertical: 8 },
    breakdownTotalLabel: { flex: 1, fontSize: 13, fontWeight: '700', color: t.text },
    breakdownTotal: { fontSize: 14, fontWeight: '800' },
    legend: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, color: t.subtext },
  });
}
