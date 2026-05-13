import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCostos } from '../context/CostosContext';
import { useTheme, Theme } from '../context/ThemeContext';
import { formatAmountCurrency, DIRECTION_COLORS, STATUS_COLORS, CURRENCY_NAMES } from '../utils';
import { PeriodFilter, Currency } from '../types';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

const MONTHS_ES  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MONTHS_CAP = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function filterByPeriod<T extends { date: string }>(list: T[], filter: PeriodFilter): T[] {
  if (filter.mode === 'total') return list;
  return list.filter(item => {
    const dt = new Date(item.date);
    return dt.getFullYear() === filter.year && dt.getMonth() === filter.month;
  });
}

function formatGroupHeader(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const suffix = new Date().getFullYear() !== y ? ` ${y}` : '';
  return `${d} de ${MONTHS_ES[m - 1]}${suffix}`;
}

function periodTitle(filter: PeriodFilter): string {
  return filter.mode === 'total'
    ? 'Todas las deudas'
    : `${MONTHS_CAP[filter.month]} ${filter.year}`;
}

export function HistoryScreen({ route, navigation }: Props) {
  const { persons, debts } = useCostos();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { filter, currency } = route.params;

  const personMap = Object.fromEntries(persons.map(p => [p.id, p]));

  let filtered = filterByPeriod(debts, filter)
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (currency) {
    filtered = filtered.filter(d => (d.currency ?? 'ARS') === currency);
  }

  const dateMap = new Map<string, typeof filtered>();
  filtered.forEach(d => {
    const key = d.date.split('T')[0];
    if (!dateMap.has(key)) dateMap.set(key, []);
    dateMap.get(key)!.push(d);
  });
  const groups = [...dateMap.entries()].map(([key, list]) => ({
    key,
    header: formatGroupHeader(key),
    debts: list,
  }));

  const pending = filtered.filter(d => d.status === 'pendiente').length;
  const paid    = filtered.filter(d => d.status === 'pagado').length;

  const currencyLabel = currency ? ` · ${CURRENCY_NAMES[currency]}` : '';

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.statsStrip}>
        <Text style={styles.periodLabel}>{periodTitle(filter)}{currencyLabel}</Text>
        <Text style={styles.statsText}>
          {filtered.length} total · {pending} pendientes · {paid} pagadas
        </Text>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Sin deudas en este periodo</Text>
          </View>
        ) : (
          groups.map(({ key, header, debts: groupDebts }) => (
            <View key={key}>
              <Text style={styles.dateHeader}>{header.toUpperCase()}</Text>
              {groupDebts.map(debt => {
                const person = personMap[debt.personId];
                if (!person) return null;
                const debtCurrency  = (debt.currency ?? 'ARS') as Currency;
                const dirColor      = DIRECTION_COLORS[debt.direction];
                const dirLabel      = debt.direction === 'me_debe' ? '→ me debe' : '← le debo';
                const statusColor   = STATUS_COLORS[debt.status];
                const isPaid        = debt.status === 'pagado';

                return (
                  <View key={debt.id} style={styles.debtRow}>
                    <View style={[styles.indicator, { backgroundColor: dirColor }]} />
                    <View style={styles.debtInfo}>
                      <View style={styles.personRow}>
                        <View style={[styles.personDot, { backgroundColor: person.color }]}>
                          <Text style={styles.personDotEmoji}>{person.avatar}</Text>
                        </View>
                        <Text style={styles.personName}>{person.name}</Text>
                      </View>
                      <Text style={[styles.debtDesc, isPaid && styles.strikethrough]}>
                        {debt.description}
                      </Text>
                      <View style={styles.badges}>
                        <View style={[styles.dirBadge, { backgroundColor: dirColor + '18' }]}>
                          <Text style={[styles.badgeText, { color: dirColor }]}>{dirLabel}</Text>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                          <Text style={[styles.badgeText, { color: statusColor }]}>{debt.status}</Text>
                        </View>
                        {!currency && debtCurrency !== 'ARS' && (
                          <View style={styles.currencyBadge}>
                            <Text style={styles.currencyBadgeText}>{debtCurrency}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.amount, isPaid && styles.amountPaid]}>
                      {formatAmountCurrency(debt.amount, debtCurrency)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backArrow: { fontSize: 24, color: t.text },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: t.text, textAlign: 'center' },
    statsStrip: {
      backgroundColor: t.isDark ? t.card : '#1A1A2E',
      marginHorizontal: 16,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      marginBottom: 16,
    },
    periodLabel: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginBottom: 2 },
    statsText: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
    scroll: { flex: 1 },
    dateHeader: {
      fontSize: 11, fontWeight: '700', color: t.subtext, letterSpacing: 1,
      marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    },
    debtRow: {
      backgroundColor: t.card, borderRadius: 12,
      marginHorizontal: 16, marginBottom: 8, padding: 14,
      flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    indicator: { width: 4, borderRadius: 2, alignSelf: 'stretch', marginRight: 12, minHeight: 40 },
    debtInfo: { flex: 1 },
    personRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    personDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    personDotEmoji: { fontSize: 11 },
    personName: { fontSize: 13, fontWeight: '600', color: t.text },
    debtDesc: { fontSize: 14, fontWeight: '500', color: t.text, marginBottom: 4 },
    strikethrough: { textDecorationLine: 'line-through', color: t.subtext },
    badges: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    dirBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    statusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    currencyBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: t.border },
    currencyBadgeText: { fontSize: 10, fontWeight: '600', color: t.subtext },
    badgeText: { fontSize: 10, fontWeight: '600' },
    amount: { fontSize: 15, fontWeight: '700', color: t.text, marginLeft: 8 },
    amountPaid: { color: t.subtext, textDecorationLine: 'line-through' },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 16, fontWeight: '600', color: t.subtext },
  });
}
