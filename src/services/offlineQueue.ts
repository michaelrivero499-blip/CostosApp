import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUUID } from '../utils';

// Tipos de operaciones que se pueden encolar
export type QueuedOp =
  | { id: string; ts: number; type: 'addPerson';        payload: { id: string; userId: string; name: string; avatar: string; color: string; avatarUrl?: string } }
  | { id: string; ts: number; type: 'updatePerson';     payload: { personId: string; userId: string; name: string; avatar: string; color: string } }
  | { id: string; ts: number; type: 'deletePerson';     payload: { personId: string; userId: string } }
  | { id: string; ts: number; type: 'addDebt';          payload: { id: string; userId: string; personId: string; description: string; amount: number; direction: string; currency: string; date: string; dueDate?: string; notes?: string } }
  | { id: string; ts: number; type: 'updateDebtStatus'; payload: { debtId: string; userId: string; status: string; paidDate?: string } }
  | { id: string; ts: number; type: 'updateDebt';       payload: { debtId: string; userId: string; description: string; amount: number; direction: string; currency: string; dueDate?: string; notes?: string } }
  | { id: string; ts: number; type: 'deleteDebt';       payload: { debtId: string; userId: string } }
  | { id: string; ts: number; type: 'partialPayment';   payload: { debtId: string; userId: string; paidAmount: number; status: string; paidDate?: string; partialPaymentDate: string } };

const queueKey = (userId: string) => `@costos_queue_${userId}`;

export async function getQueue(userId: string): Promise<QueuedOp[]> {
  const data = await AsyncStorage.getItem(queueKey(userId));
  return data ? JSON.parse(data) : [];
}

export async function enqueue(userId: string, op: Omit<QueuedOp, 'id' | 'ts'>): Promise<void> {
  const queue = await getQueue(userId);
  const newOp = { ...op, id: generateUUID(), ts: Date.now() } as QueuedOp;
  queue.push(newOp);
  await AsyncStorage.setItem(queueKey(userId), JSON.stringify(queue));
}

export async function dequeueOp(userId: string, opId: string): Promise<void> {
  const queue = await getQueue(userId);
  await AsyncStorage.setItem(queueKey(userId), JSON.stringify(queue.filter(o => o.id !== opId)));
}

export async function clearQueue(userId: string): Promise<void> {
  await AsyncStorage.removeItem(queueKey(userId));
}
