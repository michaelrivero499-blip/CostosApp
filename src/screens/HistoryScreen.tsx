import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, FlatList, TouchableWithoutFeedback, TextInput, Image,
} from 'react-native';
import { ShareHistoryModal } from '../components/ShareHistoryModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCostos } from '../context/CostosContext';
import { useTheme, Theme } from '../context/ThemeContext';
import { formatAmountCurrency, DIRECTION_COLORS, STATUS_COLORS, CURRENCY_ORDER, CURRENCY_SYMBOLS, effectiveAmount } from '../utils';
import { PeriodFilter, Currency } from '../types';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'History'>;

const MONTHS_ES    = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MONTHS_CAP   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const _cy = new Date().getFullYear();
const YEARS = Array.from({ length: _cy - 2023 + 3 }, (_, i) => 2023 + i);

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

function filterByPeriod<T extends { date: string }>(list: T[], filter: PeriodFilter): T[] {
  if (filter.mode === 'total') return list;
  return list.filter(item => {
    const dt = new Date(item.date);
    return dt.getFullYear() === filter.year && dt.getMonth() === filter.month;
  });
}

export function HistoryScreen({ route, navigation }: Props) {
  const { persons, debts } = useCostos();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [filter, setFilter]       = useState<PeriodFilter>(route.params.filter);
  const [currency, setCurrency]   = useState<Currency | undefined>(route.params.currency);
  const [showPicker, setShowPicker] = useState(false);
  const [showShare, setShowShare]   = useState(false);
  const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());
  const [searchQuery, setSearchQuery] = useState('');
  const yearListRef = useRef<FlatList<number>>(null);

  function scrollYearToCenter(year: number) {
    const idx = YEARS.indexOf(year);
    if (idx < 0) return;
    setTimeout(() => yearListRef.current?.scrollToIndex({ index: idx, viewPosition: 0.5, animated: false }), 80);
  }

  const personMap = useMemo(
    () => Object.fromEntries(persons.map(p => [p.id, p])),
    [persons],
  );

  const now = new Date();
  const isTotal      = filter.mode === 'total';
  const isThisMonth  = filter.mode === 'month' &&
    filter.year === now.getFullYear() && filter.month === now.getMonth();
  const isOtherMonth = filter.mode === 'month' && !isThisMonth;
  const otherChipLabel = isOtherMonth
    ? `${MONTHS_SHORT[(filter as { mode: 'month'; year: number; month: number }).month]} ${(filter as { mode: 'month'; year: number; month: number }).year}`
    : 'Otro mes';

  function selectTotal() {
    if (filter.mode !== 'total') { setFilter({ mode: 'total' }); setSearchQuery(''); }
  }
  function selectThisMonth() {
    const y = now.getFullYear(), m = now.getMonth();
    if (filter.mode !== 'month' || filter.year !== y || filter.month !== m) {
      setFilter({ mode: 'month', year: y, month: m }); setSearchQuery('');
    }
  }
  function openPicker() {
    const year = filter.mode === 'month' ? filter.year : new Date().getFullYear();
    if (filter.mode === 'month') { setPickerYear(filter.year); setPickerMonth(filter.month); }
    setShowPicker(true);
    scrollYearToCenter(year);
  }
  function confirmPicker() {
    setShowPicker(false);
    setFilter({ mode: 'month', year: pickerYear, month: pickerMonth });
    setSearchQuery('');
  }

  // ── Eventos ───────────────────────────────────────────────────────────
  type Event =
    | { type: 'debt';    date: string; debtId: string }
    | { type: 'partial'; date: string; debtId: string; amount: number }
    | { type: 'paid';    date: string; debtId: string };

  const events = useMemo((): Event[] => {
    const result: Event[] = [];
    debts.forEach(d => {
      result.push({ type: 'debt', date: d.date, debtId: d.id });
      if (d.paidAmount && d.paidAmount > 0 && d.partialPaymentDate) {
        result.push({ type: 'partial', date: d.partialPaymentDate, debtId: d.id, amount: d.paidAmount });
      }
    });
    return result;
  }, [debts]);

  // ── Filtrar por período, moneda y búsqueda ────────────────────────────
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = filterByPeriod(events, filter);
    if (currency) {
      list = list.filter(ev => {
        const d = debts.find(x => x.id === ev.debtId);
        return (d?.currency ?? 'ARS') === currency;
      });
    }
    if (q) {
      list = list.filter(ev => {
        const d    = debts.find(x => x.id === ev.debtId);
        const p    = d ? personMap[d.personId] : undefined;
        return (
          d?.description.toLowerCase().includes(q) ||
          p?.name.toLowerCase().includes(q)
        );
      });
    }
    return list.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [events, filter, currency, debts, searchQuery]);

  // ── Agrupar y aplanar para FlatList ──────────────────────────────────
  type ListItem =
    | { kind: 'header'; key: string; label: string }
    | { kind: 'event';  key: string; ev: Event };

  const flatItems = useMemo((): ListItem[] => {
    const dateMap = new Map<string, typeof filtered>();
    filtered.forEach(ev => {
      const dayKey = ev.date.split('T')[0];
      if (!dateMap.has(dayKey)) dateMap.set(dayKey, []);
      dateMap.get(dayKey)!.push(ev);
    });
    const result: ListItem[] = [];
    dateMap.forEach((evs, dayKey) => {
      result.push({ kind: 'header', key: `h-${dayKey}`, label: formatGroupHeader(dayKey).toUpperCase() });
      evs.forEach((ev, i) => {
        const evKey = ev.type === 'partial'
          ? `partial-${ev.debtId}-${i}`
          : `debt-${ev.debtId}-${i}`;
        result.push({ kind: 'event', key: evKey, ev });
      });
    });
    return result;
  }, [filtered]);

  // ── Conteos correctos (respetan filtro + moneda) ──────────────────────
  const filteredDebts = useMemo(() => {
    let list = filterByPeriod(debts.map(d => ({ ...d })), filter);
    if (currency) list = list.filter(d => (d.currency ?? 'ARS') === currency);
    return list;
  }, [debts, filter, currency]);
  const pendingCount = filteredDebts.filter(d => d.status === 'pendiente').length;
  const paidCount    = filteredDebts.filter(d => d.status === 'pagado').length;

  // ── Totales por moneda y dirección en el período ─────────────────────
  // Nunca mezclar monedas — siempre agrupar por currency
  const periodTotalsByCurrency = useMemo(() => {
    const pending = filteredDebts.filter(d => d.status === 'pendiente');
    const map = new Map<Currency, { meDeben: number; leDebo: number }>();
    pending.forEach(d => {
      const cur = (d.currency ?? 'ARS') as Currency;
      if (!map.has(cur)) map.set(cur, { meDeben: 0, leDebo: 0 });
      const entry = map.get(cur)!;
      const amt = effectiveAmount(d);
      if (d.direction === 'me_debe') entry.meDeben += amt;
      else entry.leDebo += amt;
    });
    // Mantener orden canónico de monedas
    const ordered = new Map<Currency, { meDeben: number; leDebo: number }>();
    CURRENCY_ORDER.forEach(c => { if (map.has(c)) ordered.set(c, map.get(c)!); });
    return ordered;
  }, [filteredDebts]);

  // ── Exportar período ──────────────────────────────────────────────────
  function handleExport() {
    setShowShare(true);
  }

  const isSearching = searchQuery.length > 0;

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.kind === 'header') {
      return <Text style={styles.dateHeader}>{item.label}</Text>;
    }

    const { ev } = item;
    const debt = debts.find(d => d.id === ev.debtId);
    if (!debt) return null;
    const person = personMap[debt.personId];
    if (!person) return null;
    const debtCurrency = (debt.currency ?? 'ARS') as Currency;

    if (ev.type === 'partial') {
      return (
        <TouchableOpacity
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
              <View style={[styles.dirBadge, { backgroundColor: '#F59E0B20' }]}>
                <Text style={[styles.badgeText, { color: '#F59E0B' }]}>💰 pago parcial</Text>
              </View>
              {debt.status === 'pendiente' && (
                <View style={[styles.dirBadge, { backgroundColor: '#F05B5320' }]}>
                  <Text style={[styles.badgeText, { color: '#F05B53' }]}>
                    resta {formatAmountCurrency(effectiveAmount(debt), debtCurrency)}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.amount, { color: '#F59E0B' }]}>
            -{formatAmountCurrency(ev.amount, debtCurrency)}
          </Text>
        </TouchableOpacity>
      );
    }

    const dirColor      = DIRECTION_COLORS[debt.direction];
    const dirLabel      = debt.direction === 'me_debe' ? '→ me debe' : '← le debo';
    const isPaid        = debt.status === 'pagado';
    const hasPartial    = (debt.paidAmount ?? 0) > 0 && !isPaid;
    const displayAmount = hasPartial ? effectiveAmount(debt) : debt.amount;

    return (
      <TouchableOpacity
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
            <View style={[styles.dirBadge, { backgroundColor: dirColor + '18' }]}>
              <Text style={[styles.badgeText, { color: dirColor }]}>{dirLabel}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[debt.status] + '20' }]}>
              <Text style={[styles.badgeText, { color: STATUS_COLORS[debt.status] }]}>{debt.status}</Text>
            </View>
            {!currency && debtCurrency !== 'ARS' && (
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyBadgeText}>{debtCurrency}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.amountCol}>
          <Text style={[styles.amount, isPaid && styles.amountPaid]}>
            {formatAmountCurrency(displayAmount, debtCurrency)}
          </Text>
          {hasPartial && (
            <Text style={styles.originalAmount}>
              de {formatAmountCurrency(debt.amount, debtCurrency)}
            </Text>
          )}
          <Text style={styles.tapHint}>Ver →</Text>
        </View>
      </TouchableOpacity>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debts, personMap, currency, styles, navigation]);

  return (
    <SafeAreaView style={styles.safe}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Historial</Text>
        <TouchableOpacity onPress={handleExport} style={styles.exportBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 18 }}>📤</Text>
        </TouchableOpacity>
      </View>

      {/* Strip de resumen */}
      <View style={styles.statsStrip}>
        <View style={{ flex: 1 }}>
          <Text style={styles.periodLabel}>{periodTitle(filter)}</Text>
          <Text style={styles.statsText}>
            {pendingCount} pendientes · {paidCount} saldadas
          </Text>
        </View>
        {periodTotalsByCurrency.size > 0 && (
          <View style={styles.statsRight}>
            {[...periodTotalsByCurrency.entries()].map(([cur, { meDeben, leDebo }]) => (
              <React.Fragment key={cur}>
                {meDeben > 0 && (
                  <Text style={styles.statsPill}>
                    ← {formatAmountCurrency(meDeben, cur)}
                  </Text>
                )}
                {leDebo > 0 && (
                  <Text style={[styles.statsPill, { color: '#F05B53' }]}>
                    → {formatAmountCurrency(leDebo, cur)}
                  </Text>
                )}
              </React.Fragment>
            ))}
          </View>
        )}
      </View>

      {/* Filtro de período */}
      <View style={styles.chipRow}>
        <TouchableOpacity style={[styles.chip, isTotal && styles.chipActive]} onPress={selectTotal} activeOpacity={0.7}>
          <Text style={[styles.chipText, { color: isTotal ? '#fff' : theme.subtext }]}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, isThisMonth && styles.chipActive]} onPress={selectThisMonth} activeOpacity={0.7}>
          <Text style={[styles.chipText, { color: isThisMonth ? '#fff' : theme.subtext }]}>Este mes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.chip, isOtherMonth && styles.chipActive]} onPress={openPicker} activeOpacity={0.7}>
          <Text style={[styles.chipText, { color: isOtherMonth ? '#fff' : theme.subtext }]}>{otherChipLabel}</Text>
        </TouchableOpacity>
      </View>

      {/* Filtro de moneda */}
      <View style={styles.currencyRow}>
        <TouchableOpacity style={[styles.currencyChip, !currency && styles.currencyChipActive]} onPress={() => setCurrency(undefined)} activeOpacity={0.7}>
          <Text style={[styles.currencyChipText, { color: !currency ? '#fff' : theme.subtext }]}>Todas</Text>
        </TouchableOpacity>
        {CURRENCY_ORDER.map(c => (
          <TouchableOpacity key={c} style={[styles.currencyChip, currency === c && styles.currencyChipActive]} onPress={() => setCurrency(c)} activeOpacity={0.7}>
            <Text style={[styles.currencyChipText, { color: currency === c ? '#fff' : theme.subtext }]}>
              {CURRENCY_SYMBOLS[c]} {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Barra de búsqueda */}
      <View style={[styles.searchBar, { backgroundColor: theme.isDark ? theme.card : '#F0F0F5' }]}>
        <Text style={{ fontSize: 13 }}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Buscar por persona o descripción..."
          placeholderTextColor={theme.subtext}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {isSearching && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={{ color: theme.subtext, fontSize: 12, fontWeight: '700' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      {isSearching && (
        <Text style={[styles.searchResult, { color: theme.subtext }]}>
          {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para "{searchQuery}"
        </Text>
      )}

      {/* Lista de eventos */}
      <FlatList
        style={styles.scroll}
        data={flatItems}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={10}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>{isSearching ? '🔍' : '📭'}</Text>
            <Text style={styles.emptyText}>
              {isSearching ? 'Sin resultados' : 'Sin movimientos en este período'}
            </Text>
          </View>
        }
        ListFooterComponent={<View style={{ height: 40 }} />}
      />

      {/* Modal de compartir */}
      <ShareHistoryModal
        visible={showShare}
        onClose={() => setShowShare(false)}
        periodLabel={`${periodTitle(filter)}${currency ? ` · ${currency}` : ''}`}
        filteredDebts={filteredDebts}
        periodTotalsByCurrency={periodTotalsByCurrency}
        pendingCount={pendingCount}
        paidCount={paidCount}
        personMap={personMap}
      />

      {/* Picker de mes */}
      <Modal visible={showPicker} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setShowPicker(false)}>
          <View style={styles.pickerOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.pickerCard}>
                <Text style={styles.pickerTitle}>Seleccionar periodo</Text>
                <FlatList
                  ref={yearListRef}
                  horizontal
                  data={YEARS}
                  keyExtractor={y => String(y)}
                  showsHorizontalScrollIndicator={false}
                  style={styles.yearScroll}
                  getItemLayout={(_, index) => ({ length: 60, offset: index * 68, index })}
                  ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
                  renderItem={({ item: y }) => (
                    <TouchableOpacity onPress={() => setPickerYear(y)} style={[styles.yearBtn, pickerYear === y && styles.yearBtnOn]}>
                      <Text style={[styles.yearBtnText, pickerYear === y && styles.yearBtnTextOn]}>{y}</Text>
                    </TouchableOpacity>
                  )}
                />
                {[[0,1,2,3],[4,5,6,7],[8,9,10,11]].map((row, ri) => (
                  <View key={ri} style={styles.monthRow}>
                    {row.map(i => (
                      <TouchableOpacity key={i} onPress={() => setPickerMonth(i)} style={[styles.monthBtn, pickerMonth === i && styles.monthBtnOn]}>
                        <Text style={[styles.monthBtnText, pickerMonth === i && styles.monthBtnTextOn]}>{MONTHS_SHORT[i]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
                <View style={styles.pickerActions}>
                  <TouchableOpacity onPress={() => setShowPicker(false)} style={styles.cancelBtn}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={confirmPicker} style={styles.confirmBtn}>
                    <Text style={styles.confirmText}>Confirmar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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
    backBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backArrow:  { fontSize: 24, color: t.text },
    headerTitle:{ flex: 1, fontSize: 18, fontWeight: '700', color: t.text, textAlign: 'center' },
    exportBtn:  { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },

    statsStrip: {
      backgroundColor: t.isDark ? t.card : '#1A1A2E',
      marginHorizontal: 16, borderRadius: 12,
      paddingHorizontal: 16, paddingVertical: 10, marginBottom: 10,
      flexDirection: 'row', alignItems: 'center',
    },
    periodLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '700', marginBottom: 2 },
    statsText:   { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
    statsRight:  { gap: 4, alignItems: 'flex-end' },
    statsPill:   { color: '#34C759', fontSize: 12, fontWeight: '700' },

    chipRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 8, marginBottom: 10 },
    chip: {
      paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
      backgroundColor: t.isDark ? t.card : '#F0F0F5',
    },
    chipActive: { backgroundColor: '#00C4A8' },
    chipText:   { fontSize: 12, fontWeight: '600' },

    currencyRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10, flexWrap: 'wrap' },
    currencyChip: {
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
      backgroundColor: t.isDark ? t.card : '#F0F0F5',
    },
    currencyChipActive: { backgroundColor: '#5E60CE' },
    currencyChipText:   { fontSize: 11, fontWeight: '600' },

    // Search
    searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 4 },
    searchInput: { flex: 1, fontSize: 14, padding: 0 },
    searchResult:{ fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginBottom: 8 },

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
    indicator:      { width: 4, borderRadius: 2, alignSelf: 'stretch', marginRight: 12, minHeight: 40 },
    debtInfo:       { flex: 1 },
    personRow:      { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    personDot:      { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    personDotEmoji: { fontSize: 11 },
    personName:     { fontSize: 13, fontWeight: '600', color: t.text },
    debtDesc:       { fontSize: 14, fontWeight: '500', color: t.text, marginBottom: 4 },
    strikethrough:  { textDecorationLine: 'line-through', color: t.subtext },
    badges:         { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    dirBadge:       { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    statusBadge:    { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    currencyBadge:  { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: t.border },
    currencyBadgeText: { fontSize: 10, fontWeight: '600', color: t.subtext },
    badgeText:      { fontSize: 10, fontWeight: '600' },
    amountCol:      { alignItems: 'flex-end', marginLeft: 8, gap: 2 },
    amount:         { fontSize: 15, fontWeight: '700', color: t.text },
    amountPaid:     { color: t.subtext, textDecorationLine: 'line-through' },
    originalAmount: { fontSize: 10, color: t.subtext },
    tapHint:        { fontSize: 10, color: t.subtext, marginTop: 2 },

    empty:     { alignItems: 'center', paddingTop: 80 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 16, fontWeight: '600', color: t.subtext },

    // Picker
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    pickerCard:    { backgroundColor: t.card, borderRadius: 20, padding: 24, width: '100%' },
    pickerTitle:   { fontSize: 17, fontWeight: '700', color: t.text, textAlign: 'center', marginBottom: 20 },
    yearScroll:    { marginBottom: 16 },
    yearBtn:       { width: 60, paddingVertical: 8, borderRadius: 20, backgroundColor: t.isDark ? t.bg : '#F5F5F5', alignItems: 'center' },
    yearBtnOn:     { backgroundColor: '#00C4A8' },
    yearBtnText:   { fontSize: 15, fontWeight: '600', color: t.subtext },
    yearBtnTextOn: { color: '#FFFFFF' },
    monthRow:      { flexDirection: 'row', gap: 8, marginBottom: 8 },
    monthBtn:      { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: t.isDark ? t.bg : '#F5F5F5', alignItems: 'center' },
    monthBtnOn:    { backgroundColor: '#00C4A8' },
    monthBtnText:  { fontSize: 13, fontWeight: '500', color: t.subtext },
    monthBtnTextOn:{ color: '#FFFFFF', fontWeight: '700' },
    pickerActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelBtn:     { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: t.isDark ? t.bg : '#F5F5F5', alignItems: 'center' },
    cancelText:    { fontSize: 15, fontWeight: '600', color: t.subtext },
    confirmBtn:    { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: '#00C4A8', alignItems: 'center' },
    confirmText:   { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  });
}
