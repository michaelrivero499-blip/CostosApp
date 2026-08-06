import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, TouchableWithoutFeedback, Keyboard,
  Platform, KeyboardEvent, Animated, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { DebtDirection, Currency } from '../types';
import { DIRECTION_COLORS, CURRENCY_ORDER, CURRENCY_SYMBOLS } from '../utils';
import { useTheme, Theme } from '../context/ThemeContext';
import { DueDatePickerModal } from './DueDatePickerModal';
import { PhotoViewerModal } from './PhotoViewerModal';

interface InitialValues {
  description: string;
  amount: number;
  direction: DebtDirection;
  currency: Currency;
  dueDate?: string;
  notes?: string;
  photoUrl?: string;
}

interface Props {
  visible: boolean;
  personName: string;
  onClose: () => void;
  onSave: (description: string, amount: number, direction: DebtDirection, currency: Currency, dueDate?: string, notes?: string, photoUri?: string) => void;
  initialValues?: InitialValues;
}

export function AddDebtModal({ visible, personName, onClose, onSave, initialValues }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [direction, setDirection] = useState<DebtDirection>('me_debe');
  const [currency, setCurrency] = useState<Currency>('ARS');
  const [dueDateText, setDueDateText] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [keyboardHeight] = useState(new Animated.Value(0));

  const isEditMode = initialValues !== undefined;

  function formatDateForInput(iso: string): string {
    const d = new Date(iso);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  function parseDateInput(text: string): string | undefined {
    const parts = text.split('/');
    if (parts.length !== 3) return undefined;
    const [day, month, year] = parts.map(Number);
    if (!day || !month || !year || year < 2020) return undefined;
    const d = new Date(year, month - 1, day);
    if (isNaN(d.getTime())) return undefined;
    return d.toISOString();
  }

  useEffect(() => {
    if (visible && initialValues) {
      setDescription(initialValues.description);
      setAmountText(String(initialValues.amount));
      setDirection(initialValues.direction);
      setCurrency(initialValues.currency);
      setDueDateText(initialValues.dueDate ? formatDateForInput(initialValues.dueDate) : '');
      setNotes(initialValues.notes ?? '');
      setPhotoUri(null);
    } else if (!visible) {
      setDescription(''); setAmountText(''); setDirection('me_debe');
      setCurrency('ARS'); setDueDateText(''); setNotes(''); setPhotoUri(null);
    }
  }, [visible]);

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
        Animated.timing(keyboardHeight, { toValue: 0, duration: 200, useNativeDriver: false }).start();
      }
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  function handleSave() {
    const amount = parseFloat(amountText.replace(',', '.'));
    if (!description.trim() || isNaN(amount) || amount <= 0) return;
    const dueDate = dueDateText.trim() ? parseDateInput(dueDateText.trim()) : undefined;
    onSave(description.trim(), amount, direction, currency, dueDate, notes.trim() || undefined, photoUri ?? undefined);
    onClose();
  }

  function handleClose() {
    Keyboard.dismiss();
    onClose();
  }

  const isValid = description.trim().length > 0 && parseFloat(amountText.replace(',', '.')) > 0;
  const placeholderColor = theme.isDark ? '#3A4F6A' : '#C7C7CC';

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.sheet, { marginBottom: keyboardHeight }]}>
              <View style={styles.handle} />
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
                <Text style={styles.title}>{isEditMode ? 'Editar deuda' : 'Nueva deuda'}</Text>
                <Text style={styles.subtitle}>Para {personName}</Text>

                <Text style={styles.label}>Dirección</Text>
                <View style={styles.toggle}>
                  <TouchableOpacity
                    style={[styles.toggleOption, direction === 'me_debe' && {
                      backgroundColor: DIRECTION_COLORS.me_debe + '18',
                      borderColor: DIRECTION_COLORS.me_debe,
                    }]}
                    onPress={() => setDirection('me_debe')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.toggleText, direction === 'me_debe' && { color: DIRECTION_COLORS.me_debe, fontWeight: '700' }]}>
                      Me debe
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleOption, direction === 'le_debo' && {
                      backgroundColor: DIRECTION_COLORS.le_debo + '18',
                      borderColor: DIRECTION_COLORS.le_debo,
                    }]}
                    onPress={() => setDirection('le_debo')}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.toggleText, direction === 'le_debo' && { color: DIRECTION_COLORS.le_debo, fontWeight: '700' }]}>
                      Le debo
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Descripción</Text>
                <TextInput
                  style={styles.input}
                  placeholder="De qué es la deuda?"
                  placeholderTextColor={placeholderColor}
                  value={description}
                  onChangeText={setDescription}
                  autoFocus
                  maxLength={60}
                  returnKeyType="next"
                />

                <Text style={styles.label}>Moneda</Text>
                <View style={styles.currencyRow}>
                  {CURRENCY_ORDER.map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.currencyChip, currency === c && styles.currencyChipActive]}
                      onPress={() => setCurrency(c)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.currencyChipText, currency === c && styles.currencyChipTextActive]}>
                        {CURRENCY_SYMBOLS[c]} {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Monto ({CURRENCY_SYMBOLS[currency]})</Text>
                <TextInput
                  style={styles.input}
                  placeholder="El precio o costo"
                  placeholderTextColor={placeholderColor}
                  value={amountText}
                  onChangeText={setAmountText}
                  keyboardType="numeric"
                  maxLength={10}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />

                <Text style={styles.label}>Vencimiento (opcional)</Text>
                <TouchableOpacity
                  style={[styles.input, { justifyContent: 'center' }]}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Text style={{ color: dueDateText ? theme.text : placeholderColor, fontSize: 16 }}>
                    {dueDateText || 'Seleccionar fecha'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.label}>Notas (opcional)</Text>
                <TextInput
                  style={[styles.input, styles.notesInput]}
                  placeholder="Detalles adicionales..."
                  placeholderTextColor={placeholderColor}
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  maxLength={300}
                  textAlignVertical="top"
                />

                <Text style={styles.label}>Foto / Comprobante (opcional)</Text>
                <TouchableOpacity style={styles.photoBtn} onPress={handlePickPhoto} activeOpacity={0.8}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={styles.photoBtnIcon}>📷</Text>
                      <Text style={styles.photoBtnText}>
                        {initialValues?.photoUrl ? 'Cambiar foto' : 'Agregar foto'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                {photoUri && (
                  <TouchableOpacity onPress={() => setViewingPhoto(photoUri)} style={styles.viewPhotoBtn}>
                    <Text style={styles.viewPhotoText}>Ver foto completa</Text>
                  </TouchableOpacity>
                )}
                {initialValues?.photoUrl && !photoUri && (
                  <TouchableOpacity onPress={() => setViewingPhoto(initialValues.photoUrl!)} activeOpacity={0.85}>
                    <Image source={{ uri: initialValues.photoUrl }} style={styles.existingPhoto} />
                  </TouchableOpacity>
                )}

                <View style={styles.buttons}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!isValid}
                  >
                    <Text style={styles.saveText}>{isEditMode ? 'Guardar' : 'Agregar'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>

              <PhotoViewerModal
                uri={viewingPhoto}
                onClose={() => setViewingPhoto(null)}
              />

              <DueDatePickerModal
                visible={showDatePicker}
                currentDate={parseDateInput(dueDateText)}
                onConfirm={(iso) => {
                  setDueDateText(formatDateForInput(iso));
                  setShowDatePicker(false);
                }}
                onClear={() => {
                  setDueDateText('');
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
              />
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function createStyles(t: Theme) {
  const inputBg  = t.isDark ? t.bg : '#F5F5F5';
  const raisedBg = t.isDark ? t.bg : '#F8F8F8';
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: t.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 24,
    },
    handle: {
      width: 36, height: 4,
      backgroundColor: t.border,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 20, fontWeight: '700',
      color: t.text,
      marginBottom: 4, textAlign: 'center',
    },
    subtitle: {
      fontSize: 14, color: t.subtext,
      textAlign: 'center', marginBottom: 20,
    },
    label: {
      fontSize: 13, fontWeight: '600',
      color: t.subtext,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
    },
    toggle: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    toggleOption: {
      flex: 1, borderWidth: 1.5,
      borderColor: t.border,
      borderRadius: 12, paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: raisedBg,
    },
    toggleText: { fontSize: 14, fontWeight: '500', color: t.subtext },
    currencyRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
    currencyChip: {
      paddingHorizontal: 14, paddingVertical: 8,
      borderRadius: 20, borderWidth: 1.5,
      borderColor: t.border,
      backgroundColor: raisedBg,
    },
    currencyChipActive: {
      backgroundColor: t.text,
      borderColor: t.text,
    },
    currencyChipText: { fontSize: 13, fontWeight: '600', color: t.subtext },
    currencyChipTextActive: { color: t.isDark ? t.bg : '#FFFFFF' },
    input: {
      backgroundColor: inputBg,
      borderRadius: 12, padding: 14,
      fontSize: 16, color: t.text,
      marginBottom: 20,
    },
    notesInput: {
      height: 80,
      paddingTop: 14,
    },
    photoBtn: {
      marginBottom: 20,
      borderRadius: 12,
      overflow: 'hidden',
    },
    photoPlaceholder: {
      backgroundColor: inputBg,
      borderRadius: 12,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    photoBtnIcon: { fontSize: 20 },
    photoBtnText: { fontSize: 14, color: t.subtext, fontWeight: '500' },
    photoPreview: {
      width: '100%',
      height: 160,
      borderRadius: 12,
    },
    existingPhoto: {
      width: '100%',
      height: 160,
      borderRadius: 12,
      marginBottom: 20,
      marginTop: -12,
    },
    viewPhotoBtn: {
      alignSelf: 'flex-end',
      marginTop: -12,
      marginBottom: 16,
      paddingHorizontal: 4,
      paddingVertical: 4,
    },
    viewPhotoText: { fontSize: 12, color: t.subtext, fontWeight: '500' },
    buttons: { flexDirection: 'row', gap: 12, marginBottom: 8 },
    cancelBtn: {
      flex: 1, backgroundColor: inputBg,
      borderRadius: 14, padding: 16, alignItems: 'center',
    },
    cancelText: { fontSize: 16, fontWeight: '600', color: t.subtext },
    saveBtn: {
      flex: 1, backgroundColor: '#00C4A8',
      borderRadius: 14, padding: 16, alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  });
}
