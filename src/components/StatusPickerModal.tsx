import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Debt, DebtStatus } from '../types';
import { STATUS_COLORS } from '../utils';

interface Props {
  visible: boolean;
  debt: Debt | null;
  onSelect: (debtId: string, status: DebtStatus) => void;
  onClose: () => void;
}

const OPTIONS: { status: DebtStatus; label: string; emoji: string; description: string }[] = [
  { status: 'pendiente', label: 'Pendiente', emoji: '⏳', description: 'Aún no se pagó' },
  { status: 'pagado',    label: 'Pagado',    emoji: '✅', description: 'Deuda saldada' },
];

export function StatusPickerModal({ visible, debt, onSelect, onClose }: Props) {
  if (!debt) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Estado de la deuda</Text>
          <Text style={styles.subtitle} numberOfLines={1}>{debt.description}</Text>

          {OPTIONS.map(opt => {
            const isSelected = debt.status === opt.status;
            return (
              <TouchableOpacity
                key={opt.status}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => { onSelect(debt.id, opt.status); onClose(); }}
                activeOpacity={0.7}
              >
                <View style={[styles.indicator, { backgroundColor: STATUS_COLORS[opt.status] }]} />
                <View style={styles.optionContent}>
                  <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                    {opt.emoji}  {opt.label}
                  </Text>
                  <Text style={styles.optionDesc}>{opt.description}</Text>
                </View>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#E5E5EA',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    backgroundColor: '#FFF5F5',
    borderColor: '#F05B53',
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 1,
  },
  optionLabelSelected: {
    color: '#F05B53',
  },
  optionDesc: {
    fontSize: 12,
    color: '#8E8E93',
  },
  checkmark: {
    fontSize: 16,
    color: '#F05B53',
    fontWeight: '700',
  },
  cancelBtn: {
    marginTop: 4,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8E8E93',
  },
});
