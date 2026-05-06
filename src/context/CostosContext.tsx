import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Person, Debt, DebtStatus, DebtDirection } from '../types';
import { storage } from '../storage';
import { generateId } from '../utils';

interface CostosContextType {
  persons: Person[];
  debts: Debt[];
  loading: boolean;
  addPerson: (name: string, avatar: string, color: string) => Promise<string>;
  deletePerson: (id: string) => Promise<void>;
  addDebt: (personId: string, description: string, amount: number, direction: DebtDirection) => Promise<string>;
  updateDebtStatus: (debtId: string, status: DebtStatus) => Promise<void>;
  deleteDebt: (debtId: string) => Promise<void>;
}

const CostosContext = createContext<CostosContextType | null>(null);

export function CostosProvider({ children }: { children: React.ReactNode }) {
  const [persons, setPersons] = useState<Person[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [p, rawDebts] = await Promise.all([storage.getPersons(), storage.getDebts()]);
      // Backward compat: add default direction for debts saved before this field existed
      type StoredDebt = Omit<Debt, 'direction'> & { direction?: DebtDirection };
      const d: Debt[] = (rawDebts as StoredDebt[]).map(debt => ({
        ...debt,
        direction: debt.direction ?? ('me_debe' as DebtDirection),
      }));
      setPersons(p);
      setDebts(d);
      setLoading(false);
    }
    load();
  }, []);

  const addPerson = useCallback(async (name: string, avatar: string, color: string): Promise<string> => {
    const person: Person = { id: generateId(), name, avatar, color };
    const updated = [...persons, person];
    setPersons(updated);
    await storage.savePersons(updated);
    return person.id;
  }, [persons]);

  const deletePerson = useCallback(async (id: string) => {
    const updatedPersons = persons.filter(p => p.id !== id);
    const updatedDebts = debts.filter(d => d.personId !== id);
    setPersons(updatedPersons);
    setDebts(updatedDebts);
    await Promise.all([storage.savePersons(updatedPersons), storage.saveDebts(updatedDebts)]);
  }, [persons, debts]);

  const addDebt = useCallback(async (
    personId: string,
    description: string,
    amount: number,
    direction: DebtDirection,
  ): Promise<string> => {
    const debt: Debt = {
      id: generateId(),
      personId,
      description,
      amount,
      status: 'pendiente',
      direction,
      date: new Date().toISOString(),
    };
    const updated = [...debts, debt];
    setDebts(updated);
    await storage.saveDebts(updated);
    return debt.id;
  }, [debts]);

  const updateDebtStatus = useCallback(async (debtId: string, status: DebtStatus) => {
    const updated = debts.map(d => d.id === debtId ? { ...d, status } : d);
    setDebts(updated);
    await storage.saveDebts(updated);
  }, [debts]);

  const deleteDebt = useCallback(async (debtId: string) => {
    const updated = debts.filter(d => d.id !== debtId);
    setDebts(updated);
    await storage.saveDebts(updated);
  }, [debts]);

  return (
    <CostosContext.Provider value={{
      persons, debts, loading,
      addPerson, deletePerson, addDebt, updateDebtStatus, deleteDebt,
    }}>
      {children}
    </CostosContext.Provider>
  );
}

export function useCostos() {
  const ctx = useContext(CostosContext);
  if (!ctx) throw new Error('useCostos must be used within CostosProvider');
  return ctx;
}
