import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, TouchableWithoutFeedback, Keyboard,
  Platform, KeyboardEvent, Animated, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { AVATAR_OPTIONS } from '../utils';
import { useTheme, Theme } from '../context/ThemeContext';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (name: string, avatar: string, color: string, photoUri?: string) => void;
  initialValues?: { name: string; avatar: string; color: string };
}

export function AddPersonModal({ visible, onClose, onSave, initialValues }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [keyboardHeight] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible && initialValues) {
      setName(initialValues.name);
      const idx = AVATAR_OPTIONS.findIndex(o => o.emoji === initialValues.avatar);
      setSelectedAvatar(idx >= 0 ? idx : 0);
      setPhotoUri(null);
    } else if (!visible) {
      setName('');
      setSelectedAvatar(0);
      setPhotoUri(null);
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

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled) setPhotoUri(result.assets[0].uri);
  }

  function handleSave() {
    if (!name.trim()) return;
    const { emoji, color } = AVATAR_OPTIONS[selectedAvatar];
    onSave(name.trim(), emoji, color, photoUri ?? undefined);
    setName(''); setSelectedAvatar(0); setPhotoUri(null); onClose();
  }

  function handleClose() {
    Keyboard.dismiss();
    setName(''); setSelectedAvatar(0); setPhotoUri(null); onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.sheet, { marginBottom: keyboardHeight }]}>
              <View style={styles.handle} />
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
                <Text style={styles.title}>{initialValues ? 'Editar persona' : 'Nueva persona'}</Text>

                <TouchableOpacity style={styles.photoPickerContainer} onPress={handlePickImage} activeOpacity={0.8}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                  ) : (
                    <View style={styles.photoPlaceholder}>
                      <Text style={{ fontSize: 28 }}>📷</Text>
                    </View>
                  )}
                  <Text style={styles.photoLabel}>{photoUri ? 'Cambiar foto' : 'Agregar foto'}</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Nombre</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Ej: Cielo, Michael..."
                  placeholderTextColor={theme.isDark ? '#3A4F6A' : '#C7C7CC'}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  maxLength={30}
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />

                <Text style={styles.label}>Avatar</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.avatarScroll}
                  keyboardShouldPersistTaps="handled"
                >
                  {AVATAR_OPTIONS.map((opt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => setSelectedAvatar(idx)}
                      style={[
                        styles.avatarOption,
                        { backgroundColor: opt.color },
                        selectedAvatar === idx && styles.avatarSelected,
                      ]}
                    >
                      <Text style={styles.avatarEmoji}>{opt.emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={styles.buttons}>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleClose}>
                    <Text style={styles.cancelText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.saveBtn, !name.trim() && styles.saveBtnDisabled]}
                    onPress={handleSave}
                    disabled={!name.trim()}
                  >
                    <Text style={styles.saveText}>Guardar</Text>
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

function createStyles(t: Theme) {
  const inputBg = t.isDark ? t.bg : '#F5F5F5';
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
      marginBottom: 20, textAlign: 'center',
    },
    label: {
      fontSize: 13, fontWeight: '600',
      color: t.subtext,
      textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
    },
    input: {
      backgroundColor: inputBg,
      borderRadius: 12, padding: 14,
      fontSize: 16, color: t.text,
      marginBottom: 20,
    },
    photoPickerContainer: {
      alignItems: 'center',
      marginBottom: 20,
    },
    photoPlaceholder: {
      width: 72, height: 72, borderRadius: 36,
      backgroundColor: t.isDark ? t.bg : '#F0F0F0',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 6,
    },
    photoPreview: {
      width: 72, height: 72, borderRadius: 36,
      marginBottom: 6,
    },
    photoLabel: {
      fontSize: 12, color: t.subtext, fontWeight: '500',
    },
    avatarScroll: { marginBottom: 24 },
    avatarOption: {
      width: 52, height: 52,
      borderRadius: 26,
      alignItems: 'center', justifyContent: 'center',
      marginRight: 10,
    },
    avatarSelected: {
      borderWidth: 3,
      borderColor: t.text,
    },
    avatarEmoji: { fontSize: 24 },
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
