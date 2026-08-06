import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Image, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useCostos } from '../context/CostosContext';
import { formatAmountCurrency, CURRENCY_SYMBOLS, CURRENCY_ORDER } from '../utils';
import { Currency } from '../types';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'ChartDetail'>;

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTH_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── Count-up con reset al cambiar de año o moneda ──────────────────────────
function CountUpText({
  value, currency, prefix = '', style,
}: { value: number; currency: Currency; prefix?: string; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setDisp(v));
    Animated.timing(anim, {
      toValue: Math.abs(value), duration: 500,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [value]);
  return (
    <Text style={style}>
      {prefix}{formatAmountCurrency(Math.round(disp), currency)}
    </Text>
  );
}

export function ChartDetailScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { debts, persons } = useCostos();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    debts.forEach(d => years.add(new Date(d.date).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [debts]);

  const [selectedYear, setSelectedYear] = useState(availableYears[0]);
  const [expandedMonth, setExpandedMonth] = useState<number | null>(null);
  const [chartCurrency, setChartCurrency] = useState<Currency>('ARS');

  const personMap = useMemo(() => Object.fromEntries(persons.map(p => [p.id, p])), [persons]);

  // Monedas con actividad en el año seleccionado
  const chartCurrencies = useMemo(() => {
    const set = new Set<Currency>();
    debts.forEach(d => {
      if (new Date(d.date).getFullYear() === selectedYear) {
        set.add((d.currency ?? 'ARS') as Currency);
      }
    });
    return CURRENCY_ORDER.filter(c => set.has(c as Currency)) as Currency[];
  }, [debts, selectedYear]);

  const monthlyData = useMemo(() => {
    return MONTH_NAMES.map((label, i) => {
      // Todas las deudas del mes (sin filtro de moneda) — para el panel de detalle
      const allMonthDebts = debts.filter(d => {
        const dd = new Date(d.date);
        return dd.getFullYear() === selectedYear && dd.getMonth() === i;
      });
      // Solo la moneda seleccionada — para las barras del gráfico y totales
      const filteredDebts = allMonthDebts.filter(d => (d.currency ?? 'ARS') === chartCurrency);
      const meDebe = filteredDebts.filter(x => x.direction === 'me_debe').reduce((s, x) => s + x.amount, 0);
      const leDebo = filteredDebts.filter(x => x.direction === 'le_debo').reduce((s, x) => s + x.amount, 0);
      // Totales sin filtro de moneda — para el desglose mensual
      const allMeDebe = allMonthDebts.filter(x => x.direction === 'me_debe').reduce((s, x) => s + x.amount, 0);
      const allLeDebo = allMonthDebts.filter(x => x.direction === 'le_debo').reduce((s, x) => s + x.amount, 0);
      return { label, meDebe, leDebo, allMeDebe, allLeDebo, debts: allMonthDebts };
    });
  }, [debts, selectedYear, chartCurrency]);

  const maxVal = Math.max(...monthlyData.flatMap(m => [m.meDebe, m.leDebo]), 1);
  const totalMeDebe = monthlyData.reduce((s, m) => s + m.meDebe, 0);
  const totalLeDebo = monthlyData.reduce((s, m) => s + m.leDebo, 0);
  const neto = totalMeDebe - totalLeDebo;

  const barProgress = useRef(new Animated.Value(0)).current;
  const sec0 = useRef(new Animated.Value(0)).current; // totales card
  const sec1 = useRef(new Animated.Value(0)).current; // chart card
  const sec2 = useRef(new Animated.Value(0)).current; // lista

  // Entrada inicial — secciones en cascada
  useEffect(() => {
    Animated.stagger(80, [sec0, sec1, sec2].map(a =>
      Animated.timing(a, {
        toValue: 1, duration: 300,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      })
    )).start();
  }, []);

  // Al cambiar de año o moneda — barras se resetean y reaniman
  useEffect(() => {
    barProgress.setValue(0);
    Animated.timing(barProgress, {
      toValue: 1, duration: 420,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [selectedYear, chartCurrency]);

  function toggleMonth(i: number) {
    setExpandedMonth(prev => prev === i ? null : i);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backArrow, { color: theme.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text }]}>Actividad</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Selector de años */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.yearRow}
        style={styles.yearScroll}
      >
        {availableYears.map(year => (
          <TouchableOpacity
            key={year}
            style={[styles.yearChip, selectedYear === year && styles.yearChipActive]}
            onPress={() => {
              setSelectedYear(year);
              setExpandedMonth(null);
              // Si la moneda actual no tiene datos en el nuevo año, resetear a la primera disponible
              const yearsDebts = debts.filter(d => new Date(d.date).getFullYear() === year);
              const available = CURRENCY_ORDER.filter(c =>
                yearsDebts.some(d => (d.currency ?? 'ARS') === c)
              ) as Currency[];
              if (available.length > 0 && !available.includes(chartCurrency)) {
                setChartCurrency(available[0]);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.yearLabel, { color: selectedYear === year ? '#fff' : theme.subtext }]}>
              {year}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Totales del año */}
        <Animated.View style={[
          styles.totalsCard, { backgroundColor: theme.card },
          { opacity: sec0, transform: [{ translateY: sec0.interpolate({ inputRange: [0,1], outputRange: [14, 0] }) }] },
        ]}>
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: theme.subtext }]}>Me deben</Text>
            <CountUpText
              value={totalMeDebe} currency={chartCurrency} prefix="+"
              style={[styles.totalAmount, { color: '#34C759' }]}
            />
          </View>
          <View style={[styles.totalSep, { backgroundColor: theme.border }]} />
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: theme.subtext }]}>Le debo</Text>
            <CountUpText
              value={totalLeDebo} currency={chartCurrency} prefix="-"
              style={[styles.totalAmount, { color: '#F05B53' }]}
            />
          </View>
          <View style={[styles.totalSep, { backgroundColor: theme.border }]} />
          <View style={styles.totalItem}>
            <Text style={[styles.totalLabel, { color: theme.subtext }]}>Neto</Text>
            <CountUpText
              value={Math.abs(neto)} currency={chartCurrency} prefix={neto >= 0 ? '+' : '-'}
              style={[styles.totalAmount, { color: neto >= 0 ? '#34C759' : '#F05B53' }]}
            />
          </View>
        </Animated.View>

        {/* Gráfico */}
        <Animated.View style={[
          styles.chartCard, { backgroundColor: theme.card },
          { opacity: sec1, transform: [{ translateY: sec1.interpolate({ inputRange: [0,1], outputRange: [14, 0] }) }] },
        ]}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#34C759' }]} />
              <Text style={[styles.legendText, { color: theme.subtext }]}>Me deben</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F05B53' }]} />
              <Text style={[styles.legendText, { color: theme.subtext }]}>Le debo</Text>
            </View>
            {chartCurrencies.length > 1 && (
              <View style={styles.currencyChips}>
                {chartCurrencies.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.currencyChip, chartCurrency === c && styles.currencyChipActive]}
                    onPress={() => { setChartCurrency(c); setExpandedMonth(null); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.currencyChipText, chartCurrency === c && styles.currencyChipTextActive]}>
                      {c}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <View style={styles.chart}>
            {monthlyData.map((m, i) => {
              const isSelected = expandedMonth === i;
              return (
                <TouchableOpacity
                  key={i} style={styles.barGroup}
                  onPress={() => toggleMonth(i)} activeOpacity={0.7}
                >
                  <View style={styles.bars}>
                    <Animated.View style={[styles.bar, {
                      height: barProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, Math.max((m.meDebe / maxVal) * 110, m.meDebe > 0 ? 4 : 0)],
                      }),
                      backgroundColor: isSelected ? '#1a9e40' : '#34C759',
                    }]} />
                    <Animated.View style={[styles.bar, {
                      height: barProgress.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, Math.max((m.leDebo / maxVal) * 110, m.leDebo > 0 ? 4 : 0)],
                      }),
                      backgroundColor: isSelected ? '#c0392b' : '#F05B53',
                    }]} />
                  </View>
                  <Text style={[styles.barLabel, {
                    color: isSelected ? theme.text : theme.subtext,
                    fontWeight: isSelected ? '700' : '500',
                  }]}>{m.label}</Text>
                  {isSelected && <View style={[styles.barIndicator, { backgroundColor: '#F05B53' }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* Desglose mensual compacto + panel de detalle al tocar */}
        <Animated.View style={{ opacity: sec2, transform: [{ translateY: sec2.interpolate({ inputRange: [0,1], outputRange: [14, 0] }) }] }}>
        <Text style={[styles.sectionLabel, { color: theme.subtext }]}>DESGLOSE MENSUAL</Text>
        <View style={[styles.listCard, { backgroundColor: theme.card }]}>
          {monthlyData.map((m, i) => {
            const hasData = m.allMeDebe > 0 || m.allLeDebo > 0;
            const isExpanded = expandedMonth === i;

            return (
              <View key={i}>
                {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}

                {/* Fila del mes */}
                <TouchableOpacity
                  style={[styles.monthRow, isExpanded && { backgroundColor: theme.isDark ? '#1a2a3a' : '#F5F5FA' }]}
                  onPress={() => toggleMonth(i)}
                  activeOpacity={0.7}
                  disabled={!hasData}
                >
                  <Text style={[styles.monthName, { color: hasData ? theme.text : theme.subtext }]}>
                    {m.label}
                  </Text>
                  {hasData ? (
                    <>
                      <View style={styles.monthAmounts}>
                        {m.allMeDebe > 0 && (
                          <Text style={styles.monthMeDebe}>+{formatAmountCurrency(m.allMeDebe, 'ARS')}</Text>
                        )}
                        {m.allLeDebo > 0 && (
                          <Text style={styles.monthLeDebo}>-{formatAmountCurrency(m.allLeDebo, 'ARS')}</Text>
                        )}
                      </View>
                      <Text style={[styles.chevron, { color: theme.subtext }]}>{isExpanded ? '▲' : '▼'}</Text>
                    </>
                  ) : (
                    <Text style={[styles.monthEmpty, { color: theme.border }]}>Sin movimientos</Text>
                  )}
                </TouchableOpacity>

                {/* Panel expandido con deudas del mes */}
                {isExpanded && (
                  <View style={[styles.debtPanel, { borderTopColor: theme.border }]}>
                    <Text style={[styles.debtPanelTitle, { color: theme.subtext }]}>
                      {MONTH_FULL[i]} {selectedYear} — {m.debts.length} movimiento{m.debts.length !== 1 ? 's' : ''}
                    </Text>
                    {m.debts.map((debt, di) => {
                      const person = personMap[debt.personId];
                      const isMeDebe = debt.direction === 'me_debe';
                      return (
                        <View key={debt.id}>
                          {di > 0 && <View style={[styles.debtDivider, { backgroundColor: theme.border }]} />}
                          <TouchableOpacity
                            style={styles.debtRow}
                            activeOpacity={0.7}
                            onPress={() => person && navigation.navigate('PersonDetail', { personId: person.id })}
                          >
                            {person?.avatarUrl ? (
                              <Image source={{ uri: person.avatarUrl }} style={styles.debtAvatar} />
                            ) : (
                              <View style={[styles.debtAvatar, { backgroundColor: person?.color ?? '#ccc' }]}>
                                <Text style={styles.debtAvatarEmoji}>{person?.avatar ?? '?'}</Text>
                              </View>
                            )}
                            <View style={styles.debtInfo}>
                              <Text style={[styles.debtDesc, { color: theme.text }]} numberOfLines={1}>
                                {debt.description}
                              </Text>
                              <Text style={[styles.debtPerson, { color: theme.subtext }]}>
                                {person?.name ?? '—'} · {debt.status === 'pagado' ? 'Saldada' : 'Pendiente'}
                              </Text>
                            </View>
                            <Text style={[styles.debtAmount, { color: isMeDebe ? '#34C759' : '#F05B53' }]}>
                              {isMeDebe ? '+' : '-'}{formatAmountCurrency(debt.amount, debt.currency ?? 'ARS')}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}
        </View>
        </Animated.View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(t: { bg: string; card: string; text: string; subtext: string; border: string; isDark: boolean }) {
  return StyleSheet.create({
    safe: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backArrow: { fontSize: 24 },
    title: { flex: 1, fontSize: 18, fontWeight: '700', textAlign: 'center' },
    yearScroll: { flexGrow: 0, flexShrink: 0, height: 48, marginBottom: 10 },
    yearRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
    yearChip: {
      paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20,
      backgroundColor: t.isDark ? t.card : '#F0F0F5',
    },
    yearChipActive: { backgroundColor: '#00C4A8' },
    yearLabel: { fontSize: 15, fontWeight: '700' },
    scroll: { paddingHorizontal: 16 },
    totalsCard: {
      borderRadius: 16, flexDirection: 'row', marginBottom: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, overflow: 'hidden',
    },
    totalItem: { flex: 1, alignItems: 'center', paddingVertical: 12 },
    totalLabel: { fontSize: 10, fontWeight: '600', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 },
    totalAmount: { fontSize: 13, fontWeight: '800' },
    totalSep: { width: StyleSheet.hairlineWidth },
    chartCard: {
      borderRadius: 16, padding: 14, marginBottom: 14,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    legend: { flexDirection: 'row', gap: 12, marginBottom: 10, alignItems: 'center' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 12, fontWeight: '500' },
    currencyChips: { flexDirection: 'row', gap: 6, marginLeft: 'auto' },
    currencyChip: {
      paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10,
      backgroundColor: t.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
    },
    currencyChipActive: { backgroundColor: '#00C4A8' },
    currencyChipText: { fontSize: 10, fontWeight: '700', color: t.subtext },
    currencyChipTextActive: { color: '#FFFFFF' },
    chart: { flexDirection: 'row', alignItems: 'flex-end', height: 124 },
    barGroup: { flex: 1, alignItems: 'center', gap: 4 },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 110 },
    bar: { width: 9, borderRadius: 3 },
    barLabel: { fontSize: 9 },
    barIndicator: { width: 4, height: 4, borderRadius: 2, marginTop: -2 },
    sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
    listCard: {
      borderRadius: 16, overflow: 'hidden',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
    monthRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 10, gap: 8,
    },
    monthName: { fontSize: 13, fontWeight: '600', width: 32 },
    monthAmounts: { flex: 1, flexDirection: 'row', gap: 10 },
    monthMeDebe: { fontSize: 13, fontWeight: '600', color: '#34C759' },
    monthLeDebo: { fontSize: 13, fontWeight: '600', color: '#F05B53' },
    monthEmpty: { flex: 1, fontSize: 12 },
    chevron: { fontSize: 10 },
    debtPanel: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 16, paddingVertical: 10,
      backgroundColor: t.isDark ? '#0d1e2e' : '#F9F9FC',
    },
    debtPanelTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 10, textTransform: 'uppercase' },
    debtDivider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
    debtRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
    debtAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    debtAvatarEmoji: { fontSize: 15 },
    debtInfo: { flex: 1 },
    debtDesc: { fontSize: 13, fontWeight: '600' },
    debtPerson: { fontSize: 11, marginTop: 1 },
    debtAmount: { fontSize: 14, fontWeight: '700' },
  });
}
