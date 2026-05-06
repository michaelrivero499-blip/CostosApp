import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, TouchableWithoutFeedback, Keyboard,
  Platform, KeyboardEvent, Animated,
} from 'react-native';
import { DebtDirection } from '../types';
import { DIRECTION_COLORS } from '../utils';

interface Props {
  visible: boolean;
  personName: string;
  onClose: () => void;
  onSave: (description: string, amount: number, direction: DebtDirection) => void;
}

export function AddDebtModal({ visible, personName, onClose, onSave }: Props) {
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('me_debe');
  const [keyboardHeight] = useState(new Animated.Value(0));

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e: KeyboardEvent) => {
        Animated.timing(keyboardHeight, {
          toValue: e.endCoordinates.height,
          duration: Platform.OS === 'ios' ? e.duration : 200,
          useNativeDriver: false,
        }).start();
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        Animated.timing(keyboardHeight, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }).start();
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  function handleSave() {
    const amount = parseFloat(amountText.replace(',', '.'));
    if (!description.trim() || isNaN(amount) || amount <= 0) return;
    onSave(description.trim(), amount, direction);
    setDescription('');
    setAmountText('');
    setDirection('me_debe');
    onClose();
  }

  function handleClose() {
    Keyboard.dismiss();
    setDescription('');
    setAmountText('');
    setDirection('me_debe');
    onClose();
  }

  const isValid = description.trim().length > 0 && parseFloat(amountText.replace(',', '.')) > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.sheet, { marginBottom: keyboardHeight }]}>
              <View style={styles.handle} />
              <ScrollView
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                <Text style={styles.title}>Nueva deuda</Text>
                <Text style={styles.subtitle}>Para {personName}</Text>

                <Text style={styles.label}>Direccion</Text>
                <View style={styles.toggle}>
                  <TouchableOpacity
                    style={[
                      styles.toggleOption,
                      direction === 'me_debe' && {
                        backgroundColor: DIRECTION_COLORS.me_debe + '18',
                        borderColor: DIRECTION_COLORS.me_debe,
                      },
                    ]}
                    onPress={() => setDirection('me_debe')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.toggleText,
                      direction === 'me_debe' && { color: DIRECTION_COLORS.me_debe, fontWeight: '700' },
                    ]}>
                      Me debe
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.toggleOption,
                      direction === 'le_debo' && {
                        backgroundColor: DIRECTION_COLORS.le_debo + '18',
                        borderColor: DIRECTION_COLORS.le_debo,
                      },
                    ]}
                    onPress={() => setDirection('le_debo')}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.toggleText,
                      direction === 'le_debo' && { color: DIRECTION_COLORS.le_debo, fontWeight: '700' },
                    ]}>
                      Le debo
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Descripcion</Text>
                <TextInput
                  style={styles.input}
                  placeholder="De que es la deuda?"
                  placeholderTextColor="#C7C7CC"
                  value={description}
                  onChangeText={setDescription}
                  autoFocus
                  maxLength={60}
                  returnKeyType="next"
                />

                <Text style={styles.label}>Monto ($)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="El precio o costo"
                  placeholderTextColor="#C7C7CC"
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="numeric"
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />

                <View style={styles.buttons}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!isValid}
                  >
                    <Text style={styles.saveText}>Agregar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
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
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  toggle: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  toggleOption: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#8E8E93',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1A1A2E',
    marginBottom: 20,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8E8E93',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#F05B53',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
