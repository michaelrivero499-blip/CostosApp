import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { Person, Debt, DebtStatus, DebtDirection, Currency } from '../types';
import { supabase, SUPABASE_URL } from '../services/supabase';
import { useAuth } from './AuthContext';
import { generateUUID } from '../utils';
import { createStorage } from '../storage';
import { getQueue, enqueue, dequeueOp } from '../services/offlineQueue';
import * as FileSystem from 'expo-file-system/legacy';

interface CostosContextType {
  persons: Person[];
  debts: Debt[];
  loading: boolean;
  lastError: string | null;
  lastErrorType: 'offline' | 'error' | null;
  pendingOpsCount: number;
  clearError: () => void;
  addPerson: (name: string, avatar: string, color: string, avatarUrl?: string) => Promise<string>;
  updatePerson: (personId: string, name: string, avatar: string, color: string) => Promise<void>;
  updatePersonAvatar: (personId: string, imageUri: string) => Promise<void>;
  deletePerson: (id: string) => Promise<void>;
  addDebt: (personId: string, description: string, amount: number, direction: DebtDirection, currency?: Currency, dueDate?: string, notes?: string) => Promise<string>;
  updateDebtStatus: (debtId: string, status: DebtStatus) => Promise<void>;
  updateDebt: (debtId: string, description: string, amount: number, direction: DebtDirection, currency: Currency, dueDate?: string, notes?: string) => Promise<void>;
  updateDebtPhoto: (debtId: string, imageUri: string) => Promise<void>;
  deleteDebt: (debtId: string) => Promise<void>;
  addPartialPayment: (debtId: string, amount: number) => Promise<void>;
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
    avatarUrl: (row.avatar_url as string) ?? undefined,
  };
}

