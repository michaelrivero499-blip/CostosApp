import React, { useRef, useEffect, useState, useMemo } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { formatAmountCurrency, CURRENCY_ORDER, CURRENCY_SYMBOLS, CURRENCY_NAMES } from '../utils';
import { Debt, PeriodFilter, Currency } from '../types';
import { useTheme, Theme } from '../context/ThemeContext';

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTHS_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const YEARS = [2024, 2025, 2026];

interface Props {
  debts: Debt[];
  currency: Currency;
  onCurrencyChange: (c: Currency) => void;
  filter: PeriodFilter;
  onFilterChange: (f: PeriodFilter) => void;
}

function getActiveCurrencies(debts: Debt[]): Currency[] {
  return CURRENCY_ORDER.filter(c =>
    debts.some(d => d.status === 'pendiente' && (d.currency ?? 'ARS') === c)
  );
}

function filterDebts(debts: Debt[], currency: Currency, filter: PeriodFilter): Debt[] {
  let list = debts.filter(d => (d.currency ?? 'ARS') === currency);
  if (filter.mode === 'month') {
    list = list.filter(d => {
      const dt = new Date(d.date);
      return dt.getFullYear() === filter.year && dt.getMonth() === filter.month;
    });
  }
  return list;
}

function computeStats(debts: Debt[], currency: Currency, filter: PeriodFilter) {
  const list    = filterDebts(debts, currency, filter);
  const pending = list.filter(d => d.status === 'pendiente');
  const paid    = list.filter(d => d.status === 'pagado');
  const net     = pending.reduce((s, d) => s + (d.direction === 'me_debe' ? d.amount : -d.amount), 0);
  const personCount = new Set(list.map(d => d.personId)).size;
  return { net, total: list.length, pending: pending.length, paid: paid.length, personCount };
}

function cardTitle(currency: Currency, filter: PeriodFilter): string {
  const period = filter.mode === 'total' ? 'Total' : `${MONTHS_SHORT[filter.month]} ${filter.year}`;
  return `${CURRENCY_NAMES[currency]} · ${period}`;
}

