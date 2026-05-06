import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCostos } from '../context/CostosContext';
import { AddDebtModal } from '../components/AddDebtModal';
import { StatusPickerModal } from '../components/StatusPickerModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { formatAmount, getPersonTotal, STATUS_COLORS, DIRECTION_COLORS } from '../utils';
import { Debt, DebtStatus, Person } from '../types';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'PersonDetail'>;

export function PersonDetailScreen({ route, navigation }: Props) {
  const { personId } = route.params;
  const { persons, debts, addDebt, updateDebtStatus, deleteDebt } = useCostos();

  const [showAddDebt, setShowAddDebt] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Debt | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Debt | null>(null);
  const [showDeletePerson, setShowDeletePerson] = useState(false);
  const [newestDebtId, setNewestDebtId] = useState<string | null>(null);
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  // Staggered entrance animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const profileCardAnim = useRef(new Animated.Value(0)).current;

  // Map debtId → Animated.Value; initial debts start at 0 (stagger), later ones start at 1
  const debtAnimMapRef = useRef<Map<string, Animated.Value>>(new Map());
  const initialDebtIdsRef = useRef<Set<string> | null>(null);

  const maybePerson = persons.find(p => p.id === personId);
  if (!maybePerson) return null;
  const person: Person = maybePerson;

  const personDebts = debts.filter(d => d.personId === personId);
  const total = getPersonTotal(personDebts);
  const activeDebts = personDebts.filter(d => d.status !== 'pagado');
  const paidDebts = personDebts.filter(d => d.status === 'pagado');
  const allDebts = [...activeDebts, ...paidDebts];

  // Capture initial debt IDs on first render
  if (initialDebtIdsRef.current === null) {
    initialDebtIdsRef.current = new Set(allDebts.map(d => d.id));
  }

  // Register anim values for any debt not yet in the map
  allDebts.forEach(debt => {
    if (!debtAnimMapRef.current.has(debt.id)) {
      const isInitial = initialDebtIdsRef.current!.has(debt.id);
      // Initial debts: animate from 0 via stagger. New debts: start at 1 (they use their own isNew anim)
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
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
  }

  function confirmDeleteDebt() {
    if (!deleteTarget) return;
    deleteDebt(deleteTarget.id);
    setDeleteTarget(null);
  }

  function confirmDeletePerson() {
    setShowDeletePerson(false);
    // Navigate back passing the ID so HomeScreen handles the exit animation + deletion
    navigation.navigate('Home', { deletingPersonId: personId });
  }

  async function handleAddDebt(desc: string, amount: number, direction: any) {
    const newId = await addDebt(personId, desc, amount, direction);
    setNewestDebtId(newId);
    setTimeout(() => setNewestDebtId(null), 600);
  }

  function handleStatusSelect(debtId: string, status: DebtStatus) {
    if (status === 'pagado') {
      setMarkingPaidId(debtId);
      // Delay actual update to let animation play
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
            <Text style={[
              styles.totalAmount,
              { color: total > 0 ? DIRECTION_COLORS.me_debe : total < 0 ? DIRECTION_COLORS.le_debo : '#8E8E93' },
            ]}>
              {formatAmount(total)}
            </Text>
            {total !== 0 && (
              <Text style={[styles.netLabel, { color: total > 0 ? DIRECTION_COLORS.me_debe : DIRECTION_COLORS.le_debo }]}>
                {total > 0 ? 'me debe' : 'le debo'}
              </Text>
            )}
          </View>
        </Animated.View>

        {activeDebts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>ACTIVAS</Text>
            {activeDebts.map(debt => (
              <AnimatedDebtRow
                key={debt.id}
                debt={debt}
                entranceAnim={debtAnimMapRef.current.get(debt.id) ?? new Animated.Value(1)}
                isNew={debt.id === newestDebtId}
                isMarkingPaid={debt.id === markingPaidId}
                onPress={() => setStatusTarget(debt)}
                onDelete={() => setDeleteTarget(debt)}
                formatDate={formatDate}
              />
            ))}
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

      {!showAddDebt && statusTarget === null && deleteTarget === null && !showDeletePerson && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowAddDebt(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <AddDebtModal
        visible={showAddDebt}
        personName={person.name}
        onClose={() => setShowAddDebt(false)}
        onSave={handleAddDebt}
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
  debt,
  entranceAnim,
  isNew,
  isMarkingPaid,
  onPress,
  onDelete,
  formatDate,
}: {
  debt: Debt;
  entranceAnim: Animated.Value;
  isNew: boolean;
  isMarkingPaid: boolean;
  onPress: () => void;
  onDelete: () => void;
  formatDate: (iso: string) => string;
}) {
  const slideAnim = useRef(new Animated.Value(isNew ? 30 : 0)).current;
  const opacityAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  const checkOpacity = useRef(new Animated.Value(0)).current;
  const rowOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isNew) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0, duration: 250,
          easing: Easing.out(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1, duration: 250,
          easing: Easing.out(Easing.ease), useNativeDriver: true,
        }),
      ]).start();
    }
  }, []);

  useEffect(() => {
    if (isMarkingPaid) {
      Animated.sequence([
        Animated.timing(checkOpacity, {
          toValue: 1, duration: 100,
          useNativeDriver: true,
        }),
        Animated.delay(150),
        Animated.parallel([
          Animated.timing(checkOpacity, {
            toValue: 0, duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(rowOpacity, {
            toValue: 0, duration: 300,
            easing: Easing.out(Easing.ease), useNativeDriver: true,
          }),
        ]),
      ]).start();
    }
  }, [isMarkingPaid]);

  const isPaid = debt.status === 'pagado';
  const statusColor = STATUS_COLORS[debt.status];
  const dirColor = DIRECTION_COLORS[debt.direction];
  const dirLabel = debt.direction === 'me_debe' ? '→ Me debe' : '← Le debo';

  // For entrance: use entranceAnim (stagger) only when not isNew; isNew uses its own anim
  const containerStyle = isNew
    ? { opacity: opacityAnim, transform: [{ translateY: slideAnim }] }
    : {
        opacity: Animated.multiply(entranceAnim, rowOpacity),
        transform: [{ translateY: entranceAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      };

  return (
    <Animated.View style={[containerStyle, { position: 'relative' }]}>
      <TouchableOpacity style={styles.debtCard} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.statusIndicator, { backgroundColor: dirColor }]} />
        <View style={styles.debtInfo}>
          <Text style={[styles.debtDesc, isPaid && styles.strikethrough]}>
            {debt.description}
          </Text>
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
            {formatAmount(debt.amount)}
          </Text>
          <TouchableOpacity
            onPress={onDelete}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.deleteIcon}>×</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {/* Green check overlay for paid animation */}
      <Animated.View style={[styles.paidOverlay, { opacity: checkOpacity }]}>
        <Text style={styles.paidCheckText}>✓</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backArrow: {
    fontSize: 24,
    color: '#1A1A2E',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
  },
  deletePersonBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deletePersonText: {
    fontSize: 18,
  },
  scroll: {
    flex: 1,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 20,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  avatarEmoji: {
    fontSize: 30,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 4,
  },
  totalAmount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F05B53',
  },
  netLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  debtCard: {
    backgroundColor: '#FFFFFF',
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
  statusIndicator: {
    width: 4,
    height: '100%',
    borderRadius: 2,
    marginRight: 12,
    minHeight: 36,
  },
  debtInfo: {
    flex: 1,
  },
  debtDesc: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
    color: '#8E8E93',
  },
  debtMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  debtDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  directionBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  directionBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  debtRight: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 8,
  },
  debtAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  amountPaid: {
    color: '#8E8E93',
    textDecorationLine: 'line-through',
  },
  deleteIcon: {
    fontSize: 22,
    color: '#C7C7CC',
  },
  paidOverlay: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 0,
    bottom: 8,
    backgroundColor: '#34C759',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  paidCheckText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F05B53',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F05B53',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '300',
    lineHeight: 34,
  },
  bottomPad: {
    height: 100,
  },
});
