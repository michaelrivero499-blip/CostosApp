import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Hint contextual — aparece la primera vez, se auto-descarta después de `autoDismissMs`.
 * El usuario también puede cerrarlo manualmente.
 */
export function useHint(key: string, autoDismissMs = 5000) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(`@hint_${key}`).then(val => {
      if (val === null) setVisible(true);
    });
  }, [key]);

  useEffect(() => {
    if (!visible || !autoDismissMs) return;
    const t = setTimeout(() => dismiss(), autoDismissMs);
    return () => clearTimeout(t);
  }, [visible]);

  async function dismiss() {
    setVisible(false);
    await AsyncStorage.setItem(`@hint_${key}`, 'done');
  }

  return { visible, dismiss };
}
