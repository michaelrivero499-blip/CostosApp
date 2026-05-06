import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Animated, Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCostos } from '../context/CostosContext';
import { SummaryCard } from '../components/SummaryCard';
import { PersonCard } from '../components/PersonCard';
import { BarChart } from '../components/BarChart';
import { AddPersonModal } from '../components/AddPersonModal';
import { getPersonTotal } from '../utils';
import { DebtDirection } from '../types';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation, route }: Props) {
  const { persons, debts, loading, addPerson, deletePerson } = useCostos();
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [newestPersonId, setNewestPersonId] = useState<string | null>(null);
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null);

  // + button rotation animation
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: showAddPerson ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [showAddPerson]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] });

  // Handle deletion triggered from PersonDetailScreen
  useEffect(() => {
    const deletingId = route.params?.deletingPersonId;
    if (deletingId) {
      setDeletingPersonId(deletingId);
      navigation.setParams({ deletingPersonId: undefined });
    }
  }, [route.params?.deletingPersonId]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#F05B53" />
      </View>
    );
  }

  const personDebtsMap = persons.reduce((acc, p) => {
    acc[p.id] = debts.filter(d => d.personId === p.id);
    return acc;
  }, {} as Record<string, typeof debts>);

  const totalAmount = persons.reduce((sum, p) => sum + getPersonTotal(personDebtsMap[p.id] || []), 0);
  const totalActiveDebts = debts.filter(d => d.status !== 'pagado').length;
  const pendingPersonCount = persons.filter(p =>
    (personDebtsMap[p.id] || []).some(d => d.status === 'pendiente')
  ).length;

  const chartData = persons
    .map(p => {
      const personDebts = personDebtsMap[p.id] || [];
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
    .sort((a, b) => b.value - a.value);

  async function handleAddPerson(name: string, avatar: string, color: string) {
    const newId = await addPerson(name, avatar, color);
    setNewestPersonId(newId);
    setTimeout(() => setNewestPersonId(null), 600);
  }

  function handleExitComplete(personId: string) {
    deletePerson(personId);
    setDeletingPersonId(null);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Costos 💸</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddPerson(true)}>
          <Animated.Text style={[styles.addBtnText, { transform: [{ rotate }] }]}>+</Animated.Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <SummaryCard
          total={totalAmount}
          personCount={persons.length}
          debtCount={totalActiveDebts}
          pendingPersonCount={pendingPersonCount}
        />

        <Text style={styles.sectionTitle}>PERSONAS</Text>

        {persons.map(person => (
          <PersonCard
            key={person.id}
            person={person}
            debts={personDebtsMap[person.id] || []}
            onPress={() => navigation.navigate('PersonDetail', { personId: person.id })}
            isNew={person.id === newestPersonId}
            isExiting={person.id === deletingPersonId}
            onExitComplete={() => handleExitComplete(person.id)}
          />
        ))}

        <TouchableOpacity style={styles.addPersonRow} onPress={() => setShowAddPerson(true)}>
          <Text style={styles.addPersonText}>+ Agregar persona...</Text>
        </TouchableOpacity>

        {chartData.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>RESUMEN VISUAL</Text>
            <BarChart data={chartData} />
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>

      <AddPersonModal
        visible={showAddPerson}
        onClose={() => setShowAddPerson(false)}
        onSave={handleAddPerson}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A1A2E',
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F05B53',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '300',
    lineHeight: 28,
  },
  scroll: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  addPersonRow: {
    marginHorizontal: 16,
    marginTop: 4,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  addPersonText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  bottomPad: {
    height: 32,
  },
});
