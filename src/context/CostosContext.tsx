import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { View } from 'react-native';
import { Person, Debt, DebtStatus, DebtDirection, Currency } from '../types';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { generateUUID } from '../utils';
import { createStorage } from '../storage';

interface CostosContextType {
  persons: Person[];
  debts: Debt[];
  loading: boolean;
  lastError: string | null;
  lastErrorType: 'offline' | 'error' | null;
  clearError: () => void;
  addPerson: (name: string, avatar: string, color: string) => Promise<string>;
  deletePerson: (id: string) => Promise<void>;
  addDebt: (personId: string, description: string, amount: number, direction: DebtDirection, currency?: Currency) => Promise<string>;
  updateDebtStatus: (debtId: string, status: DebtStatus) => Promise<void>;
  updateDebt: (debtId: string, description: string, amount: number, direction: DebtDirection, currency: Currency) => Promise<void>;
  deleteDebt: (debtId: string) => Promise<void>;
}

const CostosContext = createContext<CostosContextType | null>(null);

function isOfflineError(message: string): boolean {
  const msg = String(message).toLowerCase();
  return msg.includes('network request failed') || msg.includes('failed to fetch');
}

function extractMessage(e: unknown): string {
  if (e && typeof (e as Record<string, unknown>).message === 'string') {
    return (e as Record<string, unknown>).message as string;
  }
  const str = String(e);
  const colonIdx = str.lastIndexOf(':');
  if (colonIdx !== -1) return str.slice(colonIdx + 1).trim();
  return str;
}

function toastError(message: string, errorMsg: string): { msg: string; type: 'offline' | 'error' } {
  if (isOfflineError(errorMsg)) {
    return { msg: 'Sin conexión a internet. Mostrando datos guardados.', type: 'offline' };
  }
  return { msg: message, type: 'error' };
}

function toPerson(row: Record<string, unknown>): Person {
  return {
    id: row.id as string,
    name: row.name as string,
    avatar: row.avatar as string,
    color: row.color as string,
  };
}

function toDebt(row: Record<string, unknown>): Debt {
  return {
    id: row.id as string,
    personId: row.person_id as string,
    description: row.description as string,
    amount: row.amount as number,
    status: (row.status as DebtStatus) ?? 'pendiente',
    direction: (row.direction as DebtDirection) ?? 'me_debe',
    date: row.date as string,
    paidDate: (row.paid_date as string) ?? undefined,
    currency: (row.currency as Currency) ?? 'ARS',
  };
}

