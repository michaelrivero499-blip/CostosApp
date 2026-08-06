/**
 * SummaryCard — inspirado en MonAi
 *
 * • Número enorme + símbolo superíndice
 * • Chips con long-press + slide (PanResponder con capture)
 * • El menú NO se renderiza aquí — se delega al padre vía onMenuOpen/onMenuClose
 *   para evitar el clipping de ScrollView y los problemas de transparencia de Modal en Android
 */
import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  View, Text, StyleSheet, Animated,
  PanResponder, Modal, FlatList,
  TouchableWithoutFeedback, TouchableOpacity,
} from 'react-native';
import {
  CURRENCY_ORDER, CURRENCY_SYMBOLS, CURRENCY_NAMES,
  effectiveAmount,
} from '../utils';
import { Debt, PeriodFilter, Currency } from '../types';
import { useTheme, Theme } from '../context/ThemeContext';

// ── Constantes ────────────────────────────────────────────────────────────────
const C_RED  = '#F05B53';  // semántico: neto negativo
const C_TEAL = '#00C4A8';  // selección activa
const C_PUR  = '#7B7FE8';

const MES   = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const _CY   = new Date().getFullYear();
const YEARS = Array.from({ length: _CY - 2023 + 3 }, (_, i) => 2023 + i);

export const SUMMARY_ITEM_H = 38;  // exportado para que HomeScreen calcule hover en slide

// ── Tipos públicos ────────────────────────────────────────────────────────────
export interface SummaryMenuConfig {
  opts:      Array<{ label: string }>;
  activeIdx: number;
  x:         number;   // coordenadas de pantalla del chip
  y:         number;
}

// ── helpers ───────────────────────────────────────────────────────────────────
function filterDebts(debts: Debt[], cur: Currency, f: PeriodFilter) {
  let l = debts.filter(d => (d.currency ?? 'ARS') === cur);
  if (f.mode === 'month')
    l = l.filter(d => {
      const dt = new Date(d.date);
      return dt.getFullYear() === f.year && dt.getMonth() === f.month;
    });
  return l;
}

function getStats(debts: Debt[], cur: Currency, f: PeriodFilter) {
  const list    = filterDebts(debts, cur, f);
  const pending = list.filter(d => d.status === 'pendiente');
  const paid    = list.filter(d => d.status === 'pagado');
  const meDeben = pending.filter(d => d.direction === 'me_debe').reduce((s, d) => s + effectiveAmount(d), 0);
  const leDebo  = pending.filter(d => d.direction === 'le_debo').reduce((s, d) => s + effectiveAmount(d), 0);
  return { net: meDeben - leDebo, pending: pending.length, paid: paid.length };
}

