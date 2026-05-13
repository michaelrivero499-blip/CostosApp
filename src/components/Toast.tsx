import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, StyleSheet } from 'react-native';
import { useCostos } from '../context/CostosContext';

export function Toast() {
  const { lastError, lastErrorType, clearError } = useCostos();
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!lastError) return;

    translateY.setValue(20);
    opacity.setValue(0);

    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => clearError());
    }, 3000);

    return () => clearTimeout(timer);
  }, [lastError]);

  if (!lastError) return null;

  const isOffline = lastErrorType === 'offline';

  return (
    <Animated.View style={[
      styles.toast,
      isOffline ? styles.toastOffline : styles.toastError,
      { opacity, transform: [{ translateY }] },
    ]}>
      <Text style={[styles.icon, isOffline ? styles.iconOffline : styles.iconError]}>
        {isOffline ? '⚡' : '⚠'}
      </Text>
      <Text style={[styles.text, isOffline ? styles.textOffline : styles.textError]}>
        {lastError}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 48,
    left: 24,
    right: 24,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  toastError: {
    backgroundColor: '#1A1A2E',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  toastOffline: {
    backgroundColor: '#1C1400',
    borderLeftWidth: 4,
    borderLeftColor: '#F97316',
  },
  icon: {
    fontSize: 16,
  },
  iconError: {
    color: '#EF4444',
  },
  iconOffline: {
    color: '#FB923C',
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  textError: {
    color: '#FFFFFF',
  },
  textOffline: {
    color: '#FED7AA',
  },
});
