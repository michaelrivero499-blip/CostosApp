import React, { useState, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, TouchableWithoutFeedback,
} from 'react-native';
import { Debt } from '../types';
import { useTheme, Theme } from '../context/ThemeContext';
import { formatAmountCurrency, CURRENCY_SYMBOLS } from '../utils';

interface Props {
  visible: boolean;
  debt: Debt | null;
  onConfirm: (debtId: string, amount: number) => void;
  onClose: () => void;
}

export function PartialPaymentModal({ visible, debt, onConfirm, onClose }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [input, setInput] = useState('');

  if (!debt) return null;

  const currency = debt.currency ?? 'ARS';
  const alreadyPaid = debt.paidAmount ?? 0;
  const remaining = debt.amount - alreadyPaid;
  const entered = parseFloat(input.replace(',', '.')) || 0;
  const afterPayment = Math.min(entered, remaining);
  const willClose = afterPayment >= remaining;

  function handleConfirm() {
    if (entered <= 0 || entered > remaining) return;
    onConfirm(debt!.id, entered);
    setInput('');
    onClose();
  }

  function handleClose() {
    setInput('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <TouchableWithoutFeedback onPress={handleClose}>
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Pago parcial</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{debt.description}</Text>

          {/* Resumen de estado */}
          <View style={[styles.summaryRow, { backgroundColor: theme.isDark ? theme.bg : '#F8F8F8' }]}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.subtext }]}>Total</Text>
              <Text style={[styles.summaryValue, { color: theme.text }]}>
                {formatAmountCurrency(debt.amount, currency)}
              </Text>
            </View>
            {alreadyPaid > 0 && (
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryLabel, { color: theme.subtext }]}>Ya pagado</Text>
                <Text style={[styles.summaryValue, { color: '#34C759' }]}>
                  {formatAmountCurrency(alreadyPaid, currency)}
                </Text>
              </View>
            )}
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryLabel, { color: theme.subtext }]}>Resta</Text>
              <Text style={[styles.summaryValue, { color: '#F05B53' }]}>
                {formatAmountCurrency(remaining, currency)}
              </Text>
            </View>
          </View>

          {/* Input de monto */}
          <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.isDark ? theme.bg : '#F8F8F8' }]}>
            <Text style={[styles.currencySymbol, { color: theme.subtext }]}>
              {CURRENCY_SYMBOLS[currency]}
            </Text>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="0"
              placeholderTextColor={theme.subtext}
              keyboardType="numeric"
              value={input}
              onChangeText={setInput}
              autoFocus
            />
          </View>

          {/* Aviso si cubre toda la deuda */}
          {entered > 0 && (
            <Text style={[styles.hint, { color: willClose ? '#34C759' : theme.subtext }]}>
              {willClose
                ? '✅ Esto salda la deuda por completo'
                : `Quedará un saldo de ${formatAmountCurrency(remaining - entered, currency)}`}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, entered <= 0 || entered > remaining ? styles.confirmBtnDisabled : null]}
            onPress={handleConfirm}
            activeOpacity={0.8}
            disabled={entered <= 0 || entered > remaining}
          >
            <Text style={styles.confirmText}>Registrar pago</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
            <Text style={[styles.cancelText, { color: theme.subtext }]}>Cancelar</Text>
          </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: t.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 20,
      paddingBottom: 40,
    },
    handle: {
      width: 36, height: 4,
      backgroundColor: t.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    title: { fontSize: 18, fontWeight: '700', color: t.text, textAlign: 'center', marginBottom: 4 },
    subtitle: { fontSize: 13, color: t.subtext, textAlign: 'center', marginBottom: 16 },
    summaryRow: {
      flexDirection: 'row', justifyContent: 'space-around',
      borderRadius: 12, paddingVertical: 12, marginBottom: 20,
    },
    summaryItem: { alignItems: 'center' },
    summaryLabel: { fontSize: 11, fontWeight: '600', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.3 },
    summaryValue: { fontSize: 15, fontWeight: '800' },
    inputRow: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1.5, borderRadius: 14,
      paddingHorizontal: 16, paddingVertical: 12,
      marginBottom: 12,
    },
    currencySymbol: { fontSize: 20, fontWeight: '700', marginRight: 8 },
    input: { flex: 1, fontSize: 28, fontWeight: '700' },
    hint: { fontSize: 12, textAlign: 'center', marginBottom: 16 },
    confirmBtn: {
      backgroundColor: '#00C4A8',
      borderRadius: 14, padding: 16,
      alignItems: 'center', marginBottom: 10,
    },
    confirmBtnDisabled: { opacity: 0.4 },
    confirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    cancelBtn: {
      borderRadius: 14, padding: 14,
      alignItems: 'center',
    },
    cancelText: { fontSize: 15, fontWeight: '600' },
  });
}
