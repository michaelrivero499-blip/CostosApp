import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme, Theme } from '../context/ThemeContext';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  visible, title, message, confirmLabel = 'Eliminar', onConfirm, onCancel,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal visible={visible} animationType="fade" transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 32,
    },
    card: {
      backgroundColor: t.card,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 20,
      elevation: 10,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: t.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      color: t.subtext,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    buttons: { flexDirection: 'row', gap: 12 },
    cancelBtn: {
      flex: 1,
      backgroundColor: t.isDark ? t.bg : '#F5F5F5',
      borderRadius: 14,
      padding: 15,
      alignItems: 'center',
    },
    cancelText: {
      fontSize: 15,
      fontWeight: '600',
      color: t.subtext,
    },
    confirmBtn: {
      flex: 1,
      backgroundColor: '#F05B53',
      borderRadius: 14,
      padding: 15,
      alignItems: 'center',
    },
    confirmText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  });
}
