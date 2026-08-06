import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Animated, Easing, Modal, TextInput, Platform, useWindowDimensions,
} from 'react-native';
import { ShareFinanzasModal } from '../components/ShareFinanzasModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { useTheme, Theme } from '../context/ThemeContext';
import { useFinanzas } from '../context/FinanzasContext';
import { AddTransactionModal } from '../components/AddTransactionModal';
import { FinanzasCategoryChart } from '../components/FinanzasCategoryChart';
import { getCategoryById, EXPENSE_CATEGORIES, INCOME_CATEGORIES, Category } from '../constants/categories';
import { Transaction } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
const MONTHS   = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_S = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const PAGE_SIZE = 15;
type ViewMode   = 'expenses' | 'income';

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

// ── Menú flotante para las barras del gráfico ─────────────────────────────────
const CHART_MENU_W = 190;
const CHART_ITEM_H = 44;

interface ChartMenuOption { label: string; destructive?: boolean; }
interface ChartMenuState {
  catId: string;
  x: number;
  y: number;
  opts: ChartMenuOption[];
}

function ChartFloatingMenu({
  state, anim, isDark, onSelect, onClose,
}: {
  state:    ChartMenuState;
  anim:     Animated.Value;
  isDark:   boolean;
  onSelect: (idx: number) => void;
  onClose:  () => void;
}) {
  const { width: SW } = useWindowDimensions();
  const bg      = isDark ? 'rgba(18,28,44,0.96)' : 'rgba(250,250,252,0.97)';
  const divider = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const borderC = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)';
  const textC   = isDark ? '#fff' : '#111';

  // Posicionar el menú para que no se salga de la pantalla
  const menuH = state.opts.length * CHART_ITEM_H;
  let left = state.x - CHART_MENU_W / 2;
  if (left < 8) left = 8;
  if (left + CHART_MENU_W > SW - 8) left = SW - CHART_MENU_W - 8;
  const top = state.y - menuH - 12;  // aparece encima del dedo

  const lastIdx = state.opts.length - 1;
  return (
    <>
      {/* Tap fuera cierra */}
      <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      <Animated.View style={[
        cmStyles.menu,
        { top, left, backgroundColor: bg,
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange: [0,1], outputRange: [6, 0] }) },
            { scale:     anim.interpolate({ inputRange: [0,1], outputRange: [0.94, 1] }) },
          ],
        },
      ]}>
        {state.opts.map((opt, i) => {
          const cornerStyle = i === 0
            ? { borderTopLeftRadius: 13, borderTopRightRadius: 13 }
            : i === lastIdx
              ? { borderBottomLeftRadius: 13, borderBottomRightRadius: 13 }
              : undefined;
          return (
            <TouchableOpacity
              key={i}
              style={[cmStyles.item, cornerStyle,
                i < lastIdx && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
              ]}
              onPress={() => onSelect(i)}
              activeOpacity={0.6}
            >
              <Text style={[cmStyles.itemText, {
                color: opt.destructive ? '#F05B53' : textC,
                fontWeight: opt.destructive ? '600' : '500',
              }]}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, cmStyles.border, { borderColor: borderC }]} />
      </Animated.View>
    </>
  );
}

const cmStyles = StyleSheet.create({
  menu:     { position: 'absolute', width: CHART_MENU_W, borderRadius: 13, overflow: 'hidden',
              shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 20, elevation: 0 },
  item:     { height: CHART_ITEM_H, paddingHorizontal: 16, justifyContent: 'center' },
  itemText: { fontSize: 14 },
  border:   { borderRadius: 13, borderWidth: StyleSheet.hairlineWidth },
});

// ── Count-up animado ──────────────────────────────────────────────────────────
function CountUp({ value, style }: { value: number; style: object }) {
  const anim = useRef(new Animated.Value(0)).current;
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setDisp(v));
    Animated.timing(anim, { toValue: value, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value]);
  return <Text style={style}>{Math.round(disp).toLocaleString('es-AR')}</Text>;
}

// ── Barras de tendencia 6 meses ───────────────────────────────────────────────
interface TrendBarsProps {
  transactions: Transaction[];
  currentYear:  number;
  currentMonth: number;
  mode:         ViewMode;
  displayColor: string;
  theme:        Theme;
}