function toDebt(row: Record<string, unknown>): Debt {
  return {
    id: row.id as string,
    personId: row.person_id as string,
    description: row.description as string,
    amount: row.amount as number,
    paidAmount: (row.paid_amount as number) ?? 0,
    partialPaymentDate: (row.partial_payment_date as string) ?? undefined,
    status: (row.status as DebtStatus) ?? 'pendiente',
    direction: (row.direction as DebtDirection) ?? 'me_debe',
    date: row.date as string,
    paidDate: (row.paid_date as string) ?? undefined,
    dueDate: (row.due_date as string) ?? undefined,
    currency: (row.currency as Currency) ?? 'ARS',
    notes: (row.notes as string) ?? undefined,
    photoUrl: (row.photo_url as string) ?? undefined,
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
  const [pendingOpsCount, setPendingOpsCount] = useState(0);

  // Ref para evitar syncs simultáneos
  const isSyncing = useRef(false);

  // Storage ref estable — no recrear en cada render
  const userStorage = useRef(createStorage(userId)).current;

  // ── Fix: mantener el caché local siempre sincronizado con el estado ──────────
  // Cada vez que persons o debts cambia (optimista, sync, load), se persiste en
  // AsyncStorage. Así al abrir offline la app siempre tiene los datos más frescos.
  useEffect(() => {
    if (!loading) userStorage.savePersons(persons);
  }, [persons, loading]);

  useEffect(() => {
    if (!loading) userStorage.saveDebts(debts);
  }, [debts, loading]);

  const clearError = useCallback(() => { setLastError(null); setLastErrorType(null); }, []);

  function showError(friendlyMsg: string, supabaseMsg: string) {
    const { msg, type } = toastError(friendlyMsg, supabaseMsg);
    setLastError(msg);
    setLastErrorType(type);
  }

  function showQueued() {
    setLastError('Sin conexión. El cambio se sincronizará al volver la red.');
    setLastErrorType('offline');
  }

  // Ejecuta una operación encolada contra Supabase
  async function executeOp(op: Awaited<ReturnType<typeof getQueue>>[number]) {
    switch (op.type) {
      case 'addPerson': {
        const { id, userId: uid, name, avatar, color, avatarUrl } = op.payload;
        const { error } = await supabase.from('persons').insert({ id, user_id: uid, name, avatar, color, avatar_url: avatarUrl ?? null });
        if (error) throw error;
        break;
      }
      case 'updatePerson': {
        const { personId, userId: uid, name, avatar, color } = op.payload;
        const { error } = await supabase.from('persons').update({ name, avatar, color }).eq('id', personId).eq('user_id', uid);
        if (error) throw error;
        break;
      }
      case 'deletePerson': {
        const { personId, userId: uid } = op.payload;
        const { error: de } = await supabase.from('debts').delete().eq('person_id', personId).eq('user_id', uid);
        if (de) throw de;
        const { error: pe } = await supabase.from('persons').delete().eq('id', personId).eq('user_id', uid);
        if (pe) throw pe;
        break;
      }
      case 'addDebt': {
        const { id, userId: uid, personId, description, amount, direction, currency, date, dueDate, notes } = op.payload;
        const { error } = await supabase.from('debts').insert({ id, user_id: uid, person_id: personId, description, amount, status: 'pendiente', direction, currency, date, due_date: dueDate ?? null, notes: notes ?? null });
        if (error) throw error;
        break;
      }
      case 'updateDebtStatus': {
        const { debtId, userId: uid, status, paidDate } = op.payload;
        const { error } = await supabase.from('debts').update({ status, paid_date: paidDate ?? null }).eq('id', debtId).eq('user_id', uid);
        if (error) throw error;
        break;
      }
      case 'updateDebt': {
        const { debtId, userId: uid, description, amount, direction, currency, dueDate, notes } = op.payload;
        const { error } = await supabase.from('debts').update({ description, amount, direction, currency, due_date: dueDate ?? null, notes: notes ?? null }).eq('id', debtId).eq('user_id', uid);
        if (error) throw error;
        break;
      }
      case 'deleteDebt': {
        const { debtId, userId: uid } = op.payload;
        const { error } = await supabase.from('debts').delete().eq('id', debtId).eq('user_id', uid);
        if (error) throw error;
        break;
      }
      case 'partialPayment': {
        const { debtId, userId: uid, paidAmount, status, paidDate, partialPaymentDate } = op.payload;
        const { error } = await supabase.from('debts').update({ paid_amount: paidAmount, partial_payment_date: partialPaymentDate, status, paid_date: paidDate ?? null }).eq('id', debtId).eq('user_id', uid);
        if (error) throw error;
        break;
      }
    }
  }

  // Procesa toda la cola en orden
  const syncQueue = useCallback(async () => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    try {
      const ops = await getQueue(userId);
      if (ops.length === 0) { isSyncing.current = false; return; }

      for (const op of ops) {
        try {
          await executeOp(op);
          await dequeueOp(userId, op.id);
        } catch (e) {
          const msg = extractMessage(e);
          if (isOfflineError(msg)) break; // Todavía sin conexión — parar
          // Error real → sacar de la cola para no bloquear el resto
          await dequeueOp(userId, op.id);
        }
      }

      const remaining = await getQueue(userId);
      setPendingOpsCount(remaining.length);
    } finally {
      isSyncing.current = false;
    }
  }, [userId]);

  // Cargar datos iniciales
  useEffect(() => {
    setLoading(true);

    async function load() {
      // Mostrar caché inmediatamente y SIEMPRE desbloquear el loading
      // sin esperar a Supabase — así la app abre aunque no haya red
      const [cachedPersons, cachedDebts] = await Promise.all([
        userStorage.getPersons(),
        userStorage.getDebts(),
      ]);
      if (cachedPersons.length > 0 || cachedDebts.length > 0) {
        setPersons(cachedPersons);
        setDebts(cachedDebts);
      }
      setLoading(false); // siempre desbloquear aquí, Supabase actualiza en segundo plano

      // Leer cola pendiente
      const pending = await getQueue(userId);
      setPendingOpsCount(pending.length);

      // Fetch desde Supabase
      try {
        const [{ data: personRows, error: personError }, { data: debtRows, error: debtError }] = await Promise.all([
          supabase.from('persons').select('*').eq('user_id', userId),
          supabase.from('debts').select('*').eq('user_id', userId),
        ]);

        if (personError || debtError) throw personError ?? debtError;

        const fetchedPersons = (personRows ?? []).map(toPerson);
        const fetchedDebts = (debtRows ?? []).map(toDebt);

        // Merge: mantener items optimistas que aún no están en Supabase
        setPersons(prev => {
          const dbIds = new Set(fetchedPersons.map(p => p.id));
          const pending = prev.filter(p => !dbIds.has(p.id));
          return [...fetchedPersons, ...pending];
        });
        setDebts(prev => {
          const dbIds = new Set(fetchedDebts.map(d => d.id));
          const pending = prev.filter(d => !dbIds.has(d.id));
          return [...fetchedDebts, ...pending];
        });
        // El useEffect de persons/debts ya persiste el caché automáticamente

        // Si hay cola pendiente, sincronizar ahora que hay conexión
        if (pending.length > 0) syncQueue();

      } catch (e) {
        showError('No se pudieron cargar los datos', extractMessage(e));
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [userId]);

  // Escuchar reconexión y sincronizar automáticamente
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        syncQueue();
      }
    });
    return unsub;
  }, [syncQueue]);

  // ─── Personas ────────────────────────────────────────────────────────────────

  const addPerson = useCallback(async (name: string, avatar: string, color: string, avatarUrl?: string): Promise<string> => {
    const id = generateUUID();
    const person: Person = { id, name, avatar, color, avatarUrl };
    let prevSnap: Person[] = [];
    setPersons(current => { prevSnap = current; return [...current, person]; });
    try {
      const { error } = await supabase.from('persons').insert({ id, user_id: userId, name, avatar, color, avatar_url: avatarUrl ?? null });
      if (error) throw error;
    } catch (e) {
      const msg = extractMessage(e);
      if (isOfflineError(msg)) {
        await enqueue(userId, { type: 'addPerson', payload: { id, userId, name, avatar, color, avatarUrl } });
        setPendingOpsCount(c => c + 1);
        showQueued();
        return id;
      }
      setPersons(prevSnap);
      showError('No se pudo agregar la persona', msg);
      return '';
    }
    return id;
  }, [userId]);

  const updatePerson = useCallback(async (personId: string, name: string, avatar: string, color: string) => {
    let prevSnap: Person[] = [];
    setPersons(current => { prevSnap = current; return current.map(p => p.id === personId ? { ...p, name, avatar, color } : p); });
    try {
      const { error } = await supabase.from('persons').update({ name, avatar, color }).eq('id', personId).eq('user_id', userId);
      if (error) throw error;
    } catch (e) {
      const msg = extractMessage(e);
      if (isOfflineError(msg)) {
        await enqueue(userId, { type: 'updatePerson', payload: { personId, userId, name, avatar, color } });
        setPendingOpsCount(c => c + 1);
        showQueued();
        return;
      }
      setPersons(prevSnap);
      showError('No se pudo editar la persona', msg);
    }
  }, [userId]);

  const updatePersonAvatar = useCallback(async (personId: string, imageUri: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const path = `${userId}/${personId}.jpg`;
      const supabaseUrl = SUPABASE_URL;

      const localPath = `${FileSystem.documentDirectory}avatar_${personId}.jpg`;
      await FileSystem.copyAsync({ from: imageUri, to: localPath });
      await FileSystem.getInfoAsync(localPath);

      const base64 = await FileSystem.readAsStringAsync(localPath, { encoding: FileSystem.EncodingType.Base64 });
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/avatars/${path}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
        body: bytes,
      });

      const responseText = await uploadResponse.text();
      if (!uploadResponse.ok) throw new Error(responseText);

      const avatarUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`;
      setPersons(current => current.map(p => p.id === personId ? { ...p, avatarUrl } : p));

      const { error } = await supabase.from('persons').update({ avatar_url: avatarUrl }).eq('id', personId).eq('user_id', userId);
      if (error) throw error;

      await FileSystem.deleteAsync(localPath, { idempotent: true });
    } catch (e) {
      showError('No se pudo actualizar la foto', extractMessage(e));
    }
  }, [userId]);

  const deletePerson = useCallback(async (id: string) => {
    let prevPersonsSnap: Person[] = [];
    let prevDebtsSnap: Debt[] = [];
    setPersons(current => { prevPersonsSnap = current; return current.filter(p => p.id !== id); });
    setDebts(current => { prevDebtsSnap = current; return current.filter(d => d.personId !== id); });
    try {
      const { error: debtError } = await supabase.from('debts').delete().eq('person_id', id).eq('user_id', userId);
      if (debtError) throw debtError;
      const { error: personError } = await supabase.from('persons').delete().eq('id', id).eq('user_id', userId);
      if (personError) throw personError;
    } catch (e) {
      const msg = extractMessage(e);
      if (isOfflineError(msg)) {
        await enqueue(userId, { type: 'deletePerson', payload: { personId: id, userId } });
        setPendingOpsCount(c => c + 1);
        showQueued();
        return;
      }
      setPersons(prevPersonsSnap);
      setDebts(prevDebtsSnap);
      showError('No se pudo eliminar la persona', msg);
    }
  }, [userId]);

  // ─── Deudas ──────────────────────────────────────────────────────────────────

  const addDebt = useCallback(async (
    personId: string, description: string, amount: number,
    direction: DebtDirection, currency: Currency = 'ARS', dueDate?: string, notes?: string,
  ): Promise<string> => {
    const id = generateUUID();
    const date = new Date().toISOString();
    const debt: Debt = { id, personId, description, amount, status: 'pendiente', direction, currency, date, dueDate, notes };
    let prevSnap: Debt[] = [];
    setDebts(current => { prevSnap = current; return [...current, debt]; });
    try {
      const { error } = await supabase.from('debts').insert({ id, user_id: userId, person_id: personId, description, amount, status: 'pendiente', direction, currency, date, due_date: dueDate ?? null, notes: notes ?? null });
      if (error) throw error;
    } catch (e) {
      const msg = extractMessage(e);
      if (isOfflineError(msg)) {
        await enqueue(userId, { type: 'addDebt', payload: { id, userId, personId, description, amount, direction, currency, date, dueDate, notes } });
        setPendingOpsCount(c => c + 1);
        showQueued();
        return id;
      }
      setDebts(prevSnap);
      showError('No se pudo agregar la deuda', msg);
      return '';
    }
    return id;
  }, [userId]);

  const updateDebtStatus = useCallback(async (debtId: string, status: DebtStatus) => {
    const paidDate = status === 'pagado' ? new Date().toISOString() : undefined;
    let prevSnap: Debt[] = [];
    setDebts(current => { prevSnap = current; return current.map(d => d.id !== debtId ? d : { ...d, status, paidDate }); });
    try {
      const { error } = await supabase.from('debts').update({ status, paid_date: paidDate ?? null }).eq('id', debtId).eq('user_id', userId);
      if (error) throw error;
    } catch (e) {
      const msg = extractMessage(e);
      if (isOfflineError(msg)) {
        await enqueue(userId, { type: 'updateDebtStatus', payload: { debtId, userId, status, paidDate } });
        setPendingOpsCount(c => c + 1);
        showQueued();
        return;
      }
      setDebts(prevSnap);
      showError('No se pudo actualizar la deuda', msg);
    }
  }, [userId]);

  const updateDebt = useCallback(async (
    debtId: string, description: string, amount: number,
    direction: DebtDirection, currency: Currency, dueDate?: string, notes?: string,
  ) => {
    let prevSnap: Debt[] = [];
    setDebts(current => { prevSnap = current; return current.map(d => d.id !== debtId ? d : { ...d, description, amount, direction, currency, dueDate, notes }); });
    try {
      const { error } = await supabase.from('debts').update({ description, amount, direction, currency, due_date: dueDate ?? null, notes: notes ?? null }).eq('id', debtId).eq('user_id', userId);
      if (error) throw error;
    } catch (e) {
      const msg = extractMessage(e);
      if (isOfflineError(msg)) {
        await enqueue(userId, { type: 'updateDebt', payload: { debtId, userId, description, amount, direction, currency, dueDate, notes } });
        setPendingOpsCount(c => c + 1);
        showQueued();
        return;
      }
      setDebts(prevSnap);
      showError('No se pudo editar la deuda', msg);
    }
  }, [userId]);

  const updateDebtPhoto = useCallback(async (debtId: string, imageUri: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const path = `debts/${userId}/${debtId}.jpg`;
      const supabaseUrl = SUPABASE_URL;

      const localPath = `${FileSystem.documentDirectory}debtphoto_${debtId}.jpg`;
      await FileSystem.copyAsync({ from: imageUri, to: localPath });

      const base64 = await FileSystem.readAsStringAsync(localPath, { encoding: FileSystem.EncodingType.Base64 });
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/avatars/${path}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
        body: bytes,
      });
      const responseText = await uploadResponse.text();
      if (!uploadResponse.ok) throw new Error(responseText);

      const photoUrl = `${supabaseUrl}/storage/v1/object/public/avatars/${path}?t=${Date.now()}`;
      setDebts(current => current.map(d => d.id === debtId ? { ...d, photoUrl } : d));

      const { error } = await supabase.from('debts').update({ photo_url: photoUrl }).eq('id', debtId).eq('user_id', userId);
      if (error) throw error;

      await FileSystem.deleteAsync(localPath, { idempotent: true });
    } catch (e) {
      showError('No se pudo subir la foto', extractMessage(e));
    }
  }, [userId]);

  const addPartialPayment = useCallback(async (debtId: string, payAmount: number) => {
    let prevSnap: Debt[] = [];
    let update: { newPaid: number; newStatus: DebtStatus; paidDate: string | undefined; partialPaymentDate: string } | null = null;

    setDebts(current => {
      prevSnap = current;
      const debt = current.find(d => d.id === debtId);
      if (!debt) return current;
      const newPaid = (debt.paidAmount ?? 0) + payAmount;
      const fullyPaid = newPaid >= debt.amount;
      const newStatus: DebtStatus = fullyPaid ? 'pagado' : 'pendiente';
      const paidDate = fullyPaid ? new Date().toISOString() : debt.paidDate;
      const partialPaymentDate = new Date().toISOString();
      update = { newPaid, newStatus, paidDate, partialPaymentDate };
      return current.map(d => d.id !== debtId ? d : { ...d, paidAmount: newPaid, partialPaymentDate, status: newStatus, paidDate });
    });

    if (!update) return;
    const { newPaid, newStatus, paidDate, partialPaymentDate } = update;

    try {
      const { error } = await supabase.from('debts')
        .update({ paid_amount: newPaid, partial_payment_date: partialPaymentDate, status: newStatus, paid_date: paidDate ?? null })
        .eq('id', debtId).eq('user_id', userId);
      if (error) throw error;
    } catch (e) {
      const msg = extractMessage(e);
      if (isOfflineError(msg)) {
        await enqueue(userId, { type: 'partialPayment', payload: { debtId, userId, paidAmount: newPaid, status: newStatus, paidDate, partialPaymentDate } });
        setPendingOpsCount(c => c + 1);
        showQueued();
        return;
      }
      setDebts(prevSnap);
      showError('No se pudo registrar el pago', msg);
    }
  }, [userId]);

  const deleteDebt = useCallback(async (debtId: string) => {
    let prevSnap: Debt[] = [];
    setDebts(current => { prevSnap = current; return current.filter(d => d.id !== debtId); });
    try {
      const { error } = await supabase.from('debts').delete().eq('id', debtId).eq('user_id', userId);
      if (error) throw error;
    } catch (e) {
      const msg = extractMessage(e);
      if (isOfflineError(msg)) {
        await enqueue(userId, { type: 'deleteDebt', payload: { debtId, userId } });
        setPendingOpsCount(c => c + 1);
        showQueued();
        return;
      }
      setDebts(prevSnap);
      showError('No se pudo eliminar la deuda', msg);
    }
  }, [userId]);

  return (
    <CostosContext.Provider value={{
      persons, debts, loading,
      lastError, lastErrorType, pendingOpsCount, clearError,
      addPerson, updatePerson, updatePersonAvatar, deletePerson,
      addDebt, updateDebtStatus, updateDebt, updateDebtPhoto, deleteDebt, addPartialPayment,
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
