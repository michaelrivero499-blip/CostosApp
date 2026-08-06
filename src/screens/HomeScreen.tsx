import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, Image, TextInput, Animated, Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCostos } from '../context/CostosContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { useTheme, Theme } from '../context/ThemeContext';
import { SummaryCard, SummaryMenuConfig, SUMMARY_ITEM_H } from '../components/SummaryCard';
import { PersonCard } from '../components/PersonCard';
import { BarChart } from '../components/BarChart';
import { AddPersonModal } from '../components/AddPersonModal';
import { ProUpgradeModal } from '../components/ProUpgradeModal';
import { VoiceDebtModal } from '../components/VoiceDebtModal';
import { MicIcon } from '../components/MicIcon';
import { SearchIcon } from '../components/TabIcons';
import { HomeSkeletonLoader } from '../components/SkeletonLoader';
import { getPersonTotal, formatAmountCurrency, DIRECTION_COLORS, CURRENCY_ORDER, effectiveAmount } from '../utils';
import { IS_PRO_USER, FREE_PERSONS_LIMIT } from '../utils/pro';
import { DebtDirection, PeriodFilter, Currency, Person } from '../types';
import { TabParamList, RootStackParamList } from '../../App';
import { HintTooltip } from '../components/HintTooltip';
import { useHint } from '../hooks/useHint';

// ── Menú flotante (renderizado fuera del ScrollView para evitar clipping) ─────
const MENU_W   = 148;
const C_TEAL_M = '#00C4A8';

type FloatingMenuState = {
  cfg:     SummaryMenuConfig;
  hovered: number;
  pick:    (i: number) => void;
};

/**
 * FloatingMenu — card con efecto frosted glass (BlurView).
 * Sin backdrop: el fondo queda 100% visible e interactivo.
 * Se cierra al seleccionar, al tocar el chip, o al scrollear.
 */
function FloatingMenu({
  state, anim, isDark, subtextColor,
}: {
  state:        FloatingMenuState;
  anim:         Animated.Value;
  isDark:       boolean;
  subtextColor: string;
}) {
  const divider     = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
  const activeColor = isDark ? '#fff' : '#111';

  // Android: elevation fuerza el fondo opaco → usamos dos capas:
  //   1. shadowLayer: View con elevation y fondo opaco, detrás del contenido
  //   2. contentLayer: View con fondo semi-transparente, sin elevation
  // iOS: Animated.View con shadow CSS + BlurView real
  const isAndroid = Platform.OS === 'android';
  const borderClr = isDark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.18)';
  const bgAndroid = isDark ? 'rgba(18,28,44,0.84)'    : 'rgba(246,248,252,0.82)';

  const lastIdx = state.cfg.opts.length - 1;
  const opts = state.cfg.opts.map((opt, i) => {
    const isHov = i === state.hovered;
    const isCur = i === state.cfg.activeIdx;
    // Redondear esquinas del primer y último ítem para que
    // su fondo llegue exactamente hasta el borde del card
    const cornerStyle = i === 0
      ? { borderTopLeftRadius: 13, borderTopRightRadius: 13 }
      : i === lastIdx
        ? { borderBottomLeftRadius: 13, borderBottomRightRadius: 13 }
        : undefined;
    return (
      <TouchableOpacity
        key={i}
        onPress={() => state.pick(i)}
        activeOpacity={0.6}
        style={[
          FM.row,
          isHov && FM.rowHov,
          cornerStyle,
          i < lastIdx && {
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: divider,
          },
        ]}
      >
        <View style={isCur && !isHov ? FM.dot : FM.dotEmpty} />
        <Text numberOfLines={1} style={[FM.label, {
          color:      isHov ? '#fff' : isCur ? (isDark ? '#fff' : '#111') : subtextColor,
          fontWeight: isCur ? '700' : '400',
        }]}>{opt.label}</Text>
      </TouchableOpacity>
    );
  });

  return (
    <Animated.View
      style={[
        FM.positioner,
        { top: state.cfg.y, left: state.cfg.x },
        {
          opacity: anim,
          transform: [
            { translateY: anim.interpolate({ inputRange:[0,1], outputRange:[-6,0] }) },
            { scale:      anim.interpolate({ inputRange:[0,1], outputRange:[0.93,1] }) },
          ],
        },
      ]}
    >
      {isAndroid ? (
        // Android: sin elevation. Borde como overlay encima del contenido para
        // que el fondo de los ítems llegue hasta las esquinas sin gap blanco.
        <View style={[FM.androidContent, { backgroundColor: bgAndroid }]}>
          {opts}
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, FM.border, { borderColor: borderClr }]} />
        </View>
      ) : (
        // iOS: BlurView real
        <View style={FM.iosCard}>
          <BlurView
            tint={isDark ? 'dark' : 'light'}
            intensity={isDark ? 72 : 80}
            style={StyleSheet.absoluteFill}
          />
          <View style={[StyleSheet.absoluteFill, FM.border, { borderColor: borderClr }]} />
          {opts}
        </View>
      )}
    </Animated.View>
  );
}

