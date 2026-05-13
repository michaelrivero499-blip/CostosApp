import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCostos } from '../context/CostosContext';
import { useTheme, Theme } from '../context/ThemeContext';
import { formatAmountCurrency, DIRECTION_COLORS, STATUS_COLORS } from '../utils';
import { Debt, Currency } from '../types';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Movements'>;

const MONTHS_ES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];

function formatGroupHeader(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const suffix = new Date().getFullYear() !== y ? ` ${y}` : '';
  return `${d} de ${MONTHS_ES[m - 1]}${suffix}`;
}

function groupDebts(
  sorted: Debt[],
  getKey: (d: Debt) => string,
): { key: string; header: string; items: Debt[] }[] {
  const map = new Map<string, Debt[]>();
  sorted.forEach(d => {
    const key = getKey(d).split('T')[0];
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  });
  return [...map.entries()].map(([key, items]) => ({
    key,
    header: formatGroupHeader(key),
    items,
  }));
}

export function MovementsScreen({ navigation }: Props) {
  const { persons, debts } = useCostos();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeTab, setActiveTab] = useState<'added' | 'paid'>('added');

  const personMap = Object.fromEntries(persons.map(p => [p.id, p]));

  const addedGroups = groupDebts(
    [...debts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    d => d.date,
  );

  const paidGroups = groupDebts(
    debts
      .filter(d => d.status === 'pagado')
      .sort((a, b) => {
        const ta = new Date(a.paidDate ?? a.date).getTime();
        const tb = new Date(b.paidDate ?? b.date).getTime();
        return tb - ta;
      }),
    d => d.paidDate ?? d.date,
  );

  const groups = activeTab === 'added' ? addedGroups : paidGroups;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Movimientos</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.tabsRow}>
        <TouchableOpacity
          onPress={() => setActiveTab('added')}
          style={[styles.tab, activeTab === 'added' && styles.tabActive]}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'added' && styles.tabTextActive]}>
            Agregadas
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('paid')}
          style={[styles.tab, activeTab === 'paid' && styles.tabActive]}
          activeOpacity={0.75}
        >
          <Text style={[styles.tabText, activeTab === 'paid' && styles.tabTextActive]}>
            Saldadas
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{activeTab === 'added' ? '📋' : '✅'}</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'added' ? 'Sin deudas registradas' : 'Sin deudas saldadas'}
            </Text>
          </View>
        ) : (
          groups.map(({ key, header, items }) => (
            <View key={key}>
              <Text style={styles.dateHeader}>{header.toUpperCase()}</Text>
              {items.map(debt => {
                const person = personMap[debt.personId];
                if (!person) return null;
                const dirColor    = DIRECTION_COLORS[debt.direction];
                const dirLabel    = debt.direction === 'me_debe' ? '→ me debe' : '← le debo';
                const statusColor = STATUS_COLORS[debt.status];
                const isPaid      = debt.status === 'pagado';

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
                        <View style={[styles.badge, { backgroundColor: dirColor + '18' }]}>
                          <Text style={[styles.badgeText, { color: dirColor }]}>{dirLabel}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
                          <Text style={[styles.badgeText, { color: statusColor }]}>{debt.status}</Text>
                        </View>
                      </View>
                    </View>
                    <Text style={[styles.amount, isPaid && styles.amountPaid]}>
                      {formatAmountCurrency(debt.amount, (debt.currency ?? 'ARS') as Currency)}
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
  const tabActiveBg   = t.isDark ? t.text : '#1A1A2E';
  const tabActiveText = t.isDark ? t.bg   : '#FFFFFF';
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 8,
    },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backArrow: { fontSize: 24, color: t.text },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: t.text, textAlign: 'center' },
    tabsRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 16 },
    tab: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: t.border,
    },
    tabActive: { backgroundColor: tabActiveBg, borderColor: tabActiveBg },
    tabText: { fontSize: 13, fontWeight: '600', color: t.subtext },
    tabTextActive: { color: tabActiveText },
    scroll: { flex: 1 },
    dateHeader: {
      fontSize: 11, fontWeight: '700', color: t.subtext, letterSpacing: 1,
      marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    },
    debtRow: {
      backgroundColor: t.card,
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    indicator: { width: 4, borderRadius: 2, alignSelf: 'stretch', marginRight: 12, minHeight: 40 },
    debtInfo: { flex: 1 },
    personRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    personDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    personDotEmoji: { fontSize: 11 },
    personName: { fontSize: 13, fontWeight: '600', color: t.text },
    debtDesc: { fontSize: 14, fontWeight: '500', color: t.text, marginBottom: 4 },
    strikethrough: { textDecorationLine: 'line-through', color: t.subtext },
    badges: { flexDirection: 'row', gap: 6 },
    badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText: { fontSize: 10, fontWeight: '600' },
    amount: { fontSize: 15, fontWeight: '700', color: t.text, marginLeft: 8 },
    amountPaid: { color: '#2ED573' },
    empty: { alignItems: 'center', paddingTop: 80 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 16, fontWeight: '600', color: t.subtext },
  });
}
