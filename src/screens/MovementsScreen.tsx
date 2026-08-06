import React, { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCostos } from '../context/CostosContext';
import { useTheme, Theme } from '../context/ThemeContext';
import { formatAmountCurrency, DIRECTION_COLORS, STATUS_COLORS, effectiveAmount } from '../utils';
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
  return [...map.entries()].map(([key, items]) => ({ key, header: formatGroupHeader(key), items }));
}

export function MovementsScreen({ navigation }: Props) {
  const { persons, debts } = useCostos();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeTab, setActiveTab] = useState<'all' | 'added' | 'paid' | 'partial'>('all');
  const tabFade = useRef(new Animated.Value(1)).current;

  function switchTab(tab: 'all' | 'added' | 'paid' | 'partial') {
    if (tab === activeTab) return;
    Animated.timing(tabFade, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setActiveTab(tab);
      Animated.timing(tabFade, { toValue: 1, duration: 190, useNativeDriver: true }).start();
    });
  }

  const personMap = useMemo(
    () => Object.fromEntries(persons.map(p => [p.id, p])),
    [persons],
  );

  // ── Conteos para badges en tabs ───────────────────────────────────────
  const addedCount   = debts.length;
  const paidCount    = debts.filter(d => d.status === 'pagado').length;
  const partialCount = debts.filter(d => (d.paidAmount ?? 0) > 0 && d.partialPaymentDate).length;

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

  // ── Eventos unificados ────────────────────────────────────────────────
  type UnifiedEvent = { key: string; type: 'added' | 'paid' | 'partial'; debt: Debt; date: string };
  const allEvents: UnifiedEvent[] = debts
    .flatMap(d => {
      const evs: UnifiedEvent[] = [];
      evs.push({ key: `a-${d.id}`, type: 'added', debt: d, date: d.date });
      if ((d.paidAmount ?? 0) > 0 && d.partialPaymentDate) {
        evs.push({ key: `partial-${d.id}`, type: 'partial', debt: d, date: d.partialPaymentDate });
      }
      if (d.status === 'pagado' && d.paidDate) {
        evs.push({ key: `p-${d.id}`, type: 'paid', debt: d, date: d.paidDate });
      }
      return evs;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const allGroups: { key: string; header: string; items: UnifiedEvent[] }[] = (() => {
    const map = new Map<string, UnifiedEvent[]>();
    allEvents.forEach(ev => {
      const key = ev.date.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return [...map.entries()].map(([key, items]) => ({ key, header: formatGroupHeader(key), items }));
  })();

  type PartialEvent = { debt: Debt; date: string };
  const partialEvents: PartialEvent[] = debts
    .filter(d => (d.paidAmount ?? 0) > 0 && d.partialPaymentDate)
    .map(d => ({ debt: d, date: d.partialPaymentDate! }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const partialGroups: { key: string; header: string; items: PartialEvent[] }[] = (() => {
    const map = new Map<string, PartialEvent[]>();
    partialEvents.forEach(ev => {
      const key = ev.date.split('T')[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(ev);
    });
    return [...map.entries()].map(([key, items]) => ({ key, header: formatGroupHeader(key), items }));
  })();

  const TABS: { key: 'all' | 'added' | 'paid' | 'partial'; label: string; count: number }[] = [
    { key: 'all',     label: 'Todos',    count: allEvents.length },
    { key: 'added',   label: 'Agregadas', count: addedCount },
    { key: 'paid',    label: 'Saldadas',  count: paidCount },
    { key: 'partial', label: 'Parciales', count: partialCount },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Movimientos</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Tabs con badges */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabsRow}>
        {TABS.map(({ key, label, count }) => (
          <TouchableOpacity
            key={key}
            onPress={() => switchTab(key)}
            style={[styles.tab, activeTab === key && styles.tabActive]}
            activeOpacity={0.75}
          >
            <Text style={[styles.tabText, activeTab === key && styles.tabTextActive]}>{label}</Text>
            {count > 0 && (
              <View style={[styles.tabBadge, activeTab === key && styles.tabBadgeActive]}>
                <Text style={[styles.tabBadgeText, activeTab === key && styles.tabBadgeTextActive]}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Animated.ScrollView style={[styles.scroll, { opacity: tabFade }]} showsVerticalScrollIndicator={false}>

        {/* ── Tab Todos ─────────────────────────────────────────────── */}
        {activeTab === 'all' && (
          allGroups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>Sin movimientos registrados</Text>
            </View>
          ) : (
            allGroups.map(({ key, header, items }) => (
              <View key={key}>
                <Text style={styles.dateHeader}>{header.toUpperCase()}</Text>
                {items.map(ev => {
                  const { debt } = ev;
                  const person = personMap[debt.personId];
                  if (!person) return null;
                  const debtCurrency = (debt.currency ?? 'ARS') as Currency;
                  const isPaid    = ev.type === 'paid';
                  const isPartial = ev.type === 'partial';
                  const dirColor  = DIRECTION_COLORS[debt.direction];
                  const indColor  = isPaid ? '#2ED573' : isPartial ? '#F59E0B' : dirColor;
                  const dirLabel  = debt.direction === 'me_debe' ? '→ me debe' : '← le debo';

                  if (isPartial) {
                    return (
                      <TouchableOpacity
                        key={ev.key}
                        style={styles.debtRow}
                        onPress={() => navigation.navigate('PersonDetail', { personId: person.id })}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.indicator, { backgroundColor: '#F59E0B' }]} />
                        <View style={styles.debtInfo}>
                          <View style={styles.personRow}>
                            {person.avatarUrl
                            ? <Image source={{ uri: person.avatarUrl }} style={styles.personDot} />
                            : <View style={[styles.personDot, { backgroundColor: person.color }]}><Text style={styles.personDotEmoji}>{person.avatar}</Text></View>
                          }
                            <Text style={styles.personName}>{person.name}</Text>
                          </View>
                          <Text style={styles.debtDesc}>{debt.description}</Text>
                          <View style={styles.badges}>
                            <View style={[styles.badge, { backgroundColor: '#F59E0B20' }]}>
                              <Text style={[styles.badgeText, { color: '#F59E0B' }]}>💰 pago parcial</Text>
                            </View>
                            {debt.status === 'pendiente' && (
                              <View style={[styles.badge, { backgroundColor: '#F05B5320' }]}>
                                <Text style={[styles.badgeText, { color: '#F05B53' }]}>
                                  resta {formatAmountCurrency(effectiveAmount(debt), debtCurrency)}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <View style={styles.amountCol}>
                          <Text style={[styles.amount, { color: '#F59E0B' }]}>
                            -{formatAmountCurrency(debt.paidAmount!, debtCurrency)}
                          </Text>
                          <Text style={styles.amountSub}>de {formatAmountCurrency(debt.amount, debtCurrency)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }

                  const hasPartial = (debt.paidAmount ?? 0) > 0 && !isPaid;
                  const displayAmt = hasPartial ? effectiveAmount(debt) : debt.amount;

                  return (
                    <TouchableOpacity
                      key={ev.key}
                      style={styles.debtRow}
                      onPress={() => navigation.navigate('PersonDetail', { personId: person.id })}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.indicator, { backgroundColor: indColor }]} />
                      <View style={styles.debtInfo}>
                        <View style={styles.personRow}>
                          {person.avatarUrl
                            ? <Image source={{ uri: person.avatarUrl }} style={styles.personDot} />
                            : <View style={[styles.personDot, { backgroundColor: person.color }]}><Text style={styles.personDotEmoji}>{person.avatar}</Text></View>
                          }
                          <Text style={styles.personName}>{person.name}</Text>
                        </View>
                        <Text style={[styles.debtDesc, isPaid && styles.strikethrough]}>{debt.description}</Text>
                        <View style={styles.badges}>
                          <View style={[styles.badge, { backgroundColor: dirColor + '18' }]}>
                            <Text style={[styles.badgeText, { color: dirColor }]}>{dirLabel}</Text>
                          </View>
                          <View style={[styles.badge, { backgroundColor: (isPaid ? '#2ED573' : '#F05B53') + '20' }]}>
                            <Text style={[styles.badgeText, { color: isPaid ? '#2ED573' : '#F05B53' }]}>
                              {isPaid ? 'saldada' : 'pendiente'}
                            </Text>
                          </View>
                        </View>
                      </View>
                      <View style={styles.amountCol}>
                        <Text style={[styles.amount, isPaid && styles.amountPaid]}>
                          {formatAmountCurrency(displayAmt, debtCurrency)}
                        </Text>
                        {hasPartial && (
                          <Text style={styles.amountSub}>de {formatAmountCurrency(debt.amount, debtCurrency)}</Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )
        )}

        {/* ── Tab Parciales ─────────────────────────────────────────── */}
        {activeTab === 'partial' && (
          partialGroups.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💰</Text>
              <Text style={styles.emptyText}>Sin pagos parciales registrados</Text>
            </View>
          ) : (
            partialGroups.map(({ key, header, items }) => (
              <View key={key}>
                <Text style={styles.dateHeader}>{header.toUpperCase()}</Text>
                {items.map(({ debt }) => {
                  const person = personMap[debt.personId];
                  if (!person) return null;
                  const debtCurrency = (debt.currency ?? 'ARS') as Currency;
                  const remaining = effectiveAmount(debt);
                  return (
                    <TouchableOpacity
                      key={`partial-${debt.id}`}
                      style={styles.debtRow}
                      onPress={() => navigation.navigate('PersonDetail', { personId: person.id })}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.indicator, { backgroundColor: '#F59E0B' }]} />
                      <View style={styles.debtInfo}>
                        <View style={styles.personRow}>
                          {person.avatarUrl
                            ? <Image source={{ uri: person.avatarUrl }} style={styles.personDot} />
                            : <View style={[styles.personDot, { backgroundColor: person.color }]}><Text style={styles.personDotEmoji}>{person.avatar}</Text></View>
                          }
                          <Text style={styles.personName}>{person.name}</Text>
                        </View>
                        <Text style={styles.debtDesc}>{debt.description}</Text>
                        <View style={styles.badges}>
                          <View style={[styles.badge, { backgroundColor: '#F59E0B20' }]}>
                            <Text style={[styles.badgeText, { color: '#F59E0B' }]}>💰 pago parcial</Text>
                          </View>
                          {debt.status === 'pendiente' && (
                            <View style={[styles.badge, { backgroundColor: '#F05B5320' }]}>
                              <Text style={[styles.badgeText, { color: '#F05B53' }]}>
                                resta {formatAmountCurrency(remaining, debtCurrency)}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.amountCol}>
                        <Text style={[styles.amount, { color: '#F59E0B' }]}>
                          -{formatAmountCurrency(debt.paidAmount!, debtCurrency)}
                        </Text>
                        <Text style={styles.amountSub}>de {formatAmountCurrency(debt.amount, debtCurrency)}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          )
        )}

        {/* ── Tabs Agregadas / Saldadas ─────────────────────────────── */}
        {activeTab !== 'partial' && activeTab !== 'all' && (() => {
          const groups = activeTab === 'added' ? addedGroups : paidGroups;
          return groups.length === 0 ? (
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
                  const hasPartial  = (debt.paidAmount ?? 0) > 0 && !isPaid;
                  const displayAmt  = hasPartial ? effectiveAmount(debt) : debt.amount;

                  return (
                    <TouchableOpacity
                      key={debt.id}
                      style={styles.debtRow}
                      onPress={() => navigation.navigate('PersonDetail', { personId: person.id })}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.indicator, { backgroundColor: dirColor }]} />
                      <View style={styles.debtInfo}>
                        <View style={styles.personRow}>
                          {person.avatarUrl
                            ? <Image source={{ uri: person.avatarUrl }} style={styles.personDot} />
                            : <View style={[styles.personDot, { backgroundColor: person.color }]}><Text style={styles.personDotEmoji}>{person.avatar}</Text></View>
                          }
                          <Text style={styles.personName}>{person.name}</Text>
                        </View>
                        <Text style={[styles.debtDesc, isPaid && styles.strikethrough]}>{debt.description}</Text>
                        <View style={styles.badges}>
                          <View style={[styles.badge, { backgroundColor: dirColor + '18' }]}>
                            <Text style={[styles.badgeText, { color: dirColor }]}>{dirLabel}</Text>
                          </View>
                          <View style={[styles.badge, { backgroundColor: statusColor + '20' }]}>
                            <Text style={[styles.badgeText, { color: statusColor }]}>{debt.status}</Text>
                          </View>
                          {hasPartial && (
                            <View style={[styles.badge, { backgroundColor: '#F59E0B20' }]}>
                              <Text style={[styles.badgeText, { color: '#F59E0B' }]}>pago parcial</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.amountCol}>
                        <Text style={[styles.amount, isPaid && styles.amountPaid]}>
                          {formatAmountCurrency(displayAmt, (debt.currency ?? 'ARS') as Currency)}
                        </Text>
                        {hasPartial && (
                          <Text style={styles.amountSub}>
                            de {formatAmountCurrency(debt.amount, (debt.currency ?? 'ARS') as Currency)}
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))
          );
        })()}

        <View style={{ height: 40 }} />
      </Animated.ScrollView>
    </SafeAreaView>
  );
}

function createStyles(t: Theme) {
  const tabActiveBg   = t.isDark ? t.text : '#1A1A2E';
  const tabActiveText = t.isDark ? t.bg   : '#FFFFFF';
  return StyleSheet.create({
    safe:        { flex: 1, backgroundColor: t.bg },
    header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
    backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backArrow:   { fontSize: 24, color: t.text },
    headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: t.text, textAlign: 'center' },

    tabsScroll: { flexGrow: 0, marginBottom: 16 },
    tabsRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
    tab: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1, borderColor: t.border,
    },
    tabActive:         { backgroundColor: tabActiveBg, borderColor: tabActiveBg },
    tabText:           { fontSize: 13, fontWeight: '600', color: t.subtext },
    tabTextActive:     { color: tabActiveText },
    tabBadge:          { backgroundColor: t.isDark ? '#2A3A52' : '#E8E8EE', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 },
    tabBadgeActive:    { backgroundColor: 'rgba(255,255,255,0.2)' },
    tabBadgeText:      { fontSize: 10, fontWeight: '700', color: t.subtext },
    tabBadgeTextActive:{ color: tabActiveText },

    scroll:     { flex: 1 },
    dateHeader: { fontSize: 11, fontWeight: '700', color: t.subtext, letterSpacing: 1, marginHorizontal: 16, marginTop: 4, marginBottom: 8 },
    debtRow: {
      backgroundColor: t.card, borderRadius: 12,
      marginHorizontal: 16, marginBottom: 8, padding: 14,
      flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    indicator:      { width: 4, borderRadius: 2, alignSelf: 'stretch', marginRight: 12, minHeight: 40 },
    debtInfo:       { flex: 1 },
    personRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    personDot:      { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    personDotEmoji: { fontSize: 11 },
    personName:     { fontSize: 13, fontWeight: '600', color: t.text },
    debtDesc:       { fontSize: 14, fontWeight: '500', color: t.text, marginBottom: 4 },
    strikethrough:  { textDecorationLine: 'line-through', color: t.subtext },
    badges:         { flexDirection: 'row', gap: 6 },
    badge:          { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    badgeText:      { fontSize: 10, fontWeight: '600' },
    amountCol:      { alignItems: 'flex-end', marginLeft: 8 },
    amount:         { fontSize: 15, fontWeight: '700', color: t.text },
    amountPaid:     { color: '#2ED573' },
    amountSub:      { fontSize: 10, color: t.subtext, marginTop: 2 },
    empty:          { alignItems: 'center', paddingTop: 80 },
    emptyIcon:      { fontSize: 48, marginBottom: 12 },
    emptyText:      { fontSize: 16, fontWeight: '600', color: t.subtext },
  });
}
