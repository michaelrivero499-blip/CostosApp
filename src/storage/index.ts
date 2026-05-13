import AsyncStorage from '@react-native-async-storage/async-storage';
import { Person, Debt } from '../types';

export function createStorage(userId: string) {
  const personsKey = `@costos_persons_${userId}`;
  const debtsKey = `@costos_debts_${userId}`;

  return {
    async getPersons(): Promise<Person[]> {
      const data = await AsyncStorage.getItem(personsKey);
      return data ? JSON.parse(data) : [];
    },
    async savePersons(persons: Person[]): Promise<void> {
      await AsyncStorage.setItem(personsKey, JSON.stringify(persons));
    },
    async getDebts(): Promise<Debt[]> {
      const data = await AsyncStorage.getItem(debtsKey);
      return data ? JSON.parse(data) : [];
    },
    async saveDebts(debts: Debt[]): Promise<void> {
      await AsyncStorage.setItem(debtsKey, JSON.stringify(debts));
    },
  };
}
