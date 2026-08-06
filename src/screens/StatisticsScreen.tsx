import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Animated, Easing,
} from 'react-native';
import { ShareStatsModal } from '../components/ShareStatsModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { useCostos } from '../context/CostosContext';
import { CURRENCY_SYMBOLS, CURRENCY_ORDER, formatAmountCurrency, effectiveAmount } from '../utils';
import { Currency } from '../types';
import { HintTooltip } from '../components/HintTooltip';
import { useHint } from '../hooks/useHint';

// ─── Count-up — misma firma visual que PersonDetailScreen ───────────────────
function CountUpAmount({
  value, currency, style,
}: { value: number; currency: Currency; style?: any }) {
  const absVal = Math.abs(value);
  const sign   = value >= 0 ? '+' : '-';
  const anim   = useRef(new Animated.Value(0)).current;
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisp(v));
    Animated.timing(anim, {
      toValue: absVal, duration: 520,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [absVal]);
  return <Text style={style}>{sign}{formatAmountCurrency(Math.round(disp), currency)}</Text>;
}

export function StatisticsScreen() {
  const { theme } = useTheme();
  const { persons, debts } = useCostos();
  const navigation = useNavigation<any>();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [showShare, setShowShare] = useState(false);
  const [chartCurrency, setChartCurrency] = useState<Currency>('ARS');
  const statsHint = useHint('stats_detail', 0);

  // ── Animaciones ──────────────────────────────────────────────────────────
  const barProgress = useRef(new Animated.Value(0)).current;
  const sec0 = useRef(new Animated.Value(0)).current;
  const sec1 = useRef(new Animated.Value(0)).current;
  const sec2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Barras crecen — snappy como Monai (400ms es suficiente)
    Animated.timing(barProgress, {
      toValue: 1, duration: 420,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
    // Secciones: ease-out, no spring con rebote
    Animated.stagger(90, [sec0, sec1, sec2].map(a =>
      Animated.timing(a, {
        toValue: 1, duration: 320,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      })
    )).start();
  }, []);

  // Al cambiar moneda — barras se resetean y reaniman
  useEffect(() => {
    barProgress.setValue(0);
    Animated.timing(barProgress, {
      toValue: 1, duration: 380,
      easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [chartCurrency]);

  function sectionStyle(anim: Animated.Value) {
    return {
      opacity: anim,
      transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
    };
  }

  const pendingDebts = debts.filter(d => d.status === 'pendiente');
  const paidDebts    = debts.filter(d => d.status === 'pagado');

  // Neto global por moneda (pendientes)
  const netoByC = useMemo(() => {
    const map: Record<string, number> = {};
    pendingDebts.forEach(d => {
      const c = d.currency ?? 'ARS';
      const eff = effectiveAmount(d);
      map[c] = (map[c] ?? 0) + (d.direction === 'me_debe' ? eff : -eff);
    });
    return CURRENCY_ORDER.map(c => ({ currency: c as Currency, net: map[c] ?? 0 })).filter(x => x.net !== 0);
  }, [pendingDebts]);

  // Top personas por volumen total (pendiente)
  const topPersons = useMemo(() => {
    return persons
      .map(p => {
        const pd = pendingDebts.filter(d => d.personId === p.id);
        const volume = pd.reduce((s, d) => s + effectiveAmount(d), 0);
        const net = pd.reduce((s, d) => s + (d.direction === 'me_debe' ? effectiveAmount(d) : -effectiveAmount(d)), 0);
        return { person: p, volume, net, count: pd.length };
      })
      .filter(x => x.count > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);
  }, [persons, pendingDebts]);

  // Monedas con actividad en cualquier deuda (para el selector del gráfico)
  const chartCurrencies = useMemo(() => {
    const set = new Set<Currency>();
    debts.forEach(d => set.add((d.currency ?? 'ARS') as Currency));
    return CURRENCY_ORDER.filter(c => set.has(c as Currency)) as Currency[];
  }, [debts]);

  // Movimientos por mes (últimos 6 meses) — filtrado por moneda seleccionada
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { label: string; meDebe: number; leDebo: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString('es-AR', { month: 'short' });
      const monthDebts = debts.filter(debt => {
        const dd = new Date(debt.date);
        return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth()
          && (debt.currency ?? 'ARS') === chartCurrency;
      });
      const meDebe = monthDebts.filter(x => x.direction === 'me_debe').reduce((s, x) => s + x.amount, 0);
      const leDebo = monthDebts.filter(x => x.direction === 'le_debo').reduce((s, x) => s + x.amount, 0);
      months.push({ label, meDebe, leDebo });
    }
    return months;
  }, [debts, chartCurrency]);

  const maxMonthly = Math.max(...monthlyData.flatMap(m => [m.meDebe, m.leDebo]), 1);

  // Comparación con mes anterior — usa la moneda seleccionada
  const monthComparison = useMemo(() => {
    const now = new Date();
    const forMonth = (offset: number) => {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const md = debts.filter(x => {
        const dd = new Date(x.date);
        return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth()
          && (x.currency ?? 'ARS') === chartCurrency;
      });
      return md.reduce((s, x) => s + (x.direction === 'me_debe' ? x.amount : -x.amount), 0);
    };
    const thisMonth = forMonth(0);
    const lastMonth = forMonth(1);
    if (lastMonth === 0 && thisMonth === 0) return null;
    const pct = lastMonth === 0
      ? null
      : Math.round(((thisMonth - lastMonth) / Math.abs(lastMonth)) * 100);
    return { thisMonth, lastMonth, pct };
  }, [debts, chartCurrency]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.titleRow}>
          <Text style={styles.title}>Estadísticas</Text>
          <TouchableOpacity
            style={styles.shareIconBtn}
            onPress={() => setShowShare(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.shareIconText}>↑</Text>
          </TouchableOpacity>
        </View>

        {statsHint.visible && (
          <HintTooltip
            icon="📊"
            text="Tocá cualquier barra del gráfico para ver el desglose mes a mes. Si tenés varias monedas podés filtrar el gráfico con los chips."
            onDismiss={statsHint.dismiss}
            arrow="none"
          />
        )}

        {/* Resumen global */}
        <Animated.View style={sectionStyle(sec0)}>
          <Text style={styles.sectionLabel}>BALANCE PENDIENTE</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {netoByC.length === 0 ? (
              <Text style={[styles.empty, { color: theme.subtext }]}>Sin deudas pendientes</Text>
            ) : (
              netoByC.map(({ currency, net }) => (
                <View key={currency} style={styles.netRow}>
                  <Text style={[styles.netCurrency, { color: theme.subtext }]}>{CURRENCY_SYMBOLS[currency]} {currency}</Text>
                  <CountUpAmount
                    value={net}
                    currency={currency}
                    style={[styles.netAmount, { color: net >= 0 ? '#34C759' : '#F05B53' }]}
                  />
                </View>
              ))
            )}
            <View style={[styles.cardFooter, { borderTopColor: theme.border }]}>
              <Text style={[styles.footerStat, { color: theme.subtext }]}>{pendingDebts.length} pendientes</Text>
              <Text style={[styles.footerStat, { color: theme.subtext }]}>{paidDebts.length} saldadas</Text>
              <Text style={[styles.footerStat, { color: theme.subtext }]}>{persons.length} personas</Text>
            </View>
          </View>
        </Animated.View>

        {/* Gráfico de barras mensual */}
        <Animated.View style={sectionStyle(sec1)}>
        <Text style={styles.sectionLabel}>ACTIVIDAD MENSUAL ({chartCurrency})</Text>
        <View style={[styles.card, styles.chartCard, { backgroundColor: theme.card }]}>
          {/* Leyenda + selector de moneda en la misma fila */}
          <View style={styles.chartLegend}>
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
                    onPress={() => setChartCurrency(c)}
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
            {monthlyData.map((m, i) => (
              <View key={i} style={styles.barGroup}>
                <View style={styles.bars}>
                  <Animated.View style={[styles.bar, {
                    height: barProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.max((m.meDebe / maxMonthly) * 100, m.meDebe > 0 ? 4 : 0)],
                    }),
                    backgroundColor: '#34C759',
                  }]} />
                  <Animated.View style={[styles.bar, {
                    height: barProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, Math.max((m.leDebo / maxMonthly) * 100, m.leDebo > 0 ? 4 : 0)],
                    }),
                    backgroundColor: '#F05B53',
                  }]} />
                </View>
                <Text style={[styles.barLabel, { color: theme.subtext }]}>{m.label}</Text>
              </View>
            ))}
          </View>
          {monthComparison && (
            <View style={[styles.compareRow, { borderTopColor: theme.border }]}>
              <Text style={[styles.compareText, { color: theme.subtext }]}>
                {monthComparison.pct === null ? (
                  `Balance ${monthComparison.thisMonth >= 0 ? 'positivo' : 'negativo'} este mes en ${chartCurrency}`
                ) : monthComparison.pct === 0 ? (
                  `Sin cambios vs. mes anterior en ${chartCurrency}`
                ) : (
                  <>
                    <Text style={{ color: monthComparison.pct > 0 ? '#34C759' : '#F05B53', fontWeight: '700' }}>
                      {monthComparison.pct > 0 ? `+${monthComparison.pct}%` : `${monthComparison.pct}%`}
                    </Text>
                    {` vs. mes anterior en ${chartCurrency}`}
                  </>
                )}
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={() => navigation.navigate('ChartDetail')}
            activeOpacity={0.7}
          >
            <Text style={[styles.moreText, { color: theme.subtext }]}>Más detalles →</Text>
          </TouchableOpacity>
        </View>
        </Animated.View>

        {/* Top personas */}
        {topPersons.length > 0 && (
          <Animated.View style={sectionStyle(sec2)}>
            <Text style={styles.sectionLabel}>TOP PERSONAS (PENDIENTE)</Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {topPersons.map(({ person, net, count }, i) => (
                <TouchableOpacity
                  key={person.id}
                  activeOpacity={0.7}
                  onPress={() => navigation.navigate('PersonDetail', { personId: person.id })}
                >
                  {i > 0 && <View style={[styles.divider, { backgroundColor: theme.border }]} />}
                  <View style={styles.personRow}>
                    {person.avatarUrl ? (
                      <Image source={{ uri: person.avatarUrl }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: person.color }]}>
                        <Text style={styles.avatarText}>{person.avatar}</Text>
                      </View>
                    )}
                    <View style={styles.personInfo}>
                      <Text style={[styles.personName, { color: theme.text }]}>{person.name}</Text>
                      <Text style={[styles.personCount, { color: theme.subtext }]}>{count} deuda{count !== 1 ? 's' : ''}</Text>
                    </View>
                    <Text style={[styles.personNet, { color: net >= 0 ? '#34C759' : '#F05B53' }]}>
                      {net >= 0 ? '+' : ''}{formatAmountCurrency(Math.abs(net), 'ARS')}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <ShareStatsModal visible={showShare} onClose={() => setShowShare(false)} />
    </SafeAreaView>
  );
}

function createStyles(t: { bg: string; card: string; text: string; subtext: string; border: string; isDark: boolean }) {
  return StyleSheet.create({
    safe: { flex: 1 },
    scroll: { paddingHorizontal: 16, paddingBottom: 16 },
    titleRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginTop: 12, marginBottom: 20,
    },
    title: { fontSize: 28, fontWeight: '800', color: t.text, letterSpacing: -0.5 },
    shareIconBtn: {
      width: 38, height: 38, borderRadius: 19,
      backgroundColor: t.isDark ? t.card : '#F0F0F5',
      alignItems: 'center', justifyContent: 'center',
    },
    shareIconText: { fontSize: 18, color: t.text, fontWeight: '600', marginTop: -2 },
    sectionLabel: {
      fontSize: 11, fontWeight: '700', color: t.subtext,
      letterSpacing: 1, marginBottom: 10, marginTop: 4,
    },
    card: {
      borderRadius: 16, marginBottom: 20,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    chartCard: { padding: 16 },
    empty: { fontSize: 15, textAlign: 'center', padding: 20 },
    netRow: {
      flexDirection: 'row', justifyContent: 'space-between',
      alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    },
    netCurrency: { fontSize: 15, fontWeight: '600' },
    netAmount: { fontSize: 18, fontWeight: '800' },
    cardFooter: {
      flexDirection: 'row', justifyContent: 'space-around',
      borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 12,
    },
    footerStat: { fontSize: 13, fontWeight: '500' },
    chartLegend: { flexDirection: 'row', gap: 12, marginBottom: 16, alignItems: 'center' },
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
    chart: { flexDirection: 'row', alignItems: 'flex-end', height: 120, gap: 6 },
    barGroup: { flex: 1, alignItems: 'center', gap: 6 },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 100 },
    bar: { width: 10, borderRadius: 3, minHeight: 0 },
    barLabel: { fontSize: 10, fontWeight: '500' },
    compareRow: {
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: 0, paddingTop: 10, marginTop: 10,
    },
    compareText: { fontSize: 12, lineHeight: 17 },
    moreBtn: { alignSelf: 'flex-end', marginTop: 12, paddingVertical: 4, paddingHorizontal: 2 },
    moreText: { fontSize: 13, fontWeight: '500' },
    divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
    personRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingVertical: 12, gap: 12,
    },
    avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontSize: 18 },
    personInfo: { flex: 1 },
    personName: { fontSize: 15, fontWeight: '600' },
    personCount: { fontSize: 12, marginTop: 2 },
    personNet: { fontSize: 15, fontWeight: '700' },
  });
}