function activeCurrencies(debts: Debt[]) {
  return CURRENCY_ORDER.filter(c =>
    debts.some(d => d.status === 'pendiente' && (d.currency ?? 'ARS') === c),
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
type MenuKind = 'period' | 'currency';

interface Props {
  debts:            Debt[];
  currency:         Currency;
  onCurrencyChange: (c: Currency) => void;
  filter:           PeriodFilter;
  onFilterChange:   (f: PeriodFilter) => void;
  // Delegados al padre (HomeScreen) para evitar Modal/clipping:
  onMenuOpen:  (kind: MenuKind, cfg: SummaryMenuConfig, pick: (i: number) => void) => void;
  onMenuHover: (idx: number) => void;
  onMenuClose: () => void;
  activeMenu:  MenuKind | null;   // el padre nos dice qué menú está abierto (para highlight del chip)
}

// ── Componente ────────────────────────────────────────────────────────────────
export function SummaryCard({
  debts, currency, onCurrencyChange,
  filter, onFilterChange,
  onMenuOpen, onMenuHover, onMenuClose,
  activeMenu,
}: Props) {
  const { theme } = useTheme();
  const S = useMemo(() => makeStyles(theme), [theme]);

  const now  = useMemo(() => new Date(), []);
  const isTM = filter.mode === 'month'
    && filter.year  === now.getFullYear()
    && filter.month === now.getMonth();

  // ── selector de mes ───────────────────────────────────────────────────────
  const [picker, setPicker] = useState(false);
  const [pYear,  setPYear]  = useState(now.getFullYear());
  const [pMonth, setPMonth] = useState(now.getMonth());

  // ── fade al cambiar filtro/moneda ─────────────────────────────────────────
  const fade     = useRef(new Animated.Value(1)).current;
  const [disp,   setDisp]   = useState({ currency, filter });
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    Animated.timing(fade, { toValue: 0, duration: 110, useNativeDriver: true }).start(() => {
      setDisp({ currency, filter });
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  }, [currency, filter]);

  const stats = useMemo(() => getStats(debts, disp.currency, disp.filter), [debts, disp]);
  const curList: Currency[] = useMemo(() => {
    const ac = activeCurrencies(debts);
    return ac.length > 0 ? ac : ['ARS'];
  }, [debts]);

  const netColor = stats.net > 0 ? '#34C759'   // verde — te deben más (positivo)
    : stats.net < 0 ? C_RED                    // rojo  — le debés más (negativo)
    : theme.isDark ? 'rgba(255,255,255,0.85)' : '#111';

  // ── opciones de menú ──────────────────────────────────────────────────────
  const periodOpts = [
    { label: 'Total' },
    { label: 'Este mes' },
    { label: 'Otro mes...' },
  ];
  const periodIdx = filter.mode === 'total' ? 0 : isTM ? 1 : 2;

  const currencyOpts = curList.map(c => ({
    label: `${CURRENCY_SYMBOLS[c]}  ${CURRENCY_NAMES[c]}`,
  }));
  const currencyIdx = Math.max(0, curList.indexOf(currency));

  const periodLabel = filter.mode === 'total' ? 'Total'
    : isTM ? 'Este mes'
    : filter.mode === 'month' ? `${MES[filter.month]} ${filter.year}` : 'Total';

  // ── pick: aplica la selección ─────────────────────────────────────────────
  // Devuelve la función pick para el menú indicado (se pasa al padre vía onMenuOpen)
  function makePick(kind: MenuKind) {
    return (idx: number) => {
      onMenuClose();
      if (kind === 'period') {
        if (idx === 0) onFilterChange({ mode: 'total' });
        else if (idx === 1) onFilterChange({ mode: 'month', year: now.getFullYear(), month: now.getMonth() });
        else setTimeout(() => setPicker(true), 150);
      } else {
        onCurrencyChange(curList[idx]);
      }
    };
  }

  // Refs a las funciones para evitar stale closures en PanResponder
  const onMenuOpenFn  = useRef(onMenuOpen);
  const onMenuHoverFn = useRef(onMenuHover);
  const onMenuCloseFn = useRef(onMenuClose);
  const activeMenuRef = useRef(activeMenu);
  onMenuOpenFn.current  = onMenuOpen;
  onMenuHoverFn.current = onMenuHover;
  onMenuCloseFn.current = onMenuClose;
  activeMenuRef.current = activeMenu;

  // ── refs a los chips para measure() ──────────────────────────────────────
  const periodChipRef   = useRef<View>(null);
  const currencyChipRef = useRef<View>(null);

  const LP_MS = 320;

  // ── PanResponder por chip ─────────────────────────────────────────────────
  function useChipPan(
    kind: MenuKind,
    activeIdx: number,
    optsLen: number,
    chipRef: React.RefObject<View | null>,
    getOpts: () => Array<{ label: string }>,
  ) {
    const kindR    = useRef(kind);
    const activeR  = useRef(activeIdx);
    const optsLenR = useRef(optsLen);
    const openR    = useRef(false);
    const hovR     = useRef(activeIdx);
    const timerR   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tappedR  = useRef(false);

    useEffect(() => { kindR.current    = kind;      }, [kind]);
    useEffect(() => { activeR.current  = activeIdx; }, [activeIdx]);
    useEffect(() => { optsLenR.current = optsLen;   }, [optsLen]);

    function openAt(ref: React.RefObject<View | null>) {
      ref.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
        hovR.current = activeR.current;
        onMenuOpenFn.current(
          kindR.current,
          { opts: getOpts(), activeIdx: activeR.current, x: pageX, y: pageY },
          makePick(kindR.current),
        );
      });
    }

    return useRef(PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture:  () => openR.current,

      onPanResponderGrant: () => {
        tappedR.current = true;
        timerR.current  = setTimeout(() => {
          tappedR.current = false;
          openR.current   = true;
          openAt(chipRef);
        }, LP_MS);
      },

      onPanResponderMove: (_, { dy, dx }) => {
        if (Math.abs(dy) > 6 || Math.abs(dx) > 6) tappedR.current = false;
        if (!openR.current) return;
        const raw = activeR.current + Math.round(dy / SUMMARY_ITEM_H);
        const cl  = Math.max(0, Math.min(raw, optsLenR.current - 1));
        if (cl !== hovR.current) {
          hovR.current = cl;
          onMenuHoverFn.current(cl);
        }
      },

      onPanResponderRelease: () => {
        if (timerR.current) clearTimeout(timerR.current);
        if (openR.current) {
          openR.current = false;
          // La selección ya se hizo vía hovR — el padre llama pick(hovR) en onRelease
          // Aquí simplemente notificamos el release
          onMenuHoverFn.current(-1); // -1 = release signal → el padre llama pick
        } else if (tappedR.current) {
          tappedR.current = false;
          if (activeMenuRef.current === kindR.current) {
            onMenuCloseFn.current();
          } else {
            openAt(chipRef);
          }
        }
      },

      onPanResponderTerminate: () => {
        if (timerR.current) clearTimeout(timerR.current);
        openR.current = false;
        onMenuCloseFn.current();
      },
    })).current;
  }

  const periodPan   = useChipPan('period',   periodIdx,   periodOpts.length,   periodChipRef,   () => periodOpts);
  const currencyPan = useChipPan('currency', currencyIdx, currencyOpts.length, currencyChipRef, () => currencyOpts);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <View style={S.wrap}>

      {/* ═══ Número principal ═══ */}
      <Animated.View style={{ opacity: fade, flexDirection: 'row', alignItems: 'flex-start', marginBottom: 2 }}>
        <Text style={[S.sym, { color: theme.isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)' }]}>{CURRENCY_SYMBOLS[disp.currency]}</Text>
        <Text style={[S.digits, { color: netColor }]} numberOfLines={1} adjustsFontSizeToFit>
          {Math.abs(stats.net).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')}
        </Text>
      </Animated.View>

      {/* ═══ Dirección ═══ */}
      <Animated.Text style={[S.dir, { color: netColor, opacity: Animated.multiply(fade, 0.70) }]}>
        {stats.net > 0 ? '↑ a favor'
          : stats.net < 0 ? '↓ en contra'
          : stats.pending > 0 ? '≈ balanceado' : '✓ al día'}
      </Animated.Text>

      {/* ═══ Resumen ═══ */}
      {(stats.pending > 0 || stats.paid > 0) && (
        <Text style={S.stats}>
          {[
            stats.pending > 0 && `${stats.pending} activa${stats.pending !== 1 ? 's' : ''}`,
            stats.paid    > 0 && `${stats.paid} saldada${stats.paid !== 1 ? 's' : ''}`,
          ].filter(Boolean).join(' · ')}
        </Text>
      )}

      {/* ═══ Chips ═══ */}
      <View style={S.chips}>

        <View ref={periodChipRef} collapsable={false}>
          <Animated.View {...periodPan.panHandlers} style={[S.chip, activeMenu === 'period' && S.chipOn]}>
            <Text style={[S.chipTxt, activeMenu === 'period' && S.chipTxtOn]}>{periodLabel}</Text>
            <Text style={S.chipArr}>{activeMenu === 'period' ? ' ▲' : ' ▼'}</Text>
          </Animated.View>
        </View>

        {curList.length > 1 && (
          <View ref={currencyChipRef} collapsable={false}>
            <Animated.View {...currencyPan.panHandlers} style={[S.chip, activeMenu === 'currency' && S.chipOn]}>
              <Text style={[S.chipTxt, activeMenu === 'currency' && S.chipTxtOn]}>
                {CURRENCY_SYMBOLS[currency]} {currency}
              </Text>
              <Text style={S.chipArr}>{activeMenu === 'currency' ? ' ▲' : ' ▼'}</Text>
            </Animated.View>
          </View>
        )}
      </View>

      {/* ═══ Modal selector de mes ═══ */}
      <Modal visible={picker} transparent animationType="fade" onRequestClose={() => setPicker(false)}>
        <TouchableWithoutFeedback onPress={() => setPicker(false)}>
          <View style={P.overlay}>
            <TouchableWithoutFeedback>
              <View style={[P.sheet, { backgroundColor: theme.card }]}>
                <Text style={[P.title, { color: theme.text }]}>Seleccionar mes</Text>
                <FlatList
                  data={YEARS} horizontal showsHorizontalScrollIndicator={false}
                  keyExtractor={y => String(y)}
                  contentContainerStyle={{ gap: 8, paddingHorizontal: 4, marginBottom: 16 }}
                  renderItem={({ item: y }) => (
                    <TouchableOpacity onPress={() => setPYear(y)}
                      style={[P.yChip, { backgroundColor: theme.isDark ? theme.bg : '#F0F0F5' }, pYear === y && { backgroundColor: C_TEAL }]}>
                      <Text style={[P.yTxt, { color: theme.subtext }, pYear === y && { color: '#fff' }]}>{y}</Text>
                    </TouchableOpacity>
                  )}
                />
                <View style={P.mGrid}>
                  {MES.map((m, i) => (
                    <TouchableOpacity key={m} onPress={() => setPMonth(i)}
                      style={[P.mCell, { backgroundColor: theme.isDark ? theme.bg : '#F0F0F5' }, pMonth === i && { backgroundColor: C_TEAL }]}>
                      <Text style={[P.mTxt, { color: theme.subtext }, pMonth === i && { color: '#fff' }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {/* Botones igual al picker del Historial */}
                <View style={P.actions}>
                  <TouchableOpacity style={[P.btn, { backgroundColor: theme.isDark ? theme.bg : '#F0F0F5' }]}
                    onPress={() => setPicker(false)}>
                    <Text style={[P.btnTxt, { color: theme.subtext }]}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[P.btn, P.btnConfirm]}
                    onPress={() => { onFilterChange({ mode: 'month', year: pYear, month: pMonth }); setPicker(false); }}>
                    <Text style={[P.btnTxt, { color: '#fff' }]}>Confirmar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
function makeStyles(t: Theme) {
  return StyleSheet.create({
    wrap: {
      paddingHorizontal: 22,
      paddingTop: 14,
      paddingBottom: 24,
    },
    digits: {
      fontSize: 68,
      fontFamily: 'Nunito_800ExtraBold',
      letterSpacing: -2,
      lineHeight: 74,
      includeFontPadding: false,
    },
    sym: {
      fontSize: 30,
      fontFamily: 'Nunito_700Bold',
      lineHeight: 42,
      marginTop: 10,
      marginRight: 2,
      opacity: 0.75,
    },
    dir: {
      fontSize: 13,
      fontWeight: '600',
      marginBottom: 3,
    },
    stats: {
      fontSize: 11,
      color: t.subtext,
      marginBottom: 20,
      opacity: 0.55,
    },
    chips: { flexDirection: 'row', gap: 8 },
    chip: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 12, paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: t.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.06)',
    },
    chipOn: {
      backgroundColor: t.isDark ? 'rgba(255,255,255,0.17)' : 'rgba(0,0,0,0.11)',
    },
    chipTxt: {
      fontSize: 12, fontWeight: '600',
      color: t.isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.42)',
    },
    chipTxtOn: { color: t.isDark ? '#fff' : '#000' },
    chipArr: {
      fontSize: 8,
      color: t.isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)',
    },
  });
}

// ── Estilos picker de mes (estáticos) ─────────────────────────────────────────
const P = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet:      { borderRadius: 20, padding: 24, width: '100%' },
  title:      { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 20 },
  yChip:      { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  yTxt:       { fontSize: 14, fontWeight: '600' },
  mGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  mCell:      { width: '22%', paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  mTxt:       { fontSize: 13, fontWeight: '600' },
  // Botones Cancelar + Confirmar (igual que HistoryScreen)
  actions:    { flexDirection: 'row', gap: 12, marginTop: 16 },
  btn:        { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnConfirm: { backgroundColor: C_TEAL },
  btnTxt:     { fontSize: 15, fontWeight: '700' },
});