const FM = StyleSheet.create({
  positioner: {
    position: 'absolute',
    width: MENU_W,
  },
  // Android — sin elevation (elevation fuerza fondo opaco en Android).
  // El borde y el backgroundColor semi-transparente dan el efecto flotante.
  androidContent: {
    borderRadius: 13,
    overflow: 'hidden',
    // sin borderWidth — el borde se aplica como absoluteFill overlay encima
    // para que los fondos de los ítems lleguen hasta las esquinas redondeadas
  },
  // iOS — card con shadow + BlurView
  iosCard: {
    borderRadius: 13,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  border: {
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SUMMARY_ITEM_H,
    paddingHorizontal: 12,
  },
  rowHov:   { backgroundColor: 'rgba(0,196,168,0.88)' },
  label:    { fontSize: 13, flex: 1 },
  dot:      { width: 5, height: 5, borderRadius: 3, backgroundColor: C_TEAL_M, marginRight: 8 },
  dotEmpty: { width: 5, height: 5, marginRight: 8 },
});

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Deudas'>,
  NativeStackScreenProps<RootStackParamList>
>;

function formatRelativeDate(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  if (date.toDateString() === now.toDateString()) return 'Hoy';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Ayer';
  return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
}

export function HomeScreen({ navigation, route }: Props) {
  const { persons, debts, loading, pendingOpsCount, addPerson, updatePerson, updatePersonAvatar, deletePerson, addDebt } = useCostos();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [showAddPerson,   setShowAddPerson]   = useState(false);
  const [showProModal,    setShowProModal]    = useState(false);
  const [proModalReason,  setProModalReason]  = useState<'persons' | 'debts' | 'voice'>('persons');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [confirmDeletePerson, setConfirmDeletePerson] = useState<Person | null>(null);
  const [showVoice, setShowVoice] = useState(false);
  const [newestPersonId, setNewestPersonId] = useState<string | null>(null);
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PeriodFilter>({ mode: 'total' });
  const [currency, setCurrency] = useState<Currency>('ARS');

  // ── Menú flotante del SummaryCard (fuera del ScrollView) ─────────────────
  type MenuKind = 'period' | 'currency';
  const [activeMenu,   setActiveMenu]   = useState<MenuKind | null>(null);
  const [floatingMenu, setFloatingMenu] = useState<FloatingMenuState | null>(null);
  const menuAnim = useRef(new Animated.Value(0)).current;
  const pendingPickRef = useRef<((i: number) => void) | null>(null);

  const handleMenuOpen = useCallback((
    kind: MenuKind,
    cfg: SummaryMenuConfig,
    pick: (i: number) => void,
  ) => {
    pendingPickRef.current = pick;
    setActiveMenu(kind);
    setFloatingMenu({ cfg, hovered: cfg.activeIdx, pick });
    menuAnim.setValue(0);
    Animated.spring(menuAnim, { toValue: 1, friction: 7, tension: 230, useNativeDriver: true }).start();
  }, [menuAnim]);

  const handleMenuClose = useCallback(() => {
    Animated.timing(menuAnim, { toValue: 0, duration: 100, useNativeDriver: true }).start(() => {
      setFloatingMenu(null);
      setActiveMenu(null);
    });
  }, [menuAnim]);

  // -1 = slide released → pick the current hovered
  const handleMenuHover = useCallback((idx: number) => {
    if (idx === -1) {
      // Release after slide — pick current hovered item
      setFloatingMenu(prev => {
        if (prev) pendingPickRef.current?.(prev.hovered);
        return prev;
      });
    } else {
      setFloatingMenu(prev => prev ? { ...prev, hovered: idx } : prev);
    }
  }, []);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const [sortMode, setSortMode] = useState<'default' | 'name' | 'amount' | 'recent'>('default');
  const [debtFilter, setDebtFilter] = useState<'all' | 'me_debe' | 'le_debo'>('all');
  const swipeHint = useHint('home_swipe', 0);
  const micHint   = useHint('mic_feature', 0);

  // ── Animaciones ──────────────────────────────────────────────────────────
  const fabScale  = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(fabScale, {
      toValue: 1, friction: 5, tension: 80, useNativeDriver: true,
    }).start();
  }, []);

  function openSearch() {
    setShowSearch(true);
    Animated.timing(searchAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
  }

  function closeSearch() {
    Animated.timing(searchAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      setShowSearch(false);
      setSearchQuery('');
    });
  }

  useEffect(() => {
    const deletingId = route.params?.deletingPersonId;
    if (deletingId) {
      setDeletingPersonId(deletingId);
      navigation.setParams({ deletingPersonId: undefined });
    }
  }, [route.params?.deletingPersonId]);

  // ── Computaciones memoizadas — SIEMPRE antes de cualquier return condicional ──
  const personDebtsMap = useMemo(
    () => persons.reduce((acc, p) => {
      acc[p.id] = debts.filter(d => d.personId === p.id);
      return acc;
    }, {} as Record<string, typeof debts>),
    [persons, debts],
  );

  const personMap = useMemo(
    () => Object.fromEntries(persons.map(p => [p.id, p])),
    [persons],
  );

  const chartData = useMemo(
    () => persons
      .map(p => {
        const personDebts = (personDebtsMap[p.id] || [])
          .filter(d => (d.currency ?? 'ARS') === currency);
        const net = getPersonTotal(personDebts);
        if (net === 0) return null;
        const direction: DebtDirection = net > 0 ? 'me_debe' : 'le_debo';
        return {
          label: p.name.split(' ')[0],
          value: Math.abs(net),
          direction,
          color: p.color,
          debts: personDebts
            .filter(d => d.status !== 'pagado')
            .map(d => ({ description: d.description, amount: d.amount, direction: d.direction })),
        };
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((a, b) => b.value - a.value),
    [persons, personDebtsMap, currency],
  );

  const query = searchQuery.trim().toLowerCase();
  const isSearching = showSearch && query.length > 0;

  const filteredPersons = useMemo(() => {
    let base = isSearching
      ? persons.filter(p => p.name.toLowerCase().includes(query))
      : [...persons];

    // Filter by debt direction
    if (!isSearching && debtFilter !== 'all') {
      base = base.filter(p => {
        const personDebts = (personDebtsMap[p.id] || []).filter(d => d.status === 'pendiente' && (d.currency ?? 'ARS') === currency);
        const net = getPersonTotal(personDebts);
        if (debtFilter === 'me_debe') return net > 0;
        if (debtFilter === 'le_debo') return net < 0;
        return true;
      });
    }

    if (sortMode === 'name') {
      return [...base].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    }
    if (sortMode === 'amount') {
      return [...base].sort((a, b) => {
        const netA = (personDebtsMap[a.id] || []).filter(d => d.status === 'pendiente').reduce((s, d) => s + (d.direction === 'me_debe' ? d.amount : -d.amount), 0);
        const netB = (personDebtsMap[b.id] || []).filter(d => d.status === 'pendiente').reduce((s, d) => s + (d.direction === 'me_debe' ? d.amount : -d.amount), 0);
        return Math.abs(netB) - Math.abs(netA);
      });
    }
    if (sortMode === 'recent') {
      return [...base].sort((a, b) => {
        const lastA = (personDebtsMap[a.id] || []).reduce((max, d) => Math.max(max, new Date(d.date).getTime()), 0);
        const lastB = (personDebtsMap[b.id] || []).reduce((max, d) => Math.max(max, new Date(d.date).getTime()), 0);
        return lastB - lastA;
      });
    }
    return base;
  }, [persons, personDebtsMap, isSearching, query, debtFilter, currency, sortMode]);

  const debtResults = useMemo(
    () => isSearching
      ? debts
          .filter(d => d.status === 'pendiente' && d.description.toLowerCase().includes(query))
          .map(d => ({ debt: d, person: personMap[d.personId] }))
          .filter((x): x is { debt: typeof x.debt; person: Person } => !!x.person)
      : [],
    [isSearching, debts, query, personMap],
  );

  const recentActivities = useMemo(
    () => debts
      .flatMap(debt => {
        const person = personMap[debt.personId];
        if (!person) return [];
        const evs: { key: string; type: 'added' | 'paid' | 'partial'; debt: typeof debt; person: typeof person; eventDate: string }[] = [];
        evs.push({ key: `a-${debt.id}`, type: 'added', debt, person, eventDate: debt.date });
        if ((debt.paidAmount ?? 0) > 0 && debt.partialPaymentDate) {
          evs.push({ key: `partial-${debt.id}`, type: 'partial', debt, person, eventDate: debt.partialPaymentDate });
        }
        if (debt.status === 'pagado' && debt.paidDate) {
          evs.push({ key: `p-${debt.id}`, type: 'paid', debt, person, eventDate: debt.paidDate });
        }
        return evs;
      })
      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
      .slice(0, 3),
    [debts, personMap],
  );

  const urgentDebts = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return debts
      .filter(d => d.status === 'pendiente' && d.dueDate)
      .map(d => {
        const person = personMap[d.personId];
        if (!person) return null;
        const due = new Date(d.dueDate!);
        due.setHours(0, 0, 0, 0);
        const diffDays = Math.round((due.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays > 7) return null;
        return { debt: d, person, diffDays };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [debts, personMap]);

  // Early return DESPUÉS de todos los hooks
  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <HomeSkeletonLoader />
      </SafeAreaView>
    );
  }

  function openAddPerson() {
    if (!IS_PRO_USER && persons.length >= FREE_PERSONS_LIMIT) {
      setProModalReason('persons');
      setShowProModal(true);
    } else {
      setShowAddPerson(true);
    }
  }

  function openVoice() {
    if (!IS_PRO_USER) {
      setProModalReason('voice');
      setShowProModal(true);
    } else {
      setShowVoice(true);
    }
  }

  async function handleAddPerson(name: string, avatar: string, color: string, photoUri?: string) {
    const newId = await addPerson(name, avatar, color);
    if (newId && photoUri) await updatePersonAvatar(newId, photoUri);
    setNewestPersonId(newId);
    setTimeout(() => setNewestPersonId(null), 600);
  }

  async function handleEditPerson(name: string, avatar: string, color: string, photoUri?: string) {
    if (!editingPerson) return;
    await updatePerson(editingPerson.id, name, avatar, color);
    if (photoUri) await updatePersonAvatar(editingPerson.id, photoUri);
    setEditingPerson(null);
  }

  function handleConfirmDelete() {
    if (!confirmDeletePerson) return;
    setDeletingPersonId(confirmDeletePerson.id);
    setConfirmDeletePerson(null);
  }

  function handleExitComplete(personId: string) {
    deletePerson(personId);
    setDeletingPersonId(null);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        {showSearch ? (
          <Animated.View style={[styles.searchRow, { opacity: searchAnim, transform: [{ translateY: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }]}>
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Buscar personas o deudas..."
              placeholderTextColor={theme.subtext}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchCancelBtn} onPress={closeSearch}>
              <Text style={styles.searchCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <>
            <Image
              source={require('../../assets/vera-logos/vera_logo_256px.png')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.settingsBtn} onPress={openSearch}>
                <SearchIcon size={22} color={theme.subtext} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {pendingOpsCount > 0 && (
        <View style={[styles.syncBanner, { backgroundColor: theme.card }]}>
          <Text style={styles.syncBannerText}>
            ⏳ {pendingOpsCount} cambio{pendingOpsCount !== 1 ? 's' : ''} pendiente{pendingOpsCount !== 1 ? 's' : ''} de sincronizar
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={handleMenuClose}
      >

        {isSearching ? (
          <>
            {filteredPersons.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 16 }]}>PERSONAS</Text>
                {filteredPersons.map(person => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    debts={personDebtsMap[person.id] || []}
                    onPress={() => { setShowSearch(false); setSearchQuery(''); navigation.navigate('PersonDetail', { personId: person.id }); }}
                  />
                ))}
              </>
            )}
            {debtResults.length > 0 && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: filteredPersons.length > 0 ? 16 : 16 }]}>DEUDAS</Text>
                {debtResults.map(({ debt, person }) => (
                  <TouchableOpacity
                    key={debt.id}
                    style={styles.debtResultCard}
                    onPress={() => { setShowSearch(false); setSearchQuery(''); navigation.navigate('PersonDetail', { personId: person.id }); }}
                    activeOpacity={0.7}
                  >
                    {person.avatarUrl ? (
                      <Image source={{ uri: person.avatarUrl }} style={styles.debtResultDot} />
                    ) : (
                      <View style={[styles.debtResultDot, { backgroundColor: person.color }]}>
                        <Text style={{ fontSize: 14 }}>{person.avatar}</Text>
                      </View>
                    )}
                    <View style={styles.debtResultInfo}>
                      <Text style={styles.debtResultPerson}>{person.name}</Text>
                      <Text style={styles.debtResultDesc} numberOfLines={1}>{debt.description}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[styles.debtResultAmount, { color: DIRECTION_COLORS[debt.direction] }]}>
                        {formatAmountCurrency(effectiveAmount(debt), (debt.currency ?? 'ARS') as Currency)}
                      </Text>
                      {(debt.paidAmount ?? 0) > 0 && debt.status === 'pendiente' && (
                        <Text style={{ fontSize: 10, color: theme.subtext, marginTop: 1 }}>
                          de {formatAmountCurrency(debt.amount, (debt.currency ?? 'ARS') as Currency)}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
            {filteredPersons.length === 0 && debtResults.length === 0 && (
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchText}>Sin resultados para "{searchQuery}"</Text>
              </View>
            )}
            <View style={styles.bottomPad} />
          </>
        ) : (
          <>
        <SummaryCard
          debts={debts}
          currency={currency}
          onCurrencyChange={setCurrency}
          filter={filter}
          onFilterChange={setFilter}
          onMenuOpen={handleMenuOpen}
          onMenuHover={handleMenuHover}
          onMenuClose={handleMenuClose}
          activeMenu={activeMenu}
        />

        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={() => navigation.navigate('History', { filter, currency })}
        >
          <Text style={styles.detailsBtnText}>Más detalles →</Text>
        </TouchableOpacity>

        {urgentDebts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>VENCIMIENTOS</Text>
            {urgentDebts.map(({ debt, person, diffDays }) => {
              const isOverdue = diffDays < 0;
              const isToday   = diffDays === 0;
              const urgencyColor = isOverdue ? (theme.isDark ? 'rgba(255,255,255,0.75)' : '#1A1A2E')
                : isToday ? '#F05B53'
                : diffDays <= 3 ? '#FF9500'
                : '#FBBF24';
              const urgencyLabel = isOverdue
                ? `Venció hace ${Math.abs(diffDays)}d`
                : isToday ? 'Vence hoy'
                : `Vence en ${diffDays}d`;
              return (
                <TouchableOpacity
                  key={debt.id}
                  style={styles.urgentCard}
                  onPress={() => navigation.navigate('PersonDetail', { personId: person.id })}
                  activeOpacity={0.7}
                >
                  <View style={[styles.urgentStripe, { backgroundColor: urgencyColor }]} />
                  {person.avatarUrl ? (
                    <Image source={{ uri: person.avatarUrl }} style={styles.urgentAvatarImg} />
                  ) : (
                    <View style={[styles.urgentAvatarInner, { backgroundColor: person.color }]}>
                      <Text style={styles.urgentDotText}>{person.avatar}</Text>
                    </View>
                  )}
                  <View style={styles.urgentInfo}>
                    <Text style={styles.urgentPerson}>{person.name}</Text>
                    <Text style={styles.urgentDesc} numberOfLines={1}>{debt.description}</Text>
                  </View>
                  <View style={styles.urgentRight}>
                    <Text style={[styles.urgentAmount, { color: DIRECTION_COLORS[debt.direction] }]}>
                      {formatAmountCurrency(effectiveAmount(debt), (debt.currency ?? 'ARS') as Currency)}
                    </Text>
                    {(debt.paidAmount ?? 0) > 0 && (
                      <Text style={styles.urgentOriginal}>
                        de {formatAmountCurrency(debt.amount, (debt.currency ?? 'ARS') as Currency)}
                      </Text>
                    )}
                    <View style={[styles.urgentBadge, { backgroundColor: urgencyColor + '20' }]}>
                      <Text style={[styles.urgentBadgeText, { color: urgencyColor }]}>{urgencyLabel}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </>
        )}

        <View style={styles.sectionRow}>
          <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>PERSONAS</Text>
          <View style={styles.sortChips}>
            {([['name', 'A-Z'], ['amount', 'Monto'], ['recent', 'Reciente']] as const).map(([mode, label]) => (
              <TouchableOpacity
                key={mode}
                style={[styles.sortChip, sortMode === mode && styles.sortChipActive]}
                onPress={() => setSortMode(prev => prev === mode ? 'default' : mode)}
                activeOpacity={0.7}
              >
                <Text style={[styles.sortChipText, { color: sortMode === mode ? '#fff' : theme.subtext }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Filtro de dirección */}
        {persons.length > 0 && (
          <View style={styles.dirFilterRow}>
            {([['all', 'Todos'], ['me_debe', '← Me deben'], ['le_debo', '→ Le debo']] as const).map(([f, label]) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.dirFilterChip,
                  debtFilter === f && {
                    backgroundColor: f === 'me_debe' ? '#34C75918' : f === 'le_debo' ? '#F05B5318' : (theme.isDark ? '#2A3A52' : '#1A1A2E'),
                    borderColor: f === 'me_debe' ? '#34C759' : f === 'le_debo' ? '#F05B53' : '#1A1A2E',
                  },
                ]}
                onPress={() => setDebtFilter(prev => prev === f ? 'all' : f)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.dirFilterText,
                  debtFilter === f && {
                    color: f === 'me_debe' ? '#34C759' : f === 'le_debo' ? '#F05B53' : '#fff',
                    fontWeight: '700',
                  },
                ]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {filteredPersons.map((person, index) => (
          <React.Fragment key={person.id}>
            <PersonCard
              person={person}
              debts={personDebtsMap[person.id] || []}
              onPress={() => navigation.navigate('PersonDetail', { personId: person.id })}
              onEdit={() => setEditingPerson(person)}
              onDelete={() => setConfirmDeletePerson(person)}
              isNew={person.id === newestPersonId}
              isExiting={person.id === deletingPersonId}
              onExitComplete={() => handleExitComplete(person.id)}
            />
            {index === 0 && swipeHint.visible && (
              <HintTooltip
                icon="↔️"
                text="Deslizá hacia la izquierda para editar o eliminar una persona."
                onDismiss={swipeHint.dismiss}
                arrow="top"
              />
            )}
          </React.Fragment>
        ))}

        {filteredPersons.length === 0 && !isSearching && debtFilter !== 'all' ? (
          <View style={styles.emptyFilterState}>
            <Text style={[styles.emptyFilterText, { color: theme.subtext }]}>
              {debtFilter === 'me_debe' ? 'Nadie te debe en este momento' : 'No le debés a nadie en este momento'}
            </Text>
            <TouchableOpacity onPress={() => setDebtFilter('all')} style={styles.emptyFilterBtn}>
              <Text style={[styles.emptyFilterBtnText, { color: theme.subtext }]}>Ver todos</Text>
            </TouchableOpacity>
          </View>
        ) : persons.length === 0 ? (
          <View style={styles.emptyPersonsState}>
            <Text style={styles.emptyPersonsEmoji}>👥</Text>
            <Text style={[styles.emptyPersonsTitle, { color: theme.text }]}>¡Bienvenido a Vera!</Text>
            <Text style={[styles.emptyPersonsText, { color: theme.subtext }]}>
              Agregá personas para empezar a registrar deudas. Podés hacerlo por texto o por voz.
            </Text>
            <TouchableOpacity style={styles.emptyPersonsBtn} onPress={openAddPerson} activeOpacity={0.8}>
              <Text style={styles.emptyPersonsBtnText}>+ Agregar primera persona</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addPersonRow} onPress={openAddPerson}>
            <Text style={styles.addPersonText}>+ Agregar persona...</Text>
          </TouchableOpacity>
        )}

        {chartData.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>RESUMEN VISUAL</Text>
            <BarChart data={chartData} currency={currency} />
          </>
        )}

        {recentActivities.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>MOVIMIENTOS</Text>
            {recentActivities.map(({ key, type, debt, person, eventDate }) => {
              const isPaid    = type === 'paid';
              const isPartial = type === 'partial';
              const dirColor  = DIRECTION_COLORS[debt.direction];
              const iconBg    = isPaid ? '#2ED57322' : isPartial ? '#F59E0B22' : '#5E60CE22';
              const iconColor = isPaid ? '#2ED573'   : isPartial ? '#F59E0B'   : '#5E60CE';
              const iconChar  = isPaid ? '✓'         : isPartial ? '½'         : '+';
              const label     = isPaid
                ? `Saldaste deuda con ${person.name}`
                : isPartial
                ? `Pago parcial con ${person.name}`
                : `Agregaste deuda a ${person.name}`;
              const displayAmount = isPartial
                ? formatAmountCurrency(debt.paidAmount!, (debt.currency ?? 'ARS') as Currency)
                : formatAmountCurrency(debt.amount, (debt.currency ?? 'ARS') as Currency);
              const amountColor = isPaid ? '#2ED573' : isPartial ? '#F59E0B' : theme.text;
              return (
                <View key={key} style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: iconBg }]}>
                    <Text style={[styles.activityIconText, { color: iconColor }]}>{iconChar}</Text>
                  </View>
                  <View style={styles.activityContent}>
                    <View style={styles.activityRow}>
                      <Text style={styles.activityLabel} numberOfLines={1}>{label}</Text>
                      <Text style={[styles.activityAmount, { color: amountColor }]}>{displayAmount}</Text>
                    </View>
                    <View style={styles.activityRow}>
                      <Text style={styles.activityDesc} numberOfLines={1}>{debt.description}</Text>
                      <Text style={styles.activityDate}>{formatRelativeDate(eventDate)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
            <TouchableOpacity
              style={styles.detailsBtn}
              onPress={() => navigation.navigate('Movements')}
            >
              <Text style={styles.detailsBtnText}>Ver todos los movimientos →</Text>
            </TouchableOpacity>
          </>
        )}

        <View style={styles.bottomPad} />
          </>
        )}
      </ScrollView>

      {/* Menú flotante — BlurView frosted glass */}
      {floatingMenu && (
        <>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleMenuClose}
          />
          <FloatingMenu
            state={floatingMenu}
            anim={menuAnim}
            isDark={theme.isDark}
            subtextColor={theme.subtext}
          />
        </>
      )}

      {micHint.visible && !showAddPerson && !showVoice && (
        <View style={styles.micHintFloat}>
          <HintTooltip
            icon="🎙️"
            text={'Registrá una deuda por voz. Decí algo como "Juan me debe 500 por el almuerzo" y Vera la agrega automáticamente.'}
            onDismiss={micHint.dismiss}
            arrow="bottom"
          />
        </View>
      )}

      {!showAddPerson && !showVoice && (
        <Animated.View style={[styles.fabRow, { transform: [{ scale: fabScale }] }]}>
          <TouchableOpacity style={styles.fabSecondary} onPress={openAddPerson}>
            <Text style={styles.fabSecondaryText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabMic} onPress={openVoice}>
            <MicIcon size={26} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        </Animated.View>
      )}

      <AddPersonModal
        visible={showAddPerson}
        onClose={() => setShowAddPerson(false)}
        onSave={handleAddPerson}
      />

      <ProUpgradeModal
        visible={showProModal}
        onClose={() => setShowProModal(false)}
        reason={proModalReason}
      />

      <AddPersonModal
        visible={editingPerson !== null}
        onClose={() => setEditingPerson(null)}
        onSave={handleEditPerson}
        initialValues={editingPerson ?? undefined}
      />

      <ConfirmModal
        visible={confirmDeletePerson !== null}
        title={`Eliminar a ${confirmDeletePerson?.name}`}
        message="Se eliminarán también todas sus deudas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeletePerson(null)}
      />

      <VoiceDebtModal
        visible={showVoice}
        onClose={() => setShowVoice(false)}
        persons={persons}
        onSave={async (pid, desc, amount, direction, curr) => {
          await addDebt(pid, desc, amount, direction, curr);
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 16,
    },
    headerLogo: { height: 36, width: 36 },
    settingsBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    micHintFloat: {
      position: 'absolute',
      bottom: 112,
      left: 16,
      right: 16,
    },
    fabRow: {
      position: 'absolute',
      bottom: 32,
      right: 24,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    fabSecondary: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: t.isDark ? t.card : '#1A1A2E',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2,
      shadowRadius: 6,
      elevation: 4,
    },
    fabSecondaryText: { color: '#FFFFFF', fontSize: 24, fontWeight: '300', lineHeight: 28 },
    fabMic: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#00C4A8',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#00C4A8',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
      elevation: 6,
    },
    scroll: { flex: 1 },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '700',
      color: t.subtext,
      letterSpacing: 1,
      marginHorizontal: 16,
      marginBottom: 10,
    },
    addPersonRow: {
      marginHorizontal: 16,
      marginTop: 4,
      borderWidth: 1.5,
      borderColor: t.border,
      borderStyle: 'dashed',
      borderRadius: 12,
      padding: 14,
      alignItems: 'center',
    },
    addPersonText: { fontSize: 14, color: t.subtext },
    bottomPad: { height: 110 },
    detailsBtn: {
      alignSelf: 'flex-end',
      marginRight: 16,
      marginBottom: 18,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    detailsBtnText: { fontSize: 13, color: t.subtext, fontWeight: '500' },
    activityItem: {
      backgroundColor: t.card,
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    activityIcon: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    activityIconText: { fontSize: 14, fontWeight: '700' },
    activityContent: { flex: 1, gap: 2 },
    activityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    activityLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: t.text,
      flex: 1,
      marginRight: 8,
    },
    activityAmount: { fontSize: 14, fontWeight: '700' },
    activityDesc: { fontSize: 12, color: t.subtext, flex: 1 },
    activityDate: { fontSize: 11, color: t.subtext },
    urgentCard: {
      backgroundColor: t.card,
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
      overflow: 'hidden',
    },
    urgentStripe: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    urgentAvatarImg: {
      width: 36,
      height: 36,
      borderRadius: 18,
      marginLeft: 6,
    },
    urgentAvatarInner: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 6,
    },
    urgentDotText: { fontSize: 15 },
    urgentInfo: { flex: 1 },
    urgentPerson: { fontSize: 13, fontWeight: '700', color: t.text, marginBottom: 2 },
    urgentDesc: { fontSize: 12, color: t.subtext },
    urgentRight: { alignItems: 'flex-end', gap: 4 },
    urgentAmount: { fontSize: 14, fontWeight: '700' },
    urgentOriginal: { fontSize: 10, color: t.subtext, marginTop: 1 },
    urgentBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
    urgentBadgeText: { fontSize: 11, fontWeight: '700' },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    searchRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    searchInput: {
      flex: 1,
      height: 36,
      backgroundColor: t.isDark ? t.card : '#F0F0F5',
      borderRadius: 10,
      paddingHorizontal: 12,
      fontSize: 15,
      color: t.text,
    },
    searchCancelBtn: {
      paddingLeft: 10,
    },
    searchCancelText: {
      fontSize: 14,
      color: t.subtext,
      fontWeight: '500',
    },
    debtResultCard: {
      backgroundColor: t.card,
      borderRadius: 12,
      marginHorizontal: 16,
      marginBottom: 8,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    },
    debtResultDot: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    debtResultInfo: { flex: 1 },
    debtResultPerson: { fontSize: 12, fontWeight: '600', color: t.subtext, marginBottom: 2 },
    debtResultDesc: { fontSize: 14, fontWeight: '500', color: t.text },
    debtResultAmount: { fontSize: 14, fontWeight: '700' },
    emptySearch: {
      alignItems: 'center',
      paddingTop: 60,
    },
    emptySearchText: { fontSize: 14, color: t.subtext },
    syncBanner: {
      marginHorizontal: 16, marginBottom: 6, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 6,
    },
    syncBannerText: { fontSize: 12, color: '#F59E0B', fontWeight: '500' },
    sectionRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', marginBottom: 4,
      paddingRight: 16,
    },
    sortChips: { flexDirection: 'row', gap: 6 },
    sortChip: {
      paddingHorizontal: 10, paddingVertical: 4,
      borderRadius: 12, backgroundColor: t.isDark ? t.card : '#F0F0F5',
    },
    sortChipActive: { backgroundColor: '#00C4A8' },
    sortChipText: { fontSize: 11, fontWeight: '600' },

    // Direction filter
    dirFilterRow:  { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 10, marginTop: 4 },
    dirFilterChip: {
      paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
      borderWidth: 1.5, borderColor: t.border,
      backgroundColor: t.isDark ? t.card : '#F5F5F8',
    },
    dirFilterText: { fontSize: 12, fontWeight: '600', color: t.subtext },

    // Empty states
    emptyFilterState:   { alignItems: 'center', paddingVertical: 24, gap: 10 },
    emptyFilterText:    { fontSize: 14, fontWeight: '500', textAlign: 'center' },
    emptyFilterBtn:     { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: t.border },
    emptyFilterBtnText: { fontSize: 13, fontWeight: '600' },
    emptyPersonsState:  { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 32, gap: 8 },
    emptyPersonsEmoji:  { fontSize: 52, marginBottom: 4 },
    emptyPersonsTitle:  { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    emptyPersonsText:   { fontSize: 14, color: t.subtext, textAlign: 'center', lineHeight: 20 },
    emptyPersonsBtn:    { marginTop: 12, backgroundColor: '#00C4A8', borderRadius: 24, paddingHorizontal: 28, paddingVertical: 13 },
    emptyPersonsBtnText:{ color: '#fff', fontSize: 15, fontWeight: '700' },
  });
}