export function CostosProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const userId = session!.user.id;

  const [persons, setPersons] = useState<Person[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastErrorType, setLastErrorType] = useState<'offline' | 'error' | null>(null);

  const clearError = useCallback(() => { setLastError(null); setLastErrorType(null); }, []);

  function showError(friendlyMsg: string, supabaseMsg: string) {
    const { msg, type } = toastError(friendlyMsg, supabaseMsg);
    setLastError(msg);
    setLastErrorType(type);
  }

  useEffect(() => {
    setLoading(true);
    const userStorage = createStorage(userId);

    async function load() {
      // Show cached data immediately while Supabase loads
      const [cachedPersons, cachedDebts] = await Promise.all([
        userStorage.getPersons(),
        userStorage.getDebts(),
      ]);
      if (cachedPersons.length > 0 || cachedDebts.length > 0) {
        setPersons(cachedPersons);
        setDebts(cachedDebts);
        setLoading(false);
      }

      // Fetch fresh data from Supabase
      try {
        const [{ data: personRows, error: personError }, { data: debtRows, error: debtError }] = await Promise.all([
          supabase.from('persons').select('*').eq('user_id', userId),
          supabase.from('debts').select('*').eq('user_id', userId),
        ]);

        if (personError || debtError) {
          throw personError ?? debtError;
        }

        // Success — update state and refresh cache
        const persons = (personRows ?? []).map(toPerson);
        const debts = (debtRows ?? []).map(toDebt);
        setPersons(persons);
        setDebts(debts);
        await Promise.all([userStorage.savePersons(persons), userStorage.saveDebts(debts)]);
      } catch (e) {
          showError('No se pudieron cargar los datos', extractMessage(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [userId]);

  const addPerson = useCallback(async (name: string, avatar: string, color: string): Promise<string> => {
    const id = generateUUID();
    const person: Person = { id, name, avatar, color };
    const prev = persons;
    setPersons([...persons, person]);
    try {
      const { error } = await supabase.from('persons').insert({ id, user_id: userId, name, avatar, color });
      if (error) throw error;
    } catch (e) {
      setPersons(prev);
      showError('No se pudo agregar la persona', extractMessage(e));
      return '';
    }
    return id;
  }, [persons, userId]);

  const deletePerson = useCallback(async (id: string) => {
    const prevPersons = persons;
    const prevDebts = debts;
    setPersons(persons.filter(p => p.id !== id));
    setDebts(debts.filter(d => d.personId !== id));
    try {
      const { error: debtError } = await supabase.from('debts')
        .delete()
        .eq('person_id', id)
        .eq('user_id', userId);
      if (debtError) throw debtError;
      const { error: personError } = await supabase.from('persons')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);
      if (personError) throw personError;
    } catch (e) {
      setPersons(prevPersons);
      setDebts(prevDebts);
      showError('No se pudo eliminar la persona', extractMessage(e));
    }
  }, [persons, debts, userId]);

  const addDebt = useCallback(async (
    personId: string,
    description: string,
    amount: number,
    direction: DebtDirection,
    currency: Currency = 'ARS',
  ): Promise<string> => {
    const id = generateUUID();
    const date = new Date().toISOString();
    const debt: Debt = { id, personId, description, amount, status: 'pendiente', direction, currency, date };
    const prev = debts;
    setDebts([...debts, debt]);
    try {
      const { error } = await supabase.from('debts').insert({
        id,
        user_id: userId,
        person_id: personId,
        description,
        amount,
        status: 'pendiente',
        direction,
        currency,
        date,
      });
      if (error) throw error;
    } catch (e) {
      setDebts(prev);
      showError('No se pudo agregar la deuda', extractMessage(e));
      return '';
    }
    return id;
  }, [debts, userId]);

  const updateDebtStatus = useCallback(async (debtId: string, status: DebtStatus) => {
    const prev = debts;
    const paidDate = status === 'pagado' ? new Date().toISOString() : undefined;
    setDebts(debts.map(d => d.id !== debtId ? d : { ...d, status, paidDate }));
    try {
      const { error } = await supabase.from('debts')
        .update({ status, paid_date: paidDate ?? null })
        .eq('id', debtId)
        .eq('user_id', userId);
      if (error) throw error;
    } catch (e) {
      setDebts(prev);
      showError('No se pudo actualizar la deuda', extractMessage(e));
    }
  }, [debts, userId]);

  const updateDebt = useCallback(async (
    debtId: string,
    description: string,
    amount: number,
    direction: DebtDirection,
    currency: Currency,
  ) => {
    const prev = debts;
    setDebts(debts.map(d => d.id !== debtId ? d : { ...d, description, amount, direction, currency }));
    try {
      const { error } = await supabase.from('debts')
        .update({ description, amount, direction, currency })
        .eq('id', debtId)
        .eq('user_id', userId);
      if (error) throw error;
    } catch (e) {
      setDebts(prev);
      showError('No se pudo editar la deuda', extractMessage(e));
    }
  }, [debts, userId]);

  const deleteDebt = useCallback(async (debtId: string) => {
    const prev = debts;
    setDebts(debts.filter(d => d.id !== debtId));
    try {
      const { error } = await supabase.from('debts')
        .delete()
        .eq('id', debtId)
        .eq('user_id', userId);
      if (error) throw error;
    } catch (e) {
      setDebts(prev);
      showError('No se pudo eliminar la deuda', extractMessage(e));
    }
  }, [debts, userId]);

  return (
    <CostosContext.Provider value={{
      persons, debts, loading,
      lastError, lastErrorType, clearError,
      addPerson, deletePerson, addDebt, updateDebtStatus, updateDebt, deleteDebt,
    }}>
      <View style={{ flex: 1 }}>
        {children}
      </View>
    </CostosContext.Provider>
  );
}

export function useCostos() {
  const ctx = useContext(CostosContext);
  if (!ctx) throw new Error('useCostos must be used within CostosProvider');
  return ctx;
}
