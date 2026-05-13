import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  ActivityIndicator, Animated, Easing, ScrollView, Linking,
} from 'react-native';
import { Audio } from 'expo-av';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { interpretDebt, InterpretedDebt } from '../services/claude';
import { DebtDirection, Person, Currency } from '../types';
import { formatAmountCurrency, DIRECTION_COLORS, CURRENCY_SYMBOLS, CURRENCY_NAMES } from '../utils';
import { MicIcon } from './MicIcon';

type ModalState = 'recording' | 'processing' | 'preview' | 'error';

interface Props {
  visible: boolean;
  onClose: () => void;
  personId?: string;
  personName?: string;
  persons?: Person[];
  onSave: (personId: string, description: string, amount: number, direction: DebtDirection, currency: Currency) => Promise<void>;
}

export function VoiceDebtModal({ visible, onClose, personId, personName, persons = [], onSave }: Props) {
  const [state, setState] = useState<ModalState>('recording');
  const [transcript, setTranscript] = useState('');
  const [interpreted, setInterpreted] = useState<InterpretedDebt | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(personId ?? null);
  const [error, setError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [saving, setSaving] = useState(false);

  const transcriptRef = useRef('');
  const hasProcessedRef = useRef(false);
  const visibleRef = useRef(visible);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  // Pulse animation for recording state
  useEffect(() => {
    if (state === 'recording') {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3, duration: 700,
            easing: Easing.inOut(Easing.ease), useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1, duration: 700,
            easing: Easing.inOut(Easing.ease), useNativeDriver: true,
          }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [state]);

  // Start recognition when visible
  useEffect(() => {
    if (!visible) return;
    transcriptRef.current = '';
    hasProcessedRef.current = false;
    setTranscript('');
    setInterpreted(null);
    setError('');
    setPermissionDenied(false);
    setSaving(false);
    setState('recording');
    setSelectedPersonId(personId ?? null);

    Audio.requestPermissionsAsync().then(({ granted }) => {
      if (!visibleRef.current) return;
      if (!granted) {
        setPermissionDenied(true);
        setError('CostosApp necesita acceso al micrófono para registrar deudas por voz. Habilitalo en Configuración de la app.');
        setState('error');
        return;
      }
      startRecognition();
    });
  }, [visible]);

  function startRecognition() {
    clearAutoStopTimer();
    ExpoSpeechRecognitionModule.start({
      lang: 'es-AR',
      interimResults: true,
      continuous: false,
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1000,
      },
    });
    // Auto-stop after 10s so the UI never hangs
    autoStopTimerRef.current = setTimeout(() => {
      ExpoSpeechRecognitionModule.stop();
    }, 10000);
  }

  function clearAutoStopTimer() {
    if (autoStopTimerRef.current) {
      clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }

  useSpeechRecognitionEvent('result', (event) => {
    if (!visibleRef.current) return;
    const text = event.results[0]?.transcript ?? '';
    transcriptRef.current = text;
    setTranscript(text);
  });

  useSpeechRecognitionEvent('end', () => {
    clearAutoStopTimer();
    if (!visibleRef.current || hasProcessedRef.current) return;
    const text = transcriptRef.current.trim();
    if (!text) {
      setError('No se detectó ninguna frase. Intentá de nuevo.');
      setState('error');
      return;
    }
    processTranscript(text);
  });

  useSpeechRecognitionEvent('error', (event) => {
    clearAutoStopTimer();
    if (!visibleRef.current || hasProcessedRef.current) return;
    setError(`Error de reconocimiento: ${event.error}`);
    setState('error');
  });

  async function processTranscript(text: string) {
    hasProcessedRef.current = true;
    setState('processing');
    try {
      const result = await interpretDebt(text, personName);
      setInterpreted(result);
      if (!personId && result.nombre && persons.length > 0) {
        const nameLower = result.nombre.toLowerCase();
        const match = persons.find(p => {
          const pLower = p.name.toLowerCase();
          return pLower.includes(nameLower) || nameLower.includes(pLower.split(' ')[0]);
        });
        if (match) setSelectedPersonId(match.id);
      }
      setState('preview');
    } catch (e: any) {
      setError(e?.message ?? 'Error al interpretar con Claude API.');
      setState('error');
    }
  }

  function handleStop() {
    clearAutoStopTimer();
    // Process immediately with whatever transcript we have — don't wait for 'end' event
    const text = transcriptRef.current.trim();
    if (text && !hasProcessedRef.current) {
      hasProcessedRef.current = true;
      processTranscript(text);
    }
    ExpoSpeechRecognitionModule.stop();
  }

  function handleRetry() {
    transcriptRef.current = '';
    hasProcessedRef.current = false;
    setTranscript('');
    setError('');
    setPermissionDenied(false);
    setState('recording');
    Audio.requestPermissionsAsync().then(({ granted }) => {
      if (!visibleRef.current) return;
      if (!granted) {
        setPermissionDenied(true);
        setError('CostosApp necesita acceso al micrófono para registrar deudas por voz. Habilitalo en Configuración de la app.');
        setState('error');
        return;
      }
      startRecognition();
    });
  }

  async function handleConfirm() {
    if (!interpreted || !selectedPersonId) return;
    const { monto, descripcion, direccion, currency } = interpreted;
    if (!monto || !descripcion || !direccion) return;
    setSaving(true);
    try {
      await onSave(selectedPersonId, descripcion, monto, direccion, (currency ?? 'ARS') as Currency);
    } finally {
      setSaving(false);
    }
    onClose();
  }

  function handleClose() {
    clearAutoStopTimer();
    if (state === 'recording') ExpoSpeechRecognitionModule.stop();
    onClose();
  }

  const canConfirm =
    !!interpreted &&
    !!selectedPersonId &&
    !!interpreted.monto &&
    !!interpreted.descripcion &&
    !!interpreted.direccion;
  // currency always has a fallback ('ARS'), so it doesn't block confirm

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={state === 'recording' ? undefined : handleClose}>
        <TouchableOpacity activeOpacity={1} style={styles.sheet} onPress={() => {}}>

          {/* Recording state */}
          {state === 'recording' && (
            <View style={styles.stateContainer}>
              <Text style={styles.sheetTitle}>Escuchando...</Text>

              <Animated.View style={[styles.micRing, { transform: [{ scale: pulseAnim }] }]}>
                <View style={styles.micCircle}>
                  <MicIcon size={28} color="#FFFFFF" strokeWidth={2} />
                </View>
              </Animated.View>

              {transcript ? (
                <Text style={styles.transcriptText} numberOfLines={3}>{transcript}</Text>
              ) : (
                <Text style={styles.hintText}>Decí algo como "Juan me debe 500 pesos de pizza"</Text>
              )}

              <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
                <Text style={styles.stopBtnText}>Detener</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelLink} onPress={handleClose}>
                <Text style={styles.cancelLinkText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Processing state */}
          {state === 'processing' && (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="large" color="#F05B53" style={{ marginBottom: 16 }} />
              <Text style={styles.sheetTitle}>Interpretando...</Text>
              {transcript ? (
                <Text style={styles.transcriptText} numberOfLines={3}>{transcript}</Text>
              ) : null}
            </View>
          )}

          {/* Preview state */}
          {state === 'preview' && interpreted && (
            <View style={styles.stateContainer}>
              <Text style={styles.sheetTitle}>Confirmar deuda</Text>

              {/* Person selector (only in HomeScreen context) */}
              {!personId && persons.length > 0 && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>PERSONA</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.personRow}>
                    {persons.map(p => (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => setSelectedPersonId(p.id)}
                        style={[styles.personChip, selectedPersonId === p.id && styles.personChipActive]}
                      >
                        <Text style={styles.personChipEmoji}>{p.avatar}</Text>
                        <Text style={[
                          styles.personChipText,
                          selectedPersonId === p.id && styles.personChipTextActive,
                        ]}>
                          {p.name.split(' ')[0]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {!selectedPersonId && (
                    <Text style={styles.warningText}>Seleccioná una persona</Text>
                  )}
                </View>
              )}

              {/* Description */}
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>CONCEPTO</Text>
                <View style={styles.fieldValue}>
                  <Text style={styles.fieldValueText}>
                    {interpreted.descripcion ?? <Text style={styles.nullText}>No detectado</Text>}
                  </Text>
                </View>
              </View>

              {/* Amount + Currency + Direction */}
              <View style={styles.rowFields}>
                <View style={[styles.fieldBlock, { flex: 1 }]}>
                  <Text style={styles.fieldLabel}>MONTO</Text>
                  <View style={styles.fieldValue}>
                    <Text style={[styles.fieldValueText, styles.amountText]}>
                      {interpreted.monto
                        ? formatAmountCurrency(interpreted.monto, (interpreted.currency ?? 'ARS') as Currency)
                        : <Text style={styles.nullText}>—</Text>}
                    </Text>
                  </View>
                </View>
                <View style={[styles.fieldBlock, { flex: 0.7 }]}>
                  <Text style={styles.fieldLabel}>MONEDA</Text>
                  <View style={styles.fieldValue}>
                    <Text style={styles.fieldValueText}>
                      {interpreted.currency
                        ? `${CURRENCY_SYMBOLS[interpreted.currency as Currency]} ${interpreted.currency}`
                        : 'ARS'}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>DIRECCIÓN</Text>
                <View style={[
                  styles.fieldValue,
                  interpreted.direccion && { backgroundColor: DIRECTION_COLORS[interpreted.direccion] + '18' },
                ]}>
                  <Text style={[
                    styles.fieldValueText,
                    interpreted.direccion && { color: DIRECTION_COLORS[interpreted.direccion] },
                  ]}>
                    {interpreted.direccion === 'me_debe' ? 'Me debe'
                      : interpreted.direccion === 'le_debo' ? 'Le debo'
                      : <Text style={styles.nullText}>—</Text>}
                  </Text>
                </View>
              </View>

              {(!interpreted.monto || !interpreted.descripcion || !interpreted.direccion) && (
                <Text style={styles.warningText}>Algunos campos no se detectaron. Podés reintentar.</Text>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
                  <Text style={styles.retryBtnText}>Reintentar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, (!canConfirm || saving) && styles.confirmBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={!canConfirm || saving}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#FFF" />
                    : <Text style={styles.confirmBtnText}>Guardar</Text>
                  }
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelLink} onPress={handleClose}>
                <Text style={styles.cancelLinkText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Error state */}
          {state === 'error' && (
            <View style={styles.stateContainer}>
              <Text style={styles.errorEmoji}>{permissionDenied ? '🔒' : '⚠️'}</Text>
              <Text style={styles.sheetTitle}>
                {permissionDenied ? 'Permiso de micrófono' : 'Ocurrió un error'}
              </Text>
              <Text style={styles.errorText}>{error}</Text>
              {permissionDenied ? (
                <TouchableOpacity style={styles.stopBtn} onPress={() => Linking.openSettings()}>
                  <Text style={styles.stopBtnText}>Ir a Configuración</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.stopBtn} onPress={handleRetry}>
                  <Text style={styles.stopBtnText}>Reintentar</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.cancelLink} onPress={handleClose}>
                <Text style={styles.cancelLinkText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  stateContainer: {
    alignItems: 'center',
    paddingTop: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A2E',
    marginBottom: 20,
  },
  micRing: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F05B5322',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  micCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F05B53',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcriptText: {
    fontSize: 15,
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  hintText: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  stopBtn: {
    backgroundColor: '#1A1A2E',
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    marginBottom: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  stopBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelLink: {
    paddingVertical: 8,
  },
  cancelLinkText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  errorEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  // Preview fields
  fieldBlock: {
    width: '100%',
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 4,
  },
  fieldValue: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldValueText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1A1A2E',
  },
  nullText: {
    color: '#C7C7CC',
    fontStyle: 'italic',
  },
  amountText: {
    fontWeight: '700',
    fontSize: 17,
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  warningText: {
    fontSize: 12,
    color: '#FF9500',
    textAlign: 'center',
    marginBottom: 8,
  },
  personRow: {
    flexDirection: 'row',
  },
  personChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    marginRight: 8,
    backgroundColor: '#FFFFFF',
  },
  personChipActive: {
    backgroundColor: '#1A1A2E',
    borderColor: '#1A1A2E',
  },
  personChipEmoji: {
    fontSize: 14,
  },
  personChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
  },
  personChipTextActive: {
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
    marginBottom: 8,
  },
  retryBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  retryBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  confirmBtn: {
    flex: 2,
    backgroundColor: '#F05B53',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#F05B53',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  confirmBtnDisabled: {
    backgroundColor: '#C7C7CC',
    shadowOpacity: 0,
    elevation: 0,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
