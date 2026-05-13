import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Easing, Linking,
} from 'react-native';
import { Swipeable, RectButton } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCostos } from '../context/CostosContext';
import { useTheme, Theme } from '../context/ThemeContext';
import { AddDebtModal } from '../components/AddDebtModal';
import { VoiceDebtModal } from '../components/VoiceDebtModal';
import { MicIcon } from '../components/MicIcon';
import { StatusPickerModal } from '../components/StatusPickerModal';
import { ConfirmModal } from '../components/ConfirmModal';
import {
  getPersonNetByCurrency, formatAmountCurrency,
  STATUS_COLORS, DIRECTION_COLORS, CURRENCY_SYMBOLS, CURRENCY_ORDER,
} from '../utils';
import { Debt, DebtStatus, DebtDirection, Person, Currency } from '../types';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonDetail'>;

export function PersonDetailScreen({ route, navigation }: Props) {
  const { personId } = route.params;
  const { persons, debts, addDebt, updateDebtStatus, updateDebt, deleteDebt } = useCostos();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [showAddDebt, setShowAddDebt] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Debt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [editTarget, setEditTarget] = useState<Debt | null>(null);
  const [showDeletePerson, setShowDeletePerson] = useState(false);
  const [newestDebtId, setNewestDebtId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  const headerAnim      = useRef(new Animated.Value(0)).current;
  const profileCardAnim = useRef(new Animated.Value(0)).current;
  const debtAnimMapRef  = useRef<Map<string, Animated.Value>>(new Map());
  const initialDebtIdsRef = useRef<Set<string> | null>(null);

  const maybePerson = persons.find(p => p.id === personId);
  if (!maybePerson) return null;
  const person: Person = maybePerson;

  const personDebts  = debts.filter(d => d.personId === personId);
  const activeDebts  = personDebts.filter(d => d.status !== 'pagado');
  const paidDebts    = personDebts.filter(d => d.status === 'pagado');
  const allDebts     = [...activeDebts, ...paidDebts];
  const currencyNets = getPersonNetByCurrency(personDebts);

  const sortedActiveDebts = [...activeDebts].sort((a, b) => {
    const ca = CURRENCY_ORDER.indexOf((a.currency ?? 'ARS') as Currency);
    const cb = CURRENCY_ORDER.indexOf((b.currency ?? 'ARS') as Currency);
    if (ca !== cb) return ca - cb;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const hasMultipleCurrencies = new Set(activeDebts.map(d => d.currency ?? 'ARS')).size > 1;

  if (initialDebtIdsRef.current === null) {
    initialDebtIdsRef.current = new Set(allDebts.map(d => d.id));
  }

  allDebts.forEach(debt => {
    if (!debtAnimMapRef.current.has(debt.id)) {
      const isInitial = initialDebtIdsRef.current!.has(debt.id);
      debtAnimMapRef.current.set(debt.id, new Animated.Value(isInitial ? 0 : 1));
    }
  });

  useEffect(() => {
    const initialAnims = [...initialDebtIdsRef.current!]
      .map(id => debtAnimMapRef.current.get(id))
      .filter((v): v is Animated.Value => v !== undefined);

    Animated.stagger(50, [
      Animated.timing(headerAnim, {
        toValue: 1, duration: 300,
        easing: Easing.out(Easing.ease), useNativeDriver: true,
      }),
      Animated.timing(profileCardAnim, {
        toValue: 1, duration: 300,
        easing: Easing.out(Easing.ease), useNativeDriver: true,
      }),
      ...initialAnims.map(anim =>
        Animated.timing(anim, {
          toValue: 1, duration: 280,
          easing: Easing.out(Easing.ease), useNativeDriver: true,
        })
      ),
    ]).start();
  }, []);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }

  function confirmDeleteDebt() {
    if (!deleteTarget) return;
    deleteDebt(deleteTarget.id);
    setDeleteTarget(null);
  }

  function confirmDeletePerson() {
    setShowDeletePerson(false);
    navigation.navigate('Home', { deletingPersonId: personId });
  }

  async function handleAddDebt(desc: string, amount: number, direction: DebtStatus | any, currency: Currency) {
    const newId = await addDebt(personId, desc, amount, direction, currency);
    setNewestDebtId(newId);
    setTimeout(() => setNewestDebtId(null), 600);
  }

  async function handleEditDebt(desc: string, amount: number, direction: DebtDirection, currency: Currency) {
    if (!editTarget) return;
    await updateDebt(editTarget.id, desc, amount, direction, currency);
    setEditTarget(null);
  }

  function handleWhatsApp() {
    const pendingDebts = personDebts.filter(d => d.status === 'pendiente');

    let message: string;
    if (currencyNets.length === 0) {
      message = `Hola ${person.name}! Estamos al día, no hay deudas pendientes entre nosotros.`;
    } else if (currencyNets.length === 1) {
      const { net, currency } = currencyNets[0];
      const amount = formatAmountCurrency(Math.abs(net), currency);
      message = net > 0
        ? `Hola ${person.name}! Te paso a recordar que me debés ${amount} para saldar todo lo que tenemos pendiente.`
        : `Hola ${person.name}! Te paso a recordar que te debo ${amount} para saldar todo lo que tenemos pendiente.`;
    } else {
      const lines = currencyNets.map(({ net, currency }) => {
        const amount = formatAmountCurrency(Math.abs(net), currency);
        return net > 0 ? `• ${amount} me debés` : `• ${amount} te debo`;
      });
      message = `Hola ${person.name}! Te paso a recordar las deudas pendientes:\n${lines.join('\n')}`;
    }

    if (pendingDebts.length > 0) {
      message += '\n\n' + pendingDebts
        .map(d => `• ${d.description} - ${formatAmountCurrency(d.amount, (d.currency ?? 'ARS') as Currency)}`)
        .join('\n');
    }

    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`).catch(() => {});
  }

  function handleStatusSelect(debtId: string, status: DebtStatus) {
    if (status === 'pagado') {
      setMarkingPaidId(debtId);
      setTimeout(() => {
        updateDebtStatus(debtId, status);
        setMarkingPaidId(null);
      }, 320);
    } else {
      updateDebtStatus(debtId, status);
    }
    setStatusTarget(null);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.header, {
        opacity: headerAnim,
        transform: [{ translateY: headerAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }],
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{person.name}</Text>
        <TouchableOpacity onPress={() => setShowDeletePerson(true)} style={styles.deletePersonBtn}>
          <Text style={styles.deletePersonText}>🗑</Text>
        </TouchableOpacity>
      </Animated.View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={{
          opacity: profileCardAnim,
          transform: [{ translateY: profileCardAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
        }}>
          <View style={styles.profileCard}>
            <View style={[styles.avatar, { backgroundColor: person.color }]}>
              <Text style={styles.avatarEmoji}>{person.avatar}</Text>
            </View>
            <Text style={styles.name}>{person.name}</Text>
            <Text style={styles.totalLabel}>Neto activo</Text>

            {currencyNets.length === 0 ? (
              <Text style={styles.totalAmountZero}>Al día</Text>
            ) : currencyNets.map(({ net, currency }) => (
              <View key={currency} style={styles.currencyNetRow}>
                <Text style={[
                  styles.totalAmount,
                  { color: net > 0 ? DIRECTION_COLORS.me_debe : DIRECTION_COLORS.le_debo },
                ]}>
                  {formatAmountCurrency(Math.abs(net), currency)}
                </Text>
                <View style={[
                  styles.netBadge,
                  { backgroundColor: (net > 0 ? DIRECTION_COLORS.me_debe : DIRECTION_COLORS.le_debo) + '18' },
                ]}>
                  <Text style={[
                    styles.netBadgeText,
                    { color: net > 0 ? DIRECTION_COLORS.me_debe : DIRECTION_COLORS.le_debo },
                  ]}>
                    {net > 0 ? 'me debe' : 'le debo'}
                  </Text>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.whatsappBtn} onPress={handleWhatsApp} activeOpacity={0.8}>
              <Text style={styles.whatsappBtnText}>💬  Enviar recordatorio</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {activeDebts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>ACTIVAS</Text>
            {sortedActiveDebts.map((debt, idx) => {
              const debtCurrency = (debt.currency ?? 'ARS') as Currency;
              const prevCurrency = idx > 0
                ? ((sortedActiveDebts[idx - 1].currency ?? 'ARS') as Currency)
                : null;
              const showCurrencyHeader = hasMultipleCurrencies && debtCurrency !== prevCurrency;

              return (
                <React.Fragment key={debt.id}>
                  {showCurrencyHeader && (
                    <Text style={styles.currencyHeader}>
                      {CURRENCY_SYMBOLS[debtCurrency]} {debtCurrency}
                    </Text>
                  )}
                  <AnimatedDebtRow
                    debt={debt}
                    entranceAnim={debtAnimMapRef.current.get(debt.id) ?? new Animated.Value(1)}
                    isNew={debt.id === newestDebtId}
                    isMarkingPaid={debt.id === markingPaidId}
                    onPress={() => setStatusTarget(debt)}
                    onLongPress={() => setEditTarget(debt)}
                    onDelete={() => setDeleteTarget(debt)}
                    formatDate={formatDate}
                  />
                </React.Fragment>
              );
            })}
          </>
        )}

        {paidDebts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>PAGADAS</Text>
            {paidDebts.map(debt => (
              <AnimatedDebtRow
                key={debt.id}
                debt={debt}
                entranceAnim={debtAnimMapRef.current.get(debt.id) ?? new Animated.Value(1)}
                isNew={false}
                isMarkingPaid={false}
                onPress={() => setStatusTarget(debt)}
                onLongPress={() => setEditTarget(debt)}
                onDelete={() => setDeleteTarget(debt)}
                formatDate={formatDate}
              />
            ))}
          </>
        )}

        {personDebts.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>Sin deudas aún</Text>
            <Text style={styles.emptySubtext}>Tocá + para agregar la primera</Text>
          </View>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      {!showAddDebt && !showVoice && statusTarget === null && deleteTarget === null && editTarget === null && !showDeletePerson && (
        <View style={styles.fabRow}>
          <TouchableOpacity style={styles.fab} onPress={() => setShowAddDebt(true)}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabMic} onPress={() => setShowVoice(true)}>
            <MicIcon size={26} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      <AddDebtModal
        visible={showAddDebt}
        personName={person.name}
        onClose={() => setShowAddDebt(false)}
        onSave={handleAddDebt}
      />

      <AddDebtModal
        visible={editTarget !== null}
        personName={person.name}
        onClose={() => setEditTarget(null)}
        onSave={handleEditDebt}
        initialValues={editTarget ? {
          description: editTarget.description,
          amount: editTarget.amount,
          direction: editTarget.direction,
          currency: editTarget.currency ?? 'ARS',
        } : undefined}
      />

      <VoiceDebtModal
        visible={showVoice}
        onClose={() => setShowVoice(false)}
        personId={personId}
        personName={person.name}
        onSave={async (pid, desc, amount, direction, currency) => {
          await addDebt(pid, desc, amount, direction, currency);
        }}
      />

      <StatusPickerModal
        visible={statusTarget !== null}
        debt={statusTarget}
        onSelect={handleStatusSelect}
        onClose={() => setStatusTarget(null)}
      />

      <ConfirmModal
        visible={deleteTarget !== null}
        title="Eliminar deuda"
        message={`¿Querés eliminar "${deleteTarget?.description}"? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={confirmDeleteDebt}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        visible={showDeletePerson}
        title={`Eliminar a ${person.name}`}
        message="Se eliminarán también todas sus deudas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={confirmDeletePerson}
        onCancel={() => setShowDeletePerson(false)}
      />
    </SafeAreaView>
  );
}

// ─── Animated debt row ──────────────────────────────────────────────────────

function AnimatedDebtRow({
  debt, entranceAnim, isNew, isMarkingPaid, onPress, onLongPress, onDelete, formatDate,
}: {
  debt: Debt;
  entranceAnim: Animated.Value;
  isNew: boolean;
  isMarkingPaid: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onDelete: () => void;
  formatDate: (iso: string) => string;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const swipeableRef = useRef<Swipeable>(null);
  const slideAnim    = useRef(new Animated.Value(isNew ? 30 : 0)).current;
  const opacityAnim  = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const rowOpacity   = useRef(new Animated.Value(1)).current;

  function renderRightActions() {
    return (
      <View style={styles.swipeActionsContainer}>
        <RectButton
          style={[styles.swipeAction, styles.swipeActionEdit]}
          onPress={() => { swipeableRef.current?.close(); onLongPress(); }}
        >
          <Text style={styles.swipeActionText}>Editar</Text>
        </RectButton>
        <RectButton
          style={[styles.swipeAction, styles.swipeActionDelete]}
          onPress={() => { swipeableRef.current?.close(); onDelete(); }}
        >
          <Text style={styles.swipeActionText}>Eliminar</Text>
        </RectButton>
      </View>
    );
  }

  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
  }, []);

  useEffect(() => {
    if (isMarkingPaid) {
      Animated.sequence([
        Animated.timing(checkOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(checkOpacity, { toValue: 0, duration: 120, useNativeDriver: true }),
          Animated.timing(rowOpacity, { toValue: 0, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        ]),
      ]).start();
    }
  }, [isMarkingPaid]);

  const isPaid      = debt.status === 'pagado';
  const statusColor = STATUS_COLORS[debt.status];
  const dirColor    = DIRECTION_COLORS[debt.direction];
  const dirLabel    = debt.direction === 'me_debe' ? '→ Me debe' : '← Le debo';
  const debtCurrency = (debt.currency ?? 'ARS') as Currency;

  const containerStyle = isNew
    ? { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }
    : {
        opacity: Animated.multiply(entranceAnim, rowOpacity),
        transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      };

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={renderRightActions}
    >
      <Animated.View style={[containerStyle, { position: 'relative' }]}>
        <TouchableOpacity style={styles.debtCard} onPress={onPress} onLongPress={onLongPress} activeOpacity={0.7}>
          <View style={[styles.statusIndicator, { backgroundColor: dirColor }]} />
          <View style={styles.debtInfo}>
            <Text style={[styles.debtDesc, isPaid && styles.strikethrough]}>{debt.description}</Text>
            <View style={styles.debtMeta}>
              <Text style={styles.debtDate}>{formatDate(debt.date)}</Text>
              <View style={[styles.directionBadge, { backgroundColor: dirColor + '18' }]}>
                <Text style={[styles.directionBadgeText, { color: dirColor }]}>{dirLabel}</Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                <Text style={[styles.statusBadgeText, { color: statusColor }]}>{debt.status}</Text>
              </View>
            </View>
          </View>
          <View style={styles.debtRight}>
            <Text style={[styles.debtAmount, isPaid && styles.amountPaid]}>
              {formatAmountCurrency(debt.amount, debtCurrency)}
            </Text>
          </View>
        </TouchableOpacity>

        <Animated.View style={[styles.paidOverlay, { opacity: checkOpacity }]}>
          <Text style={styles.paidCheckText}>✓</Text>
        </Animated.View>
      </Animated.View>
    </Swipeable>
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
    deletePersonBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    deletePersonText: { fontSize: 18 },
    scroll: { flex: 1 },
    profileCard: {
      alignItems: 'center',
      backgroundColor: t.card,
      marginHorizontal: 16, marginBottom: 20, borderRadius: 16, padding: 24,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
    avatarEmoji: { fontSize: 30 },
    name: { fontSize: 20, fontWeight: '700', color: t.text, marginBottom: 8 },
    totalLabel: { fontSize: 12, color: t.subtext, marginBottom: 8 },
    totalAmountZero: { fontSize: 22, fontWeight: '700', color: t.subtext, marginBottom: 4 },
    currencyNetRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
    totalAmount: { fontSize: 26, fontWeight: '800' },
    netBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    netBadgeText: { fontSize: 11, fontWeight: '700' },
    currencyHeader: {
      fontSize: 10, fontWeight: '700', color: t.subtext,
      letterSpacing: 1, marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    },
    sectionTitle: {
      fontSize: 11, fontWeight: '700', color: t.subtext,
      letterSpacing: 1, marginHorizontal: 16, marginBottom: 8,
    },
    debtCard: {
      backgroundColor: t.card, borderRadius: 12,
      marginHorizontal: 16, marginBottom: 8, padding: 14,
      flexDirection: 'row', alignItems: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
    },
    statusIndicator: { width: 4, height: '100%', borderRadius: 2, marginRight: 12, minHeight: 36 },
    debtInfo: { flex: 1 },
    debtDesc: { fontSize: 15, fontWeight: '500', color: t.text, marginBottom: 4 },
    strikethrough: { textDecorationLine: 'line-through', color: t.subtext },
    debtMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    debtDate: { fontSize: 12, color: t.subtext },
    directionBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    directionBadgeText: { fontSize: 10, fontWeight: '600' },
    statusBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    statusBadgeText: { fontSize: 10, fontWeight: '600' },
    debtRight: { alignItems: 'flex-end', marginLeft: 8 },
    debtAmount: { fontSize: 15, fontWeight: '700', color: t.text },
    amountPaid: { color: t.subtext, textDecorationLine: 'line-through' },
    swipeActionsContainer: {
      flexDirection: 'row',
      marginRight: 16,
      marginBottom: 8,
    },
    swipeAction: {
      width: 80,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swipeActionEdit: {
      backgroundColor: '#3B82F6',
    },
    swipeActionDelete: {
      backgroundColor: '#F05B53',
      borderTopRightRadius: 12,
      borderBottomRightRadius: 12,
    },
    swipeActionText: {
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '700' as const,
    },
    paidOverlay: {
      position: 'absolute', top: 0, left: 16, right: 0, bottom: 8,
      backgroundColor: '#34C759', borderRadius: 12,
      alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none',
    },
    paidCheckText: { color: '#FFFFFF', fontSize: 32, fontWeight: '700' },
    emptyState: { alignItems: 'center', paddingTop: 60 },
    emptyIcon: { fontSize: 48, marginBottom: 12 },
    emptyText: { fontSize: 18, fontWeight: '600', color: t.text, marginBottom: 4 },
    emptySubtext: { fontSize: 14, color: t.subtext },
    fabRow: {
      position: 'absolute', bottom: 32, right: 24,
      flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    fab: {
      width: 52, height: 52, borderRadius: 26,
      backgroundColor: t.isDark ? t.card : '#1A1A2E',
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.2, shadowRadius: 6, elevation: 4,
    },
    fabText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', lineHeight: 32 },
    fabMic: {
      width: 60, height: 60, borderRadius: 30, backgroundColor: '#F05B53',
      alignItems: 'center', justifyContent: 'center',
      shadowColor: '#F05B53', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
    },
    bottomPad: { height: 100 },
    whatsappBtn: {
      marginTop: 16, backgroundColor: '#25D366',
      paddingHorizontal: 20, paddingVertical: 11, borderRadius: 24,
      shadowColor: '#25D366', shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.35, shadowRadius: 6, elevation: 4,
    },
    whatsappBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  });
}
