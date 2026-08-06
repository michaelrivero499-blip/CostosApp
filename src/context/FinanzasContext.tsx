import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from './AuthContext';
import { Transaction, Budget, TransactionType } from '../types';
import { generateUUID } from '../utils';

interface FinanzasContextType {
  transactions: Transaction[];
  budgets:      Budget[];
  loading:      boolean;
  addTransaction:    (type: TransactionType, amount: number, category: string, description: string, date?: string) => Promise<void>;
  editTransaction:   (id: string, type: TransactionType, amount: number, category: string, description: string, date: string) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  upsertBudget: (category: string, amount: number) => Promise<void>;
  deleteBudget:  (category: string) => Promise<void>;
}

const FinanzasContext = createContext<FinanzasContextType | null>(null);

function toTransaction(row: Record<string, unknown>): Transaction {
  return {
    id:          row.id as string,
    type:        row.type as TransactionType,
    amount:      row.amount as number,
    category:    row.category as string,
    description: (row.description as string) ?? '',
    date:        row.date as string,
  };
}

function toBudget(row: Record<string, unknown>): Budget {
  return {
    id:       row.id as string,
    category: row.category as string,
    amount:   row.amount as number,
  };
}

export function FinanzasProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets]           = useState<Budget[]>([]);
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    if (!session?.user) { setLoading(false); return; }
    load();
  }, [session?.user?.id]);

  async function load() {
    setLoading(true);
    const uid = session!.user.id;
    const [txRes, bgRes] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', uid).order('date', { ascending: false }),
      supabase.from('budgets').select('*').eq('user_id', uid),
    ]);
    if (txRes.data) setTransactions(txRes.data.map(toTransaction));
    if (bgRes.data) setBudgets(bgRes.data.map(toBudget));
    setLoading(false);
  }

  async function addTransaction(
    type: TransactionType, amount: number, category: string,
    description: string, date?: string,
  ) {
    const uid    = session!.user.id;
    const txDate = date ?? new Date().toISOString();
    const newT: Transaction = { id: generateUUID(), type, amount, category, description, date: txDate };
    setTransactions(prev => [newT, ...prev]);
    try {
      const { error } = await supabase.from('transactions').insert({
        id: newT.id, user_id: uid, type, amount, category, description, date: txDate,
      });
      if (error) throw error;
    } catch {
      setTransactions(prev => prev.filter(t => t.id !== newT.id));
    }
  }

  async function editTransaction(
    id: string, type: TransactionType, amount: number,
    category: string, description: string, date: string,
  ) {
    const snapshot = transactions;
    setTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, type, amount, category, description, date } : t
    ));
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ type, amount, category, description, date })
        .eq('id', id);
      if (error) throw error;
    } catch {
      setTransactions(snapshot);
    }
  }

  async function deleteTransaction(id: string) {
    const snapshot = transactions;
    setTransactions(p => p.filter(t => t.id !== id));
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) throw error;
    } catch {
      setTransactions(snapshot);
    }
  }

  async function upsertBudget(category: string, amount: number) {
    const uid      = session!.user.id;
    const existing = budgets.find(b => b.category === category);
    if (existing) {
      setBudgets(prev => prev.map(b => b.category === category ? { ...b, amount } : b));
      await supabase.from('budgets').update({ amount }).eq('user_id', uid).eq('category', category);
    } else {
      const nb: Budget = { id: generateUUID(), category, amount };
      setBudgets(prev => [...prev, nb]);
      await supabase.from('budgets').insert({ id: nb.id, user_id: uid, category, amount });
    }
  }

  async function deleteBudget(category: string) {
    const uid = session!.user.id;
    setBudgets(prev => prev.filter(b => b.category !== category));
    await supabase.from('budgets').delete().eq('user_id', uid).eq('category', category);
  }

  return (
    <FinanzasContext.Provider value={{
      transactions, budgets, loading,
      addTransaction, editTransaction, deleteTransaction,
      upsertBudget, deleteBudget,
    }}>
      {children}
    </FinanzasContext.Provider>
  );
}

export function useFinanzas() {
  const ctx = useContext(FinanzasContext);
  if (!ctx) throw new Error('useFinanzas must be used within FinanzasProvider');
  return ctx;
}