export function SummaryCard({ debts, currency, onCurrencyChange, filter, onFilterChange }: Props) {
  const { theme } = useTheme();
  const pickerStyles = useMemo(() => createPickerStyles(theme), [theme]);

  const [showPicker, setShowPicker]   = useState(false);
  const [pickerYear, setPickerYear]   = useState(new Date().getFullYear());
  const [pickerMonth, setPickerMonth] = useState(new Date().getMonth());

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const [displayed, setDisplayed] = useState({ currency, filter });
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return; }
    Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
      setDisplayed({ currency, filter });
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    });
  }, [currency, filter]);

  const stats = computeStats(debts, displayed.currency, displayed.filter);
  const activeCurrencies = getActiveCurrencies(debts);
  const showCurrencyChips = activeCurrencies.length >= 2 ||
    (activeCurrencies.length === 1 && !activeCurrencies.includes(currency));

  const now           = new Date();
  const isTotal       = filter.mode === 'total';
  const isThisMonth   = filter.mode === 'month' &&
    filter.year === now.getFullYear() && filter.month === now.getMonth();
  const isOtherMonth  = filter.mode === 'month' && !isThisMonth;

  const otherChipLabel = isOtherMonth
    ? `${MONTHS_SHORT[(filter as { mode: 'month'; year: number; month: number }).month]} ${(filter as { mode: 'month'; year: number; month: number }).year}`
    : 'Otro mes';

  const statsLine = [
    `${stats.personCount} ${stats.personCount === 1 ? 'persona' : 'personas'}`,
    `${stats.total} ${stats.total === 1 ? 'deuda' : 'deudas'}`,
    `${stats.pending} pendientes`,
  ].join(' · ');

  function selectTotal() {
    if (filter.mode !== 'total') onFilterChange({ mode: 'total' });
  }

  function selectThisMonth() {
    const y = now.getFullYear(), m = now.getMonth();
    if (filter.mode !== 'month' || filter.year !== y || filter.month !== m) {
      onFilterChange({ mode: 'month', year: y, month: m });
    }
  }

  function openPicker() {
    if (filter.mode === 'month') {
      setPickerYear(filter.year);
      setPickerMonth(filter.month);
    }
    setShowPicker(true);
  }

  function confirmPicker() {
    setShowPicker(false);
    onFilterChange({ mode: 'month', year: pickerYear, month: pickerMonth });
  }

  return (
    <View style={styles.card}>
      <Animated.View style={{ opacity: fadeAnim }}>
        <View style={styles.topRow}>
          <Text style={styles.cardTitle}>{cardTitle(displayed.currency, displayed.filter)}</Text>
          <Text style={styles.statsText} numberOfLines={1}>{statsLine}</Text>
        </View>
        <Text style={styles.amount}>
          {formatAmountCurrency(stats.net, displayed.currency)}
        </Text>
      </Animated.View>

      {showCurrencyChips && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chipsRow}
        >
          {activeCurrencies.map(c => (
            <TouchableOpacity
              key={c}
              onPress={() => onCurrencyChange(c)}
              style={[styles.chip, currency === c && styles.chipActive]}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, currency === c && styles.chipTextActive]}>
                {CURRENCY_SYMBOLS[c]} {c}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <View style={[styles.chipsRow, showCurrencyChips && styles.periodRowGap]}>
        <TouchableOpacity
          onPress={selectTotal}
          style={[styles.chip, styles.chipSmall, isTotal && styles.chipActive]}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipText, styles.chipTextSmall, isTotal && styles.chipTextActive]}>Total</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={selectThisMonth}
          style={[styles.chip, styles.chipSmall, isThisMonth && styles.chipActive]}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipText, styles.chipTextSmall, isThisMonth && styles.chipTextActive]}>Este mes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={openPicker}
          style={[styles.chip, styles.chipSmall, isOtherMonth && styles.chipActive]}
          activeOpacity={0.75}
        >
          <Text style={[styles.chipText, styles.chipTextSmall, isOtherMonth && styles.chipTextActive]}>{otherChipLabel}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showPicker} transparent animationType="fade">
        <View style={pickerStyles.overlay}>
          <View style={pickerStyles.pickerCard}>
            <Text style={pickerStyles.pickerTitle}>Seleccionar periodo</Text>

            <View style={pickerStyles.yearRow}>
              {YEARS.map(y => (
                <TouchableOpacity
                  key={y}
                  onPress={() => setPickerYear(y)}
                  style={[pickerStyles.yearBtn, pickerYear === y && pickerStyles.yearBtnOn]}
                >
                  <Text style={[pickerStyles.yearBtnText, pickerYear === y && pickerStyles.yearBtnTextOn]}>{y}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {[[0,1,2,3],[4,5,6,7],[8,9,10,11]].map((row, ri) => (
              <View key={ri} style={pickerStyles.monthRow}>
                {row.map(i => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setPickerMonth(i)}
                    style={[pickerStyles.monthBtn, pickerMonth === i && pickerStyles.monthBtnOn]}
                  >
                    <Text style={[pickerStyles.monthBtnText, pickerMonth === i && pickerStyles.monthBtnTextOn]}>
                      {MONTHS_SHORT[i]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            <View style={pickerStyles.pickerActions}>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={pickerStyles.cancelBtn}>
                <Text style={pickerStyles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmPicker} style={pickerStyles.confirmBtn}>
                <Text style={pickerStyles.confirmText}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// The card is always dark (hero card design) — static styles
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1A2E',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  cardTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
  },
  statsText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    textAlign: 'right',
    flexShrink: 1,
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
    marginBottom: 16,
  },
  chipsScroll: { marginBottom: 8 },
  chipsRow: { flexDirection: 'row', gap: 8 },
  periodRowGap: { marginTop: 0 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  chipSmall: { paddingHorizontal: 11, paddingVertical: 5 },
  chipActive: { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  chipTextSmall: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.45)' },
  chipTextActive: { color: '#1A1A2E' },
});

function createPickerStyles(t: Theme) {
  const btnBg     = t.isDark ? t.bg : '#F5F5F5';
  const activeBg  = t.isDark ? t.text : '#1A1A2E';
  const activeText = t.isDark ? t.bg : '#FFFFFF';
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    pickerCard: {
      backgroundColor: t.card,
      borderRadius: 20,
      padding: 24,
      width: '100%',
    },
    pickerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: t.text,
      textAlign: 'center',
      marginBottom: 20,
    },
    yearRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 16 },
    yearBtn: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, backgroundColor: btnBg },
    yearBtnOn: { backgroundColor: activeBg },
    yearBtnText: { fontSize: 15, fontWeight: '600', color: t.subtext },
    yearBtnTextOn: { color: activeText },
    monthRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    monthBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: btnBg, alignItems: 'center' },
    monthBtnOn: { backgroundColor: activeBg },
    monthBtnText: { fontSize: 13, fontWeight: '500', color: t.subtext },
    monthBtnTextOn: { color: activeText, fontWeight: '700' },
    pickerActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
    cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: btnBg, alignItems: 'center' },
    cancelText: { fontSize: 15, fontWeight: '600', color: t.subtext },
    confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: activeBg, alignItems: 'center' },
    confirmText: { fontSize: 15, fontWeight: '700', color: activeText },
  });
}
