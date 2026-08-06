import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Debt, Person } from '../types';

// Cómo se muestran las notificaciones con la app en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Pedir permisos y crear el canal Android
export async function requestNotificationPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('deudas', {
      name: 'Recordatorios de deudas',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// Notificación de prueba — dispara en 5 segundos
export async function scheduleTestNotification(): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '✅ Vera — Notificaciones activas',
      body: 'Los recordatorios de vencimientos están funcionando correctamente.',
      sound: true,
      data: { type: 'test' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 5,
    },
  });
}

// Programa notificaciones reales para deudas con vencimiento próximo
export async function scheduleDueDateNotifications(
  debts: Debt[],
  persons: Person[],
): Promise<void> {
  // Cancelar todas las notificaciones previas para evitar duplicados
  await Notifications.cancelAllScheduledNotificationsAsync();

  const personMap = Object.fromEntries(persons.map(p => [p.id, p]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const pending = debts.filter(d => d.status === 'pendiente' && d.dueDate);

  for (const debt of pending) {
    const due = new Date(debt.dueDate!);
    const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
    const diffDays = Math.round(
      (dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );
    const person = personMap[debt.personId];
    const personName = person?.name ?? 'alguien';
    const direction = debt.direction === 'me_debe' ? `${personName} te debe` : `Le debés a ${personName}`;

    // Notificar 1 día antes a las 9am
    if (diffDays === 1) {
      const trigger = new Date(dueDay);
      trigger.setDate(trigger.getDate() - 1);
      trigger.setHours(9, 0, 0, 0);
      if (trigger > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '⏰ Vencimiento mañana',
            body: `${direction} "${debt.description}" — vence mañana.`,
            sound: true,
            data: { debtId: debt.id, personId: debt.personId },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: trigger,
          },
        });
      }
    }

    // Notificar el día del vencimiento a las 9am
    if (diffDays === 0) {
      const trigger = new Date(today);
      trigger.setHours(9, 0, 0, 0);
      if (trigger > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🔴 Vence hoy',
            body: `${direction} "${debt.description}" — vence hoy.`,
            sound: true,
            data: { debtId: debt.id, personId: debt.personId },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: trigger,
          },
        });
      }
    }

    // Notificar 3 días antes a las 9am
    if (diffDays === 3) {
      const trigger = new Date(dueDay);
      trigger.setDate(trigger.getDate() - 3);
      trigger.setHours(9, 0, 0, 0);
      if (trigger > now) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '📅 Vencimiento en 3 días',
            body: `${direction} "${debt.description}" — vence el ${dueDay.toLocaleDateString('es-AR')}.`,
            sound: true,
            data: { debtId: debt.id, personId: debt.personId },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: trigger,
          },
        });
      }
    }
  }
}
