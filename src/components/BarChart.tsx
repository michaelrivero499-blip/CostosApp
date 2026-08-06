import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Animated, Easing,
  TouchableOpacity, useWindowDimensions,
} from 'react-native';
import { DebtDirection, Currency } from '../types';
import { formatAmountShortCurrency, formatAmountCurrency } from '../utils';
import { useTheme, Theme } from '../context/ThemeContext';

// ── Colores semánticos Vera ───────────────────────────────────────────────────
const C_MEDE = '#34C759';  // verde — me deben
const C_LEDE = '#F05B53';  // rojo  — le debo

const BAR_MAX_H = 120;
const BAR_W     = 44;

// ── Tipos ─────────────────────────────────────────────────────────────────────
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
  currency?: Currency;
}

// ── Barra horizontal animada ──────────────────────────────────────────────────
function HBar({
  item, maxValue, trackWidth, isSelected, isDimmed, onPress, theme,
}: {
  item: BarData; maxValue: number; trackWidth: number;
  isSelected: boolean; isDimmed: boolean; onPress: () => void; theme: any;
}) {
  const anim  = useRef(new Animated.Value(0)).current;
  const color = item.direction === 'me_debe' ? C_MEDE : C_LEDE;
  const targetW = Math.max((item.value / maxValue) * trackWidth, 6);

  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: targetW,
      duration: 580,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [targetW]);

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[hStyles.row, { opacity: isDimmed ? 0.22 : 1 }]}
    >
      {/* Nombre */}
      <Text
        style={[hStyles.name, {
          color: isSelected ? '#fff' : theme.subtext,
          fontWeight: isSelected ? '700' : '500',
        }]}
        numberOfLines={1}
      >
        {item.label}
      </Text>

      {/* Track */}
      <View style={[hStyles.track, { backgroundColor: color + '1A' }]}>
        <Animated.View style={[
          hStyles.fill,
          {
            width: anim,
            backgroundColor: color,
            shadowColor: isSelected ? color : 'transparent',
            shadowOpacity: isSelected ? 0.5 : 0,
            shadowRadius: 8,
            elevation: isSelected ? 5 : 0,
          },
        ]} />
        {/* Dir indicator */}
        <Text style={[hStyles.dirTag, { color }]}>
          {item.direction === 'me_debe' ? '↑' : '↓'}
        </Text>
      </View>

      {/* Monto */}
      <Text style={[hStyles.amt, { color }]}>
        {formatAmountShortCurrency(item.value, 'ARS').replace('$', '')}
      </Text>
    </TouchableOpacity>
  );
}

const hStyles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', marginBottom: 11, gap: 8 },
  name:   { width: 60, fontSize: 13, textAlign: 'right' },
  track:  { flex: 1, height: 22, borderRadius: 7, overflow: 'visible', justifyContent: 'center' },
  fill:   { height: 22, borderRadius: 7, position: 'absolute', left: 0 },
  dirTag: { fontSize: 12, fontWeight: '700', marginLeft: 6, zIndex: 1 },
  amt:    { width: 48, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});

// ── Panel de desglose ─────────────────────────────────────────────────────────
function Breakdown({
  item, currency, onClose, theme,
}: {
  item: BarData; currency: Currency; onClose: () => void; theme: any;
}) {
  const color = item.direction === 'me_debe' ? C_MEDE : C_LEDE;
  const label = item.direction === 'me_debe' ? 'te debe' : 'le debés';

  return (
    <View style={[brkStyles.card, { backgroundColor: theme.isDark ? theme.bg : '#F4F4F8' }]}>
      {/* Header */}
      <View style={brkStyles.header}>
        <View style={[brkStyles.dot, { backgroundColor: color }]} />
        <Text style={[brkStyles.name, { color: theme.text }]}>{item.label}</Text>
        <View style={[brkStyles.dirPill, { backgroundColor: color + '22' }]}>
          <Text style={[brkStyles.dirPillText, { color }]}>{label}</Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[brkStyles.close, { color: theme.subtext }]}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Rows */}
      {item.debts.length === 0 ? (
        <Text style={[brkStyles.empty, { color: theme.subtext }]}>Sin deudas activas</Text>
      ) : (
        item.debts.map((d, i) => {
          const pct    = item.value > 0 ? Math.round((d.amount / item.value) * 100) : 0;
          const dColor = d.direction === 'me_debe' ? C_MEDE : C_LEDE;
          return (
            <View key={i} style={brkStyles.row}>
              {/* background pct bar */}
              <View style={[brkStyles.pctBg, { width: `${pct}%`, backgroundColor: dColor + '18' }]} />
              <Text style={[brkStyles.arrow, { color: dColor }]}>
                {d.direction === 'me_debe' ? '↑' : '↓'}
              </Text>
              <Text style={[brkStyles.desc, { color: theme.subtext }]} numberOfLines={1}>
                {d.description}
              </Text>
              <Text style={[brkStyles.amt, { color: theme.text }]}>
                {formatAmountShortCurrency(d.amount, currency)}
              </Text>
              <Text style={[brkStyles.pct, { color: dColor }]}>{pct}%</Text>
            </View>
          );
        })
      )}

      {/* Total */}
      <View style={[brkStyles.divider, { backgroundColor: theme.border }]} />
      <View style={brkStyles.totalRow}>
        <Text style={[brkStyles.totalLabel, { color: theme.subtext }]}>Total neto</Text>
        <Text style={[brkStyles.totalAmt, { color }]}>
          {formatAmountCurrency(item.value, currency)}
        </Text>
      </View>
    </View>
  );
}

