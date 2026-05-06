import AsyncStorage from '@react-native-async-storage/async-storage';
import { Person, Debt } from '../types';

const PERSONS_KEY = '@costos_persons';
const DEBTS_KEY = '@costos_debts';

export const storage = {
  async getPersons(): Promise<Person[]> {
    const data = await AsyncStorage.getItem(PERSONS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async savePersons(persons: Person[]): Promise<void> {
    await AsyncStorage.setItem(PERSONS_KEY, JSON.stringify(persons));
  },

  async getDebts(): Promise<Debt[]> {
    const data = await AsyncStorage.getItem(DEBTS_KEY);
    return data ? JSON.parse(data) : [];
  },

  async saveDebts(debts: Debt[]): Promise<void> {
    await AsyncStorage.setItem(DEBTS_KEY, JSON.stringify(debts));
  },
};