function MonthlyTrendBars({ transactions, currentYear, currentMonth, mode, displayColor, theme }: TrendBarsProps) {
  const BAR_H = 30;
  const months = useMemo(() => {
    const result = [];
    for (let i = 5; i >= 0; i--) {
      const d    = new Date(currentYear, currentMonth - i, 1);
      const y    = d.getFullYear();
      const m    = d.getMonth();
      const type = mode === 'expenses' ? 'expense' : 'income';
      const total = transactions
        .filter(t => { const td = new Date(t.date); return td.getFullYear() === y && td.getMonth() === m && t.type === type; })
        .reduce((s, t) => s + t.amount, 0);
      result.push({ year: y, month: m, total, label: MONTHS_S[m] });
    }
    return result;
  }, [transactions, currentYear, currentMonth, mode]);

  const maxTotal = Math.max(...months.map(m => m.total), 1);

  return (
    <View style={trendStyles.container}>
      {months.map(({ year, month, total, label }, i) => {
        const isCurrent = year === currentYear && month === currentMonth;
        const h = Math.max((total / maxTotal) * BAR_H, total > 0 ? 4 : 2);
        const barColor = isCurrent ? displayColor : (theme.isDark ? '#2A3A52' : '#D8D8E0');
        return (
          <View key={i} style={trendStyles.col}>
            <View style={[trendStyles.barWrap, { height: BAR_H }]}>
              <View style={[trendStyles.bar, { height: h, backgroundColor: barColor }]} />
            </View>
            <Text style={[trendStyles.label, { color: isCurrent ? displayColor : theme.subtext, fontWeight: isCurrent ? '700' : '400' }]}>
              {label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const trendStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingVertical: 6 },
  col:       { flex: 1, alignItems: 'center', gap: 4 },
  barWrap:   { justifyContent: 'flex-end', width: '100%' },
  bar:       { borderRadius: 4, width: '100%' },
  label:     { fontSize: 9 },
});

// ── Ícono de insight (reemplaza emojis de sistema) ────────────────────────────
function InsightIcon({ iconType, categoryEmoji, color }: {
  iconType: 'check' | 'warning' | 'trend' | 'category';
  categoryEmoji?: string;
  color: string;
}) {
  if (iconType === 'category' && categoryEmoji) {
    return <Text style={{ fontSize: 16 }}>{categoryEmoji}</Text>;
  }
  const char = iconType === 'check' ? '✓' : iconType === 'warning' ? '!' : '↑';
  return (
    <View style={{
      width: 24, height: 24, borderRadius: 12,
      backgroundColor: color,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', lineHeight: 16 }}>{char}</Text>
    </View>
  );
}

// ── Barra de progreso de presupuesto ─────────────────────────────────────────
interface BPRowProps { cat: Category; spent: number; budget: number; theme: Theme; onLongPress: () => void; }

function BudgetProgressRow({ cat, spent, budget, theme, onLongPress }: BPRowProps) {
  const pct        = Math.min(spent / budget, 1);
  const pctNum     = Math.round((spent / budget) * 100);
  const overBudget = spent > budget;
  const barColor   = overBudget ? '#F05B53' : pctNum > 80 ? '#FF9F0A' : '#2ED573';
  const widthAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: pct, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [pct]);

  return (
    <TouchableOpacity activeOpacity={0.7} onLongPress={onLongPress} delayLongPress={400} style={bpStyles.row}>
      <Text style={bpStyles.emoji}>{cat.emoji}</Text>
      <View style={bpStyles.content}>
        <View style={bpStyles.headerRow}>
          <Text style={[bpStyles.label, { color: theme.text }]}>{cat.label}</Text>
          <Text style={[bpStyles.amounts, { color: overBudget ? '#F05B53' : theme.subtext }]}>
            ${fmtK(spent)} / ${fmtK(budget)} · {pctNum}%
          </Text>
        </View>
        <View style={[bpStyles.track, { backgroundColor: theme.isDark ? '#1A2744' : '#EBEBF0' }]}>
          <Animated.View style={[bpStyles.fill, {
            backgroundColor: barColor,
            width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          }]} />
        </View>
        {overBudget && (
          <Text style={bpStyles.overText}>+${fmtK(spent - budget)} sobre el límite</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const bpStyles = StyleSheet.create({
  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 7 },
  emoji:     { fontSize: 19, width: 26, textAlign: 'center', marginTop: 2 },
  content:   { flex: 1, gap: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:     { fontSize: 13, fontWeight: '700' },
  amounts:   { fontSize: 12, fontWeight: '600' },
  track:     { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill:      { height: 8, borderRadius: 4 },
  overText:  { fontSize: 11, color: '#F05B53', fontWeight: '600' },
});

// ── Fila de transacción ───────────────────────────────────────────────────────
interface TxRowProps { tx: Transaction; onDelete: () => void; onEdit: () => void; theme: Theme; }

function TxRow({ tx, onDelete, onEdit, theme }: TxRowProps) {
  const swipeRef      = useRef<Swipeable>(null);
  const cat           = getCategoryById(tx.category);
  const isIncome      = tx.type === 'income';
  const amtColor      = isIncome ? '#2ED573' : theme.text;
  const isSubscription = tx.category === 'subscriptions';

  function renderRight() {
    return (
      <View style={txStyles.actions}>
        <RectButton style={txStyles.editAction} onPress={() => { swipeRef.current?.close(); onEdit(); }}>
          <Text style={txStyles.actionIcon}>✏️</Text>
        </RectButton>
        <RectButton style={txStyles.deleteAction} onPress={() => { swipeRef.current?.close(); onDelete(); }}>
          <Text style={txStyles.actionIcon}>🗑️</Text>
        </RectButton>
      </View>
    );
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRight} overshootRight={false}>
      <TouchableOpacity
        style={[txStyles.row, { backgroundColor: theme.card, borderLeftColor: cat?.color ?? 'transparent', borderLeftWidth: 3 }]}
        onPress={onEdit}
        activeOpacity={0.75}
      >
        <View style={[txStyles.avatar, { backgroundColor: cat?.barColor ?? '#D4D4D4' }]}>
          <Text style={txStyles.avatarEmoji}>{cat?.emoji ?? '📦'}</Text>
          {isSubscription && (
            <View style={txStyles.subBadge}>
              <Text style={txStyles.subBadgeText}>🔄</Text>
            </View>
          )}
        </View>
        <View style={txStyles.info}>
          <Text style={[txStyles.catLabel, { color: theme.text }]}>{cat?.label ?? tx.category}</Text>
          {tx.description ? (
            <Text style={[txStyles.desc, { color: theme.subtext }]} numberOfLines={1}>{tx.description}</Text>
          ) : null}
        </View>
        <Text style={[txStyles.amount, { color: amtColor }]}>
          {isIncome ? '+' : '-'}${fmtK(tx.amount)}
        </Text>
      </TouchableOpacity>
    </Swipeable>
  );
}

const txStyles = StyleSheet.create({
  row:          { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10, paddingRight: 20, paddingLeft: 17 },
  avatar:       { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarEmoji:  { fontSize: 20 },
  subBadge:     { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#fff', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
  subBadgeText: { fontSize: 9 },
  info:         { flex: 1, gap: 2 },
  catLabel:     { fontSize: 14, fontWeight: '700' },
  desc:         { fontSize: 12 },
  amount:       { fontSize: 15, fontWeight: '700' },
  actions:      { flexDirection: 'row', alignItems: 'center', marginRight: 16, gap: 6 },
  editAction:   { width: 54, height: '100%' as any, alignItems: 'center', justifyContent: 'center', backgroundColor: '#4B8BFF18', borderRadius: 12 },
  deleteAction: { width: 54, height: '100%' as any, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F05B5320', borderRadius: 12 },
  actionIcon:   { fontSize: 18 },
});

// ── Modal de presupuesto ──────────────────────────────────────────────────────
function BudgetModal({ catId, current, visible, onSave, onDelete, onClose, theme }: {
  catId: string; current: number | null; visible: boolean;
  onSave: (n: number) => void; onDelete: () => void; onClose: () => void; theme: Theme;
}) {
  const cat = getCategoryById(catId);
  const [val, setVal] = useState('');
  useEffect(() => { if (visible) setVal(current ? String(current) : ''); }, [visible]);
  const bg = theme.isDark ? '#1A2744' : '#FFFFFF';
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1}>
          <View style={{ backgroundColor: bg, borderRadius: 20, padding: 24, width: 300, gap: 16 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text, textAlign: 'center' }}>
              {cat?.emoji} Límite de {cat?.label}
            </Text>
            <TextInput
              style={{ backgroundColor: theme.isDark ? '#0D1B2A' : '#F5F5F5', borderRadius: 12, padding: 14, fontSize: 24, fontWeight: '700', color: theme.text, textAlign: 'center' }}
              placeholder="$ 0" placeholderTextColor={theme.subtext}
              value={val} onChangeText={v => setVal(v.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad" autoFocus
            />
            <TouchableOpacity style={{ backgroundColor: '#00C4A8', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
              onPress={() => { const n = parseInt(val); if (n > 0) onSave(n); }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Guardar límite</Text>
            </TouchableOpacity>
            {current ? (
              <TouchableOpacity onPress={onDelete} style={{ alignItems: 'center' }}>
                <Text style={{ color: theme.subtext, fontSize: 13 }}>Quitar límite</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export function FinanzasScreen() {
  const { theme } = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { transactions, budgets, loading, upsertBudget, deleteBudget, deleteTransaction } = useFinanzas();

  const now = new Date();

  // ── Estado ──────────────────────────────────────────────────────────────
  const [year, setYear]              = useState(now.getFullYear());
  const [month, setMonth]            = useState(now.getMonth());
  const [mode, setMode]              = useState<ViewMode>('expenses');
  const [filterCat, setFilterCat]    = useState<string | null>(null);
  const [txPage, setTxPage]          = useState(1);
  const [searchQuery, setSearchQuery]= useState('');
  const [showAdd, setShowAdd]        = useState(false);
  const [editingTx, setEditingTx]    = useState<Transaction | null>(null);
  const [budgetModal, setBudgetModal]= useState<string | null>(null);
  const [showShare, setShowShare]    = useState(false);
  const [chartMenu,   setChartMenu]  = useState<ChartMenuState | null>(null);
  const chartMenuAnim = useRef(new Animated.Value(0)).current;
  // Undo delete
  const [pendingDeleteTx, setPendingDeleteTx] = useState<Transaction | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef      = useRef<TextInput>(null);
  const scrollViewRef  = useRef<ScrollView>(null);
  const txSectionY     = useRef(0);

  // ── Effects ──────────────────────────────────────────────────────────────
  // Cleanup pending delete timer on unmount to avoid setState on unmounted component
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  useEffect(() => {
    setFilterCat(null); setTxPage(1); setSearchQuery('');
  }, [year, month, mode]);

  useEffect(() => { setTxPage(1); }, [filterCat, searchQuery]);

  // Animaciones de entrada
  const heroAnim  = useRef(new Animated.Value(0)).current;
  const chartAnim = useRef(new Animated.Value(0)).current;
  const listAnim  = useRef(new Animated.Value(0)).current;
  const fabAnim   = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(70, [
      Animated.timing(heroAnim,  { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(chartAnim, { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(listAnim,  { toValue: 1, duration: 340, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    Animated.timing(fabAnim, { toValue: 1, duration: 260, easing: Easing.out(Easing.back(1.4) as any), useNativeDriver: true }).start();
  }, []);

  const sec = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
  });

  // ── Undo delete ───────────────────────────────────────────────────────
  function requestDelete(tx: Transaction) {
    // Flush previous pending delete immediately
    if (pendingDeleteTx && pendingDeleteTx.id !== tx.id) {
      deleteTransaction(pendingDeleteTx.id);
    }
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setPendingDeleteTx(tx);
    deleteTimerRef.current = setTimeout(() => {
      deleteTransaction(tx.id);
      setPendingDeleteTx(null);
      deleteTimerRef.current = null;
    }, 4000);
  }

  function undoDelete() {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    deleteTimerRef.current = null;
    setPendingDeleteTx(null);
  }

  // ── Transacciones del mes ─────────────────────────────────────────────
  const monthTx = useMemo(() => transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === year && d.getMonth() === month;
  }), [transactions, year, month]);

  // ── Mes anterior ──────────────────────────────────────────────────────
  const prevYear  = month === 0 ? year - 1 : year;
  const prevMonth = month === 0 ? 11 : month - 1;
  const prevMonthTx = useMemo(() => transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
  }), [transactions, year, month]);

  // ── Totales ───────────────────────────────────────────────────────────
  const totalIncome   = useMemo(() => monthTx.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount, 0), [monthTx]);
  const totalExpenses = useMemo(() => monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [monthTx]);
  const prevIncome    = useMemo(() => prevMonthTx.filter(t => t.type === 'income').reduce((s, t)  => s + t.amount, 0), [prevMonthTx]);
  const prevExpenses  = useMemo(() => prevMonthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), [prevMonthTx]);

  const displayValue   = mode === 'expenses' ? totalExpenses : totalIncome;
  const prevValue      = mode === 'expenses' ? prevExpenses  : prevIncome;
  const displayColor   = mode === 'expenses' ? '#F05B53' : '#2ED573';
  const netBalance     = totalIncome - totalExpenses;
  const netColor       = netBalance >= 0 ? '#2ED573' : '#F05B53';
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  // % vs mes anterior
  const vsPercent = prevValue > 0 ? Math.round(((displayValue - prevValue) / prevValue) * 100) : null;
  const vsColor   = mode === 'expenses'
    ? (vsPercent !== null && vsPercent > 0 ? '#F05B53' : '#2ED573')
    : (vsPercent !== null && vsPercent > 0 ? '#2ED573' : '#F05B53');

  // ── Stats rápidos ─────────────────────────────────────────────────────
  const daysInMonth    = new Date(year, month + 1, 0).getDate();
  const daysPassed     = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;
  const daysRemaining  = isCurrentMonth ? daysInMonth - now.getDate() : 0;
  const dailyAvgExp    = daysPassed > 0 && totalExpenses > 0 ? Math.round(totalExpenses / daysPassed) : 0;
  const projectedTotal = isCurrentMonth && daysPassed > 0 && totalExpenses > 0
    ? Math.round((totalExpenses / daysPassed) * daysInMonth) : 0;

  // Esta semana (solo mes actual, expenses)
  const thisWeekTotal = useMemo(() => {
    if (!isCurrentMonth) return 0;
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return monthTx
      .filter(t => t.type === 'expense' && new Date(t.date) >= startOfWeek)
      .reduce((s, t) => s + t.amount, 0);
  }, [monthTx, isCurrentMonth]);

  // Presupuesto total mensual y disponible por día
  const totalMonthlyBudget = useMemo(() =>
    budgets
      .filter(b => EXPENSE_CATEGORIES.some(c => c.id === b.category))
      .reduce((s, b) => s + b.amount, 0),
  [budgets]);
  const budgetRemaining  = totalMonthlyBudget - totalExpenses;
  const dailyBudgetLeft  = daysRemaining > 0 ? Math.round(budgetRemaining / daysRemaining) : 0;

  // ── 3-month avg por categoría (para anomalías) ────────────────────────
  const threeMonthAvg = useMemo(() => {
    const totals: Record<string, number> = {};
    for (let i = 1; i <= 3; i++) {
      const d    = new Date(year, month - i, 1);
      const y    = d.getFullYear();
      const m    = d.getMonth();
      transactions
        .filter(t => { const td = new Date(t.date); return td.getFullYear() === y && td.getMonth() === m && t.type === 'expense'; })
        .forEach(t => { totals[t.category] = (totals[t.category] ?? 0) + t.amount; });
    }
    const avg: Record<string, number> = {};
    Object.keys(totals).forEach(k => { avg[k] = totals[k] / 3; });
    return avg;
  }, [transactions, year, month]);

  // ── Datos del gráfico ─────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const cats = mode === 'expenses' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const txs  = monthTx.filter(t => t.type === (mode === 'expenses' ? 'expense' : 'income'));
    const spent: Record<string, number> = {};
    txs.forEach(t => { spent[t.category] = (spent[t.category] ?? 0) + t.amount; });
    if (mode === 'expenses') budgets.forEach(b => { if (!(b.category in spent)) spent[b.category] = 0; });
    return cats
      .filter(c => spent[c.id] !== undefined)
      .map(cat => ({ cat, spent: spent[cat.id] ?? 0, budget: budgets.find(b => b.category === cat.id)?.amount ?? null }))
      .sort((a, b) => b.spent - a.spent);
  }, [monthTx, budgets, mode]);

  // ── Barras de presupuesto ─────────────────────────────────────────────
  const budgetProgressData = useMemo(() =>
    mode === 'expenses'
      ? chartData.filter(({ budget }) => budget !== null).map(({ cat, spent, budget }) => ({ cat, spent, budget: budget! }))
      : [],
  [chartData, mode]);

  // ── Insight contextual (con anomalía) ────────────────────────────────
  const insightData = useMemo(() => {
    if (mode === 'expenses') {
      const overs = chartData.filter(({ spent, budget }) => budget !== null && spent > budget);
      if (overs.length > 1) {
        return { iconType: 'warning' as const, color: '#F05B53', message: `${overs.length} categorías superaron su presupuesto este mes` };
      }
      if (overs.length === 1) {
        const w = overs[0];
        return { iconType: 'warning' as const, color: '#F05B53', message: `Superaste el límite de ${w.cat.label} por $${fmtK(w.spent - (w.budget ?? 0))}` };
      }
      // Anomaly detection
      if (chartData.length > 0) {
        const top   = chartData[0];
        const avg3  = threeMonthAvg[top.cat.id] ?? 0;
        if (avg3 > 500 && top.spent > avg3 * 1.5) {
          const mult = (top.spent / avg3).toFixed(1);
          return { iconType: 'trend' as const, color: '#FF9F0A', message: `Gastaste ${mult}x más en ${top.cat.label} que tu promedio de 3 meses` };
        }
      }
      const withBudget = chartData.filter(({ budget }) => budget !== null);
      if (withBudget.length > 0) {
        return { iconType: 'check' as const, color: '#2ED573', message: 'Todo bajo presupuesto este mes — ¡bien!' };
      }
      const top = chartData[0];
      if (top && top.spent > 0) {
        const pct = totalExpenses > 0 ? Math.round((top.spent / totalExpenses) * 100) : 0;
        return { iconType: 'category' as const, categoryEmoji: top.cat.emoji, color: top.cat.color, message: `Mayor gasto: ${top.cat.label} · ${pct}% del total` };
      }
      return null;
    } else {
      const top = chartData[0];
      if (top && top.spent > 0) {
        const pct = totalIncome > 0 ? Math.round((top.spent / totalIncome) * 100) : 0;
        return { iconType: 'category' as const, categoryEmoji: top.cat.emoji, color: top.cat.color, message: `Principal ingreso: ${top.cat.label} · ${pct}%` };
      }
      return null;
    }
  }, [chartData, mode, totalExpenses, totalIncome, threeMonthAvg]);

  // ── Transacciones filtradas + paginadas ───────────────────────────────
  const monthTypeTx = useMemo(() =>
    monthTx.filter(t => t.type === (mode === 'expenses' ? 'expense' : 'income')),
  [monthTx, mode]);

  const filteredTx = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return monthTypeTx
      .filter(t => t.id !== pendingDeleteTx?.id)
      .filter(t => !filterCat || t.category === filterCat)
      .filter(t => {
        if (!q) return true;
        const cat = getCategoryById(t.category);
        return (
          t.description.toLowerCase().includes(q) ||
          (cat?.label.toLowerCase().includes(q) ?? false) ||
          String(Math.round(t.amount)).includes(q)
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [monthTypeTx, filterCat, searchQuery, pendingDeleteTx]);

  const catCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    monthTypeTx.filter(t => !searchQuery && t.id !== pendingDeleteTx?.id).forEach(t => {
      counts[t.category] = (counts[t.category] ?? 0) + 1;
    });
    return counts;
  }, [monthTypeTx, searchQuery, pendingDeleteTx]);

  const visibleTx = useMemo(() => filteredTx.slice(0, PAGE_SIZE * txPage), [filteredTx, txPage]);
  const hasMore   = filteredTx.length > visibleTx.length;
  const remaining = Math.min(filteredTx.length - visibleTx.length, PAGE_SIZE);

  // Agrupado por fecha
  const groupedTx = useMemo(() => {
    const map = new Map<string, { label: string; isToday: boolean; items: Transaction[] }>();
    visibleTx.forEach(tx => {
      const d   = new Date(tx.date);
      const key = d.toDateString();
      if (!map.has(key)) {
        const today = new Date();
        const yest  = new Date(); yest.setDate(today.getDate() - 1);
        const isToday = d.toDateString() === today.toDateString();
        const label = isToday ? 'Hoy'
                    : d.toDateString() === yest.toDateString() ? 'Ayer'
                    : `${d.getDate()} ${MONTHS_S[d.getMonth()]}`;
        map.set(key, { label, isToday, items: [] });
      }
      map.get(key)!.items.push(tx);
    });
    return Array.from(map.values());
  }, [visibleTx]);

  // ── Navegación mes ────────────────────────────────────────────────────
  function changeMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear()); setMonth(d.getMonth());
  }

  // ── Compartir resumen ─────────────────────────────────────────────────
  function shareMonthSummary() {
    setShowShare(true);
  }

  // ── Menú flotante del gráfico ─────────────────────────────────────────
  const openChartMenu = useCallback((catId: string, pageX: number, pageY: number) => {
    const hasBudget = budgets.some(b => b.category === catId);
    const opts: ChartMenuOption[] = [
      { label: hasBudget ? 'Editar presupuesto' : 'Poner presupuesto' },
      { label: 'Ver movimientos' },
      ...(hasBudget ? [{ label: 'Quitar presupuesto', destructive: true }] : []),
    ];
    setChartMenu({ catId, x: pageX, y: pageY, opts });
    chartMenuAnim.setValue(0);
    Animated.spring(chartMenuAnim, { toValue: 1, friction: 7, tension: 230, useNativeDriver: true }).start();
  }, [budgets, chartMenuAnim]);

  const closeChartMenu = useCallback(() => {
    Animated.timing(chartMenuAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => setChartMenu(null));
  }, [chartMenuAnim]);

  const handleChartMenuSelect = useCallback((idx: number) => {
    if (!chartMenu) return;
    const { catId, opts } = chartMenu;
    const label = opts[idx].label;
    closeChartMenu();
    // Esperar que termine la animación de cierre (120ms) antes de ejecutar la acción
    setTimeout(() => {
      if (label === 'Ver movimientos') {
        setFilterCat(catId);
        // Scroll a la sección de transacciones para que el usuario vea el resultado
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: txSectionY.current, animated: true });
        }, 80);
      } else if (label === 'Quitar presupuesto') {
        deleteBudget(catId);
      } else {
        // "Editar presupuesto" / "Poner presupuesto"
        setBudgetModal(catId);
      }
    }, 130);
  }, [chartMenu, closeChartMenu, deleteBudget]);

  const isSearching      = searchQuery.length > 0;
  const budgetModal_curr = budgetModal ? (budgets.find(b => b.category === budgetModal)?.amount ?? null) : null;

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView ref={scrollViewRef} style={s.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Hero ────────────────────────────────────────────────── */}
        <Animated.View style={[s.hero, sec(heroAnim)]}>

          {/* Fila modo + compartir */}
          <View style={s.topRow}>
            <View style={s.modeRow}>
              {(['expenses', 'income'] as ViewMode[]).map(m => (
                <TouchableOpacity key={m}
                  style={[s.modeChip, mode === m && { backgroundColor: m === 'expenses' ? '#F05B53' : '#2ED573' }]}
                  onPress={() => setMode(m)} activeOpacity={0.8}
                >
                  <Text style={[s.modeText, { color: mode === m ? '#fff' : theme.subtext }]}>
                    {m === 'expenses' ? '↓ Gastos' : '↑ Ingresos'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={shareMonthSummary} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
              <Text style={s.shareIcon}>📤</Text>
            </TouchableOpacity>
          </View>

          {/* Número grande */}
          <View style={s.bigNumRow}>
            <Text style={[s.bigCurrency, { color: theme.isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)' }]}>$</Text>
            <CountUp value={displayValue} style={[s.bigNum, { color: theme.text }]} />
          </View>

          {/* % vs mes anterior */}
          {vsPercent !== null && (
            <View style={[s.vsBadge, { backgroundColor: vsColor + '18' }]}>
              <Text style={[s.vsText, { color: vsColor }]}>
                {vsPercent > 0 ? '▲' : '▼'} {Math.abs(vsPercent)}% vs {MONTHS_S[prevMonth]}
              </Text>
            </View>
          )}

          {/* Neto */}
          <View style={[s.netPill, { backgroundColor: netColor + '22' }]}>
            <Text style={[s.netText, { color: netColor }]}>
              {netBalance >= 0 ? '+' : '-'}${fmtK(Math.abs(netBalance))} neto
            </Text>
          </View>

          {/* Selector mes */}
          <View style={s.monthRow}>
            <TouchableOpacity onPress={() => changeMonth(-1)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[s.arrow, { color: theme.subtext }]}>‹</Text>
            </TouchableOpacity>
            <Text style={[s.monthLabel, { color: theme.subtext }]}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={() => changeMonth(1)} disabled={isCurrentMonth} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={[s.arrow, { color: isCurrentMonth ? 'transparent' : theme.subtext }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Tendencia 6 meses */}
          {transactions.length > 0 && (
            <MonthlyTrendBars
              transactions={transactions}
              currentYear={year}
              currentMonth={month}
              mode={mode}
              displayColor={displayColor}
              theme={theme}
            />
          )}

          {/* Stats rápidos */}
          {(monthTypeTx.length > 0) && (
            <View style={s.statsRow}>
              <Text style={[s.statItem, { color: theme.subtext }]}>{monthTypeTx.length} mov.</Text>
              {mode === 'expenses' && dailyAvgExp > 0 && (
                <Text style={[s.statItem, { color: theme.subtext }]}>· ${fmtK(dailyAvgExp)}/día</Text>
              )}
              {isCurrentMonth && projectedTotal > 0 && mode === 'expenses' && (
                <Text style={[s.statItem, { color: theme.subtext }]}>· Proy. ${fmtK(projectedTotal)}</Text>
              )}
              {isCurrentMonth && thisWeekTotal > 0 && mode === 'expenses' && (
                <Text style={[s.statItem, { color: theme.subtext }]}>· ${fmtK(thisWeekTotal)} esta sem.</Text>
              )}
            </View>
          )}

          {/* Card presupuesto diario disponible */}
          {mode === 'expenses' && isCurrentMonth && daysRemaining > 0 && totalMonthlyBudget > 0 && (
            <View style={[s.dailyBudgetCard, {
              backgroundColor: dailyBudgetLeft >= 0
                ? (theme.isDark ? '#0D2A1A' : '#EAF9F0')
                : (theme.isDark ? '#2A0D0D' : '#FDECEA'),
              borderColor: dailyBudgetLeft >= 0 ? '#2ED57330' : '#F05B5330',
            }]}>
              <Text style={s.dailyBudgetEmoji}>{dailyBudgetLeft >= 0 ? '💚' : '🔴'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.dailyBudgetAmount, { color: dailyBudgetLeft >= 0 ? '#2ED573' : '#F05B53' }]}>
                  {dailyBudgetLeft >= 0 ? '+' : '-'}${fmtK(Math.abs(dailyBudgetLeft))}/día disponible
                </Text>
                <Text style={[s.dailyBudgetSub, { color: theme.subtext }]}>
                  {daysRemaining} días restantes · ${fmtK(Math.abs(budgetRemaining))} {budgetRemaining >= 0 ? 'restante' : 'excedido'}
                </Text>
              </View>
            </View>
          )}

          {/* Barra de búsqueda */}
          <View style={[s.searchBar, { backgroundColor: theme.isDark ? '#1A2744' : '#F0F0F5' }]}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              ref={searchRef}
              style={[s.searchInput, { color: theme.text }]}
              placeholder="Buscar en este mes..."
              placeholderTextColor={theme.subtext}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {isSearching && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={{ color: theme.subtext, fontSize: 13, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ── Gráfico + presupuestos (oculto al buscar) ─────────────── */}
        {!isSearching && (
          <Animated.View style={[s.chartSection, sec(chartAnim)]}>
            {chartData.length > 0 ? (
              <>
                <FinanzasCategoryChart
                  categories={chartData}
                  theme={theme}
                  onCategoryPress={id => setBudgetModal(id)}
                  onCategoryLongPress={openChartMenu}
                />

                {/* Barras de presupuesto */}
                {budgetProgressData.length > 0 && (
                  <View style={[s.budgetSection, { backgroundColor: theme.isDark ? '#0B1829' : theme.card }]}>
                    <Text style={[s.budgetSectionTitle, { color: theme.subtext }]}>PRESUPUESTOS</Text>
                    {budgetProgressData.map(({ cat, spent, budget }) => (
                      <BudgetProgressRow key={cat.id} cat={cat} spent={spent} budget={budget} theme={theme} onLongPress={() => setBudgetModal(cat.id)} />
                    ))}
                  </View>
                )}

                {/* Insight card */}
                {insightData && (
                  <View style={[s.insightCard, { backgroundColor: insightData.color + '12', borderColor: insightData.color + '28' }]}>
                    <InsightIcon iconType={insightData.iconType} categoryEmoji={'categoryEmoji' in insightData ? insightData.categoryEmoji : undefined} color={insightData.color} />
                    <Text style={[s.insightText, { color: theme.text }]}>{insightData.message}</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={s.emptyChart}>
                <Text style={[s.emptyChartText, { color: theme.subtext }]}>
                  {loading ? 'Cargando...' : 'Sin movimientos este mes'}
                </Text>
              </View>
            )}

            {/* Agregar */}
            <TouchableOpacity style={[s.addTxBtn, { borderColor: theme.border }]} onPress={() => setShowAdd(true)} activeOpacity={0.7}>
              <Text style={[s.addTxText, { color: theme.subtext }]}>+ Agregar movimiento</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Filtros por categoría (oculto al buscar) ──────────────── */}
        {!isSearching && chartData.length > 0 && (
          <Animated.View style={sec(listAnim)} onLayout={e => { txSectionY.current = e.nativeEvent.layout.y; }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
              <TouchableOpacity
                style={[s.filterChip, !filterCat && { backgroundColor: theme.isDark ? '#2A3A52' : '#1A1A2E', borderColor: '#1A1A2E' }]}
                onPress={() => setFilterCat(null)} activeOpacity={0.8}
              >
                <Text style={[s.filterChipText, { color: !filterCat ? '#fff' : theme.subtext }]}>Todos</Text>
              </TouchableOpacity>
              {chartData.map(({ cat }) => {
                const count = catCounts[cat.id] ?? 0;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[s.filterChip, filterCat === cat.id && { backgroundColor: cat.color + '22', borderColor: cat.color }]}
                    onPress={() => setFilterCat(prev => prev === cat.id ? null : cat.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={s.filterChipEmoji}>{cat.emoji}</Text>
                    <Text style={[s.filterChipText, { color: filterCat === cat.id ? cat.color : theme.subtext }]}>
                      {cat.label}
                    </Text>
                    {count > 0 && (
                      <View style={[s.chipBadge, { backgroundColor: filterCat === cat.id ? cat.color + '30' : theme.isDark ? '#1A2744' : '#E8E8EE' }]}>
                        <Text style={[s.chipBadgeText, { color: filterCat === cat.id ? cat.color : theme.subtext }]}>{count}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── Resultado de búsqueda ─────────────────────────────────── */}
        {isSearching && (
          <View style={s.searchResultBar}>
            <Text style={[s.searchResultText, { color: theme.subtext }]}>
              {filteredTx.length} resultado{filteredTx.length !== 1 ? 's' : ''} para "{searchQuery}"
            </Text>
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={{ color: '#F05B53', fontWeight: '700', fontSize: 13 }}>Limpiar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Lista de transacciones ────────────────────────────────── */}
        <Animated.View style={sec(listAnim)}>
          {groupedTx.length === 0 && !loading ? (
            <View style={s.emptyTx}>
              <Text style={s.emptyTxEmoji}>{isSearching ? '🔍' : '💸'}</Text>
              <Text style={[s.emptyTxText, { color: theme.subtext }]}>
                {isSearching
                  ? 'Sin resultados para esta búsqueda'
                  : filterCat
                    ? 'Sin movimientos en esta categoría'
                    : `Sin movimientos en ${MONTHS[month]}`}
              </Text>
              {!isSearching && !filterCat && (
                <TouchableOpacity style={s.emptyAddBtn} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
                  <Text style={s.emptyAddText}>Agregar movimiento</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              {groupedTx.map(({ label, isToday, items }) => (
                <View key={label}>
                  <Text style={[s.dateHeader, { color: isToday ? '#F05B53' : theme.subtext }]}>{label}</Text>
                  {items.map(tx => (
                    <TxRow key={tx.id} tx={tx} theme={theme}
                      onDelete={() => requestDelete(tx)}
                      onEdit={() => setEditingTx(tx)}
                    />
                  ))}
                </View>
              ))}
              {hasMore && (
                <TouchableOpacity style={[s.loadMoreBtn, { borderColor: theme.border }]} onPress={() => setTxPage(p => p + 1)} activeOpacity={0.7}>
                  <Text style={[s.loadMoreText, { color: theme.subtext }]}>Ver {remaining} más</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </Animated.View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Menú flotante del gráfico ──────────────────────────────── */}
      {chartMenu && (
        <ChartFloatingMenu
          state={chartMenu}
          anim={chartMenuAnim}
          isDark={theme.isDark}
          onSelect={handleChartMenuSelect}
          onClose={closeChartMenu}
        />
      )}

      {/* ── Banner Deshacer ─────────────────────────────────────────── */}
      {pendingDeleteTx && (
        <View style={[s.undoBanner, { backgroundColor: theme.isDark ? '#1E2E4A' : '#1A1A2E' }]}>
          <Text style={s.undoText}>Movimiento eliminado</Text>
          <TouchableOpacity onPress={undoDelete} activeOpacity={0.8}>
            <Text style={s.undoAction}>Deshacer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── FAB ────────────────────────────────────────────────────── */}
      <Animated.View style={[s.fab, { transform: [{ scale: fabAnim }] }]}>
        <TouchableOpacity style={s.fabBtn} onPress={() => setShowAdd(true)} activeOpacity={0.85}>
          <Text style={s.fabIcon}>+</Text>
        </TouchableOpacity>
      </Animated.View>

      <AddTransactionModal visible={showAdd} onClose={() => setShowAdd(false)} />
      <AddTransactionModal visible={!!editingTx} onClose={() => setEditingTx(null)} initialTx={editingTx ?? undefined} />
      <BudgetModal
        catId={budgetModal ?? ''} current={budgetModal_curr} visible={!!budgetModal}
        onSave={n  => { if (budgetModal) { upsertBudget(budgetModal, n); setBudgetModal(null); } }}
        onDelete={() => { if (budgetModal) { deleteBudget(budgetModal);  setBudgetModal(null); } }}
        onClose={() => setBudgetModal(null)} theme={theme}
      />
      <ShareFinanzasModal
        visible={showShare}
        onClose={() => setShowShare(false)}
        month={month}
        year={year}
        totalExpenses={totalExpenses}
        totalIncome={totalIncome}
        netBalance={netBalance}
        chartData={chartData}
        vsPercent={vsPercent}
        mode={mode}
      />
    </SafeAreaView>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
function createStyles(t: Theme) {
  return StyleSheet.create({
    safe:   { flex: 1, backgroundColor: t.bg },
    scroll: { flex: 1 },

    // Hero
    hero:        { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 8 },
    topRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
    modeRow:     { flexDirection: 'row', gap: 8 },
    modeChip:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: t.isDark ? t.card : '#F0F0F5' },
    modeText:    { fontSize: 13, fontWeight: '700' },
    shareIcon:   { fontSize: 20 },
    bigNumRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginBottom: 6 },
    bigCurrency: { fontSize: 28, fontFamily: 'Nunito_700Bold', marginTop: 10, opacity: 0.75 },
    bigNum:      { fontSize: 68, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -2, lineHeight: 76 },
    vsBadge:     { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 8 },
    vsText:      { fontSize: 12, fontWeight: '700' },
    netPill:     { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, marginBottom: 14 },
    netText:     { fontSize: 13, fontWeight: '700' },
    monthRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
    arrow:       { fontSize: 24, fontWeight: '300' },
    monthLabel:  { fontSize: 14, fontWeight: '600', minWidth: 130 },

    // Stats
    statsRow:  { flexDirection: 'row', gap: 6, marginTop: 10, marginBottom: 10, flexWrap: 'wrap' },
    statItem:  { fontSize: 12, fontWeight: '600' },

    // Daily budget card
    dailyBudgetCard:   { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12 },
    dailyBudgetEmoji:  { fontSize: 20 },
    dailyBudgetAmount: { fontSize: 14, fontWeight: '700' },
    dailyBudgetSub:    { fontSize: 11, fontWeight: '500', marginTop: 2 },

    // Search
    searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, marginBottom: 4 },
    searchIcon:  { fontSize: 14 },
    searchInput: { flex: 1, fontSize: 14, padding: 0 },

    // Search result banner
    searchResultBar:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 10 },
    searchResultText: { fontSize: 13, fontWeight: '600' },

    // Chart
    chartSection:   { paddingTop: 12, paddingBottom: 8 },
    emptyChart:     { height: 80, alignItems: 'center', justifyContent: 'center' },
    emptyChartText: { fontSize: 14 },

    // Budget progress
    budgetSection:      { marginHorizontal: 20, marginTop: 16, borderRadius: 16, padding: 16, gap: 2 },
    budgetSectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },

    // Insight
    insightCard:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginTop: 14, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 11 },
    insightEmoji: { fontSize: 18 },
    insightText:  { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },

    // Add button
    addTxBtn:  { marginHorizontal: 20, marginTop: 14, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
    addTxText: { fontSize: 14, fontWeight: '600' },

    // Filtros
    filterRow:       { paddingHorizontal: 20, paddingVertical: 12, gap: 8 },
    filterChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5, borderColor: t.border },
    filterChipEmoji: { fontSize: 13 },
    filterChipText:  { fontSize: 12, fontWeight: '600' },
    chipBadge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, minWidth: 20, alignItems: 'center' },
    chipBadgeText:   { fontSize: 10, fontWeight: '700' },

    // Transacciones
    dateHeader:   { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4, color: t.subtext },
    emptyTx:      { alignItems: 'center', paddingVertical: 40, gap: 8 },
    emptyTxEmoji: { fontSize: 40 },
    emptyTxText:  { fontSize: 14, fontWeight: '500' },
    emptyAddBtn:  { marginTop: 8, backgroundColor: '#00C4A8', borderRadius: 20, paddingHorizontal: 24, paddingVertical: 10 },
    emptyAddText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    loadMoreBtn:  { marginHorizontal: 20, marginTop: 8, marginBottom: 4, borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
    loadMoreText: { fontSize: 13, fontWeight: '600' },

    // Undo banner
    undoBanner: { position: 'absolute', bottom: 104, left: 20, right: 20, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8 },
    undoText:   { color: '#fff', fontSize: 14, fontWeight: '600' },
    undoAction: { color: '#F05B53', fontSize: 14, fontWeight: '800' },

    // FAB
    fab:     { position: 'absolute', bottom: 32, right: 24 },
    fabBtn:  { width: 60, height: 60, borderRadius: 30, backgroundColor: '#00C4A8', alignItems: 'center', justifyContent: 'center', shadowColor: '#00C4A8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
    fabIcon: { color: '#fff', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  });
}