const brkStyles = StyleSheet.create({
  card:      { borderRadius: 14, padding: 14, marginTop: 8, marginBottom: 4 },
  header:    { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 6 },
  dot:       { width: 10, height: 10, borderRadius: 5 },
  name:      { flex: 1, fontSize: 15, fontWeight: '700' },
  dirPill:   { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  dirPillText: { fontSize: 11, fontWeight: '700' },
  close:     { fontSize: 16, paddingLeft: 4 },
  empty:     { fontSize: 13, textAlign: 'center', paddingVertical: 6 },
  row: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 8,
    gap: 6, overflow: 'hidden',
  },
  pctBg:     { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 4 },
  arrow:     { fontSize: 13, fontWeight: '700', width: 16 },
  desc:      { flex: 1, fontSize: 13 },
  amt:       { fontSize: 13, fontWeight: '600' },
  pct:       { fontSize: 11, fontWeight: '700', width: 30, textAlign: 'right' },
  divider:   { height: StyleSheet.hairlineWidth, marginVertical: 10 },
  totalRow:  { flexDirection: 'row', alignItems: 'center' },
  totalLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  totalAmt:  { fontSize: 16, fontWeight: '800' },
});

// ── Componente principal ──────────────────────────────────────────────────────
export function BarChart({ data, currency = 'ARS' }: Props) {
  const { theme }  = useTheme();
  const styles     = useMemo(() => createStyles(theme), [theme]);
  const { width }  = useWindowDimensions();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [mode, setMode]  = useState<'v' | 'h'>('v');

  // Animated values para barras verticales
  const barAnimsRef = useRef<Animated.Value[]>([]);
  while (barAnimsRef.current.length < data.length) {
    barAnimsRef.current.push(new Animated.Value(0));
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);

  // Animar barras verticales al montar o cambiar datos
  useEffect(() => {
    if (mode !== 'v') return;
    // reset
    barAnimsRef.current.forEach(a => a.setValue(0));
    const anims = data.map((item, i) => {
      const targetH = Math.max((item.value / maxValue) * BAR_MAX_H, 8);
      return Animated.timing(barAnimsRef.current[i], {
        toValue: targetH,
        duration: 520,
        delay: i * 55,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      });
    });
    Animated.parallel(anims).start();
  }, [data, mode]);

  // Al cambiar de modo, deseleccionar
  function toggleMode() {
    setSelectedIndex(null);
    setMode(m => m === 'v' ? 'h' : 'v');
  }

  function toggleSelect(i: number) {
    setSelectedIndex(prev => prev === i ? null : i);
  }

  const selected = selectedIndex !== null ? data[selectedIndex] : null;

  // Totales para la fila de resumen
  const totalMeDeben = data.filter(d => d.direction === 'me_debe').reduce((s, d) => s + d.value, 0);
  const totalLeDebo  = data.filter(d => d.direction === 'le_debo').reduce((s, d) => s + d.value, 0);

  // Ancho disponible para barras horizontales
  const hTrackWidth = width - 32 - 32 - 60 - 48 - 24; // screen - margins - card pad - name - amt - gaps

  if (data.length === 0) return null;

  return (
    <View style={styles.container}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Deuda por persona</Text>
          <Text style={styles.subtitle}>
            {data.length} {data.length === 1 ? 'persona' : 'personas'} con saldo pendiente
          </Text>
        </View>
        <TouchableOpacity onPress={toggleMode} style={styles.modeBtn} activeOpacity={0.7}>
          <Text style={styles.modeBtnIcon}>{mode === 'v' ? '☰' : '▦'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Totales rápidos ── */}
      {(totalMeDeben > 0 || totalLeDebo > 0) && (
        <View style={styles.netRow}>
          {totalMeDeben > 0 && (
            <View style={[styles.netChip, { backgroundColor: C_MEDE + '18', borderColor: C_MEDE + '44' }]}>
              <Text style={[styles.netAmt, { color: C_MEDE }]}>
                {formatAmountShortCurrency(totalMeDeben, currency)}
              </Text>
              <Text style={styles.netLabel}>me deben</Text>
            </View>
          )}
          {totalLeDebo > 0 && (
            <View style={[styles.netChip, { backgroundColor: C_LEDE + '18', borderColor: C_LEDE + '44' }]}>
              <Text style={[styles.netAmt, { color: C_LEDE }]}>
                {formatAmountShortCurrency(totalLeDebo, currency)}
              </Text>
              <Text style={styles.netLabel}>le debo</Text>
            </View>
          )}
        </View>
      )}

      {/* ── Barras verticales ── */}
      {mode === 'v' && (
        <View style={styles.vArea}>
          {data.map((item, i) => {
            const isSelected = selectedIndex === i;
            const isDimmed   = selectedIndex !== null && !isSelected;
            const color      = item.direction === 'me_debe' ? C_MEDE : C_LEDE;

            return (
              <TouchableOpacity
                key={item.label + i}
                activeOpacity={0.75}
                onPress={() => toggleSelect(i)}
                style={[styles.vCol, { opacity: isDimmed ? 0.22 : 1 }]}
              >
                {/* Etiqueta monto sobre la barra */}
                <Text style={[styles.vAmt, { color }]}>
                  {formatAmountShortCurrency(item.value, currency)}
                </Text>

                {/* Barra animada */}
                <Animated.View style={[
                  styles.vBar,
                  {
                    height: barAnimsRef.current[i] ?? BAR_MAX_H * 0.5,
                    backgroundColor: color,
                    borderWidth: isSelected ? 2.5 : 0,
                    borderColor: theme.isDark ? '#fff' : '#1A1A2E',
                    shadowColor: color,
                    shadowOpacity: isSelected ? 0.6 : 0,
                    shadowRadius: 10,
                    elevation: isSelected ? 8 : 0,
                  },
                ]} />

                {/* Nombre debajo */}
                <Text
                  style={[
                    styles.vName,
                    {
                      color: isSelected ? theme.text : theme.subtext,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Barras horizontales ── */}
      {mode === 'h' && (
        <View style={styles.hArea}>
          {data.map((item, i) => (
            <HBar
              key={item.label + i}
              item={item}
              maxValue={maxValue}
              trackWidth={hTrackWidth}
              isSelected={selectedIndex === i}
              isDimmed={selectedIndex !== null && selectedIndex !== i}
              onPress={() => toggleSelect(i)}
              theme={theme}
            />
          ))}
        </View>
      )}

      {/* ── Desglose al seleccionar ── */}
      {selected && (
        <Breakdown
          item={selected}
          currency={currency}
          onClose={() => setSelectedIndex(null)}
          theme={theme}
        />
      )}

      {/* ── Leyenda ── */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: C_MEDE }]} />
          <Text style={styles.legendText}>Me deben</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: C_LEDE }]} />
          <Text style={styles.legendText}>Le debo</Text>
        </View>
        <Text style={styles.legendHint}>Tocá una barra para ver el detalle</Text>
      </View>
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
function createStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      backgroundColor: t.card,
      borderRadius: 18,
      padding: 16,
      marginHorizontal: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.07,
      shadowRadius: 8,
      elevation: 3,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      fontSize: 15,
      fontWeight: '700',
      color: t.text,
    },
    subtitle: {
      fontSize: 11,
      color: t.subtext,
      marginTop: 1,
    },
    modeBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: t.isDark ? t.bg : '#F0F0F5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeBtnIcon: {
      fontSize: 15,
      color: t.subtext,
    },

    // Net totals row
    netRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    netChip: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 10,
      paddingVertical: 7,
      alignItems: 'center',
    },
    netAmt: {
      fontSize: 14,
      fontWeight: '800',
    },
    netLabel: {
      fontSize: 10,
      color: t.subtext,
      marginTop: 1,
      fontWeight: '500',
    },

    // Barras verticales
    vArea: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-evenly',
      height: BAR_MAX_H + 58,  // espacio para etiquetas arriba/abajo
      paddingTop: 22,
      marginBottom: 4,
    },
    vCol: {
      alignItems: 'center',
      flex: 1,
      paddingHorizontal: 3,
      justifyContent: 'flex-end',
    },
    vAmt: {
      fontSize: 10,
      fontWeight: '700',
      marginBottom: 4,
      textAlign: 'center',
    },
    vBar: {
      width: BAR_W,
      borderRadius: 10,
    },
    vName: {
      fontSize: 12,
      marginTop: 6,
      textAlign: 'center',
      maxWidth: 62,
    },

    // Barras horizontales
    hArea: {
      marginBottom: 4,
      paddingTop: 4,
    },

    // Leyenda
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      gap: 14,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      fontSize: 11,
      color: t.subtext,
    },
    legendHint: {
      flex: 1,
      textAlign: 'right',
      fontSize: 10,
      color: t.subtext,
      opacity: 0.6,
    },
  });
}
