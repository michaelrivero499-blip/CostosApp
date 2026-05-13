import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCostos } from '../context/CostosContext';
import { useTheme, Theme } from '../context/ThemeContext';
import { SummaryCard } from '../components/SummaryCard';
import { PersonCard } from '../components/PersonCard';
import { BarChart } from '../components/BarChart';
import { AddPersonModal } from '../components/AddPersonModal';
import { VoiceDebtModal } from '../components/VoiceDebtModal';
import { MicIcon } from '../components/MicIcon';
import { SettingsIcon } from '../components/SettingsIcon';
import { getPersonTotal, formatAmountCurrency, DIRECTION_COLORS, CURRENCY_ORDER } from '../utils';
import { DebtDirection, PeriodFilter, Currency } from '../types';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

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
  const { persons, debts, loading, addPerson, deletePerson, addDebt } = useCostos();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [showAddPerson, setShowAddPerson] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [newestPersonId, setNewestPersonId] = useState<string | null>(null);
  const [deletingPersonId, setDeletingPersonId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PeriodFilter>({ mode: 'total' });
  const [currency, setCurrency] = useState<Currency>('ARS');

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

  const chartData = persons
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
    .sort((a, b) => b.value - a.value);

  const personMap = Object.fromEntries(persons.map(p => [p.id, p]));

  const recentActivities = debts
    .flatMap(debt => {
      const person = personMap[debt.personId];
      if (!person) return [];
      const added = { key: `a-${debt.id}`, type: 'added' as const, debt, person, eventDate: debt.date };
      if (debt.status !== 'pagado') return [added];
      return [added, { key: `p-${debt.id}`, type: 'paid' as const, debt, person, eventDate: debt.paidDate ?? debt.date }];
    })
    .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
    .slice(0, 3);

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
        <Image
          source={require('../../assets/vera-logos/vera_logo_256px.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <SettingsIcon size={24} color={theme.subtext} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <SummaryCard
          debts={debts}
          currency={currency}
          onCurrencyChange={setCurrency}
          filter={filter}
          onFilterChange={setFilter}
        />

        <TouchableOpacity
          style={styles.detailsBtn}
          onPress={() => navigation.navigate('History', { filter, currency })}
        >
          <Text style={styles.detailsBtnText}>Más detalles →</Text>
        </TouchableOpacity>

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

        {recentActivities.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>MOVIMIENTOS</Text>
            {recentActivities.map(({ key, type, debt, person, eventDate }) => {
              const isPaid = type === 'paid';
              const dirColor = DIRECTION_COLORS[debt.direction];
              const label = isPaid
                ? `Saldaste deuda con ${person.name}`
                : `Agregaste deuda a ${person.name}`;
              return (
                <View key={key} style={styles.activityItem}>
                  <View style={[styles.activityIcon, {
                    backgroundColor: isPaid ? '#2ED57322' : '#5E60CE22',
                  }]}>
                    <Text style={[styles.activityIconText, {
                      color: isPaid ? '#2ED573' : '#5E60CE',
                    }]}>
                      {isPaid ? '✓' : '+'}
                    </Text>
                  </View>
                  <View style={styles.activityContent}>
                    <View style={styles.activityRow}>
                      <Text style={styles.activityLabel} numberOfLines={1}>{label}</Text>
                      <Text style={[styles.activityAmount, { color: isPaid ? '#2ED573' : dirColor }]}>
                        {formatAmountCurrency(debt.amount, (debt.currency ?? 'ARS') as Currency)}
                      </Text>
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
      </ScrollView>

      {!showAddPerson && !showVoice && (
        <View style={styles.fabRow}>
          <TouchableOpacity style={styles.fabSecondary} onPress={() => setShowAddPerson(true)}>
            <Text style={styles.fabSecondaryText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.fabMic} onPress={() => setShowVoice(true)}>
            <MicIcon size={26} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      <AddPersonModal
        visible={showAddPerson}
        onClose={() => setShowAddPerson(false)}
        onSave={handleAddPerson}
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
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: t.bg,
    },
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
      backgroundColor: '#F05B53',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#F05B53',
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
  });
}
