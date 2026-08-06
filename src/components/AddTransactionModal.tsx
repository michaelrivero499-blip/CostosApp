import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Modal, Animated, Easing, ScrollView, KeyboardAvoidingView,
  Platform, ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useTheme } from '../context/ThemeContext';
import { useFinanzas } from '../context/FinanzasContext';
import { Transaction, TransactionType } from '../types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '../constants/categories';
import { interpretTransaction } from '../services/claude';

// ── Tipos ─────────────────────────────────────────────────────────────────────
type VoiceState  = 'idle' | 'recording' | 'processing';
type DateOffset  = 0 | 1 | 2; // 0=hoy, 1=ayer, 2=anteayer

const CUOTA_OPTIONS = [1, 3, 6, 9, 12] as const;
type CuotaCount = typeof CUOTA_OPTIONS[number];

interface Props {
  visible:    boolean;
  onClose:    () => void;
  initialTx?: Transaction;   // si se pasa → modo edición
}

const DATE_CHIPS: { offset: DateOffset; label: string }[] = [
  { offset: 0, label: 'Hoy' },
  { offset: 1, label: 'Ayer' },
  { offset: 2, label: 'Anteayer' },
];

function buildDate(offset: DateOffset): string {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

function offsetFromDate(iso: string): DateOffset {
  const tx   = new Date(iso); tx.setHours(12, 0, 0, 0);
  const now  = new Date();    now.setHours(12, 0, 0, 0);
  const diff = Math.round((now.getTime() - tx.getTime()) / 86400000);
  return (diff === 0 ? 0 : diff === 1 ? 1 : diff === 2 ? 2 : 0) as DateOffset;
}

// ── Componente ────────────────────────────────────────────────────────────────
export function AddTransactionModal({ visible, onClose, initialTx }: Props) {
  const { theme } = useTheme();
  const { addTransaction, editTransaction } = useFinanzas();

  const isEditing = !!initialTx;

  // Form state
  const [type, setType]           = useState<TransactionType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory]   = useState('');
  const [description, setDesc]    = useState('');
  const [dateOffset, setDateOffset] = useState<DateOffset>(0);
  const [cuotas, setCuotas]       = useState<CuotaCount>(1);
  const [saving, setSaving]       = useState(false);

  // Voice state
  const [voiceState, setVoiceState]   = useState<VoiceState>('idle');
  const [voiceTranscript, setVoiceTx] = useState('');
  const transcriptRef   = useRef('');
  const hasProcessedRef = useRef(false);
  const visibleRef      = useRef(visible);
  const autoStopRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim       = useRef(new Animated.Value(1)).current;
  const pulseLoopRef    = useRef<Animated.CompositeAnimation | null>(null);
  const voiceStateRef   = useRef<VoiceState>('idle');

  const slideAnim = useRef(new Animated.Value(600)).current;
  const inputRef  = useRef<TextInput>(null);

  const categories = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const amount     = parseFloat(amountStr.replace(',', '.')) || 0;
  const canSave    = amount > 0 && category !== '';

  // Mantener refs sincronizados
  useEffect(() => { visibleRef.current  = visible; }, [visible]);
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);

  // Slide + reset de formulario
  useEffect(() => {
    if (visible) {
      if (isEditing && initialTx) {
        // Modo edición: pre-rellenar
        setType(initialTx.type as TransactionType);
        setAmountStr(String(initialTx.amount));
        setCategory(initialTx.category);
        setDesc(initialTx.description);
        setDateOffset(offsetFromDate(initialTx.date));
      } else {
        // Modo nuevo: limpiar
        setType('expense'); setAmountStr(''); setCategory('');
        setDesc(''); setDateOffset(0); setCuotas(1);
      }
      setVoiceState('idle'); setVoiceTx('');
      transcriptRef.current = ''; hasProcessedRef.current = false;
      Animated.timing(slideAnim, {
        toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start();
    } else {
      // Cerrar: parar voz si estaba activa
      clearAutoStop();
      if (voiceStateRef.current === 'recording') ExpoSpeechRecognitionModule.stop();
      Animated.timing(slideAnim, {
        toValue: 600, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Pulse al grabar
  useEffect(() => {
    if (voiceState === 'recording') {
      pulseLoopRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.4, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1,   duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      pulseLoopRef.current.start();
    } else {
      pulseLoopRef.current?.stop();
      pulseAnim.setValue(1);
    }
  }, [voiceState]);

  // Nota: category se resetea inline en onPress del toggle para evitar
  // bug de inicialización en modo edición (el useEffect con [type] como dep
  // se dispararía al setType() del init y borraría la categoría cargada)

  // ── Speech recognition ────────────────────────────────────────────────────
  useSpeechRecognitionEvent('result', (event) => {
    if (!visibleRef.current) return;
    const text = event.results[0]?.transcript ?? '';
    transcriptRef.current = text;
    setVoiceTx(text);
  });

  useSpeechRecognitionEvent('end', () => {
    clearAutoStop();
    if (!visibleRef.current || hasProcessedRef.current) return;
    const text = transcriptRef.current.trim();
    if (!text) { setVoiceState('idle'); return; }
    processVoice(text);
  });

  useSpeechRecognitionEvent('error', () => {
    clearAutoStop();
    if (!visibleRef.current || hasProcessedRef.current) return;
    setVoiceState('idle');
  });

  function clearAutoStop() {
    if (autoStopRef.current) { clearTimeout(autoStopRef.current); autoStopRef.current = null; }
  }

  async function startVoice() {
    if (voiceState !== 'idle') return;
    transcriptRef.current = ''; hasProcessedRef.current = false;
    setVoiceTx(''); setVoiceState('recording');
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted || !visibleRef.current) { setVoiceState('idle'); return; }
    ExpoSpeechRecognitionModule.start({
      lang: 'es-AR', interimResults: true, continuous: false,
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1000,
      },
    });
    autoStopRef.current = setTimeout(() => ExpoSpeechRecognitionModule.stop(), 10000);
  }

  function stopVoice() {
    clearAutoStop();
    const text = transcriptRef.current.trim();
    if (text && !hasProcessedRef.current) { hasProcessedRef.current = true; processVoice(text); }
    ExpoSpeechRecognitionModule.stop();
  }

  async function processVoice(text: string) {
    hasProcessedRef.current = true;
    setVoiceState('processing');
    try {
      const result = await interpretTransaction(text);
      if (result.type)        setType(result.type as TransactionType);
      if (result.amount)      setAmountStr(String(result.amount));
      if (result.description) setDesc(result.description);
      if (result.category)    setCategory(result.category);
    } catch { /* falla silenciosa — el usuario completa manualmente */ }
    finally  { setVoiceState('idle'); setVoiceTx(''); }
  }

  // ── Guardar ───────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!canSave || saving) return;
    setSaving(true);
    const baseDate = buildDate(dateOffset);

    if (isEditing && initialTx) {
      await editTransaction(initialTx.id, type, amount, category, description.trim(), baseDate);
    } else if (cuotas === 1) {
      await addTransaction(type, amount, category, description.trim(), baseDate);
    } else {
      // Cuotas: dividir el monto total en N pagos mensuales
      const amountPerCuota = Math.round((amount / cuotas) * 100) / 100;
      const desc = description.trim();
      for (let i = 0; i < cuotas; i++) {
        const d = new Date(baseDate);
        d.setMonth(d.getMonth() + i);
        const cuotaDesc = `Cuota ${i + 1}/${cuotas}${desc ? ' · ' + desc : ''}`;
        await addTransaction(type, amountPerCuota, category, cuotaDesc, d.toISOString());
      }
    }

    setSaving(false);
    onClose();
  }

  // ── Colores ───────────────────────────────────────────────────────────────
  const bg         = theme.isDark ? '#0D1B2A' : '#FFFFFF';
  const handle     = theme.isDark ? '#2A3A52' : '#E5E5EA';
  const inputBg    = theme.isDark ? '#1A2744' : '#F5F5F5';
  const activeType = '#F05B53';

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { backgroundColor: bg, transform: [{ translateY: slideAnim }] }]}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: handle }]} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>
                {isEditing ? 'Editar movimiento' : 'Nuevo movimiento'}
              </Text>
              {isEditing && (
                <Text style={[styles.editHint, { color: theme.subtext }]}>Tocá un campo para modificarlo</Text>
              )}
            </View>
            <View style={styles.headerActions}>
              {/* Mic — solo en modo nuevo */}
              {!isEditing && (
                <TouchableOpacity
                  onPress={voiceState === 'recording' ? stopVoice : startVoice}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={[styles.micBtn, voiceState === 'recording' && styles.micBtnActive]}
                >
                  <Animated.Text style={[styles.micIcon, { transform: [{ scale: voiceState === 'recording' ? pulseAnim : new Animated.Value(1) }] }]}>
                    🎙️
                  </Animated.Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.closeBtn, { color: theme.subtext }]}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Banner de voz */}
          {voiceState !== 'idle' && (
            <View style={[styles.voiceBanner, { backgroundColor: inputBg }]}>
              {voiceState === 'recording' ? (
                <>
                  <View style={styles.voiceRecDot} />
                  <Text style={[styles.voiceBannerText, { color: theme.subtext }]} numberOfLines={1}>
                    {voiceTranscript || 'Escuchando... habla ahora'}
                  </Text>
                  <TouchableOpacity onPress={stopVoice} style={styles.voiceStopBtn}>
                    <Text style={styles.voiceStopText}>Detener</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <ActivityIndicator size="small" color="#F05B53" />
                  <Text style={[styles.voiceBannerText, { color: theme.subtext }]}>Interpretando...</Text>
                </>
              )}
            </View>
          )}

          {/* Tipo */}
          <View style={[styles.typeRow, { backgroundColor: inputBg }]}>
            {(['expense', 'income'] as TransactionType[]).map(t => (
              <TouchableOpacity
                key={t}
                style={[styles.typeBtn, type === t && { backgroundColor: activeType }]}
                onPress={() => { setType(t); setCategory(''); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.typeBtnText, { color: type === t ? '#fff' : theme.subtext }]}>
                  {t === 'income' ? '↑ Ingreso' : '↓ Gasto'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Monto */}
          <TouchableOpacity style={styles.amountRow} onPress={() => inputRef.current?.focus()} activeOpacity={0.9}>
            <Text style={[styles.amountCurrency, { color: theme.subtext }]}>$</Text>
            <Text style={[styles.amountDisplay, { color: amount > 0 ? theme.text : theme.subtext }]}>
              {amountStr || '0'}
            </Text>
            <TextInput
              ref={inputRef}
              value={amountStr}
              onChangeText={v => setAmountStr(v.replace(/[^0-9,\.]/g, ''))}
              keyboardType="decimal-pad"
              style={styles.hiddenInput}
              caretHidden
            />
          </TouchableOpacity>

          {/* Categorías */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll} contentContainerStyle={styles.catContent}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.catPill,
                  { backgroundColor: category === cat.id ? cat.color + '22' : inputBg },
                  category === cat.id && { borderColor: cat.color, borderWidth: 1.5 },
                ]}
                onPress={() => setCategory(cat.id)}
                activeOpacity={0.8}
              >
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <Text style={[styles.catLabel, { color: category === cat.id ? cat.color : theme.subtext }]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Descripción */}
          <TextInput
            style={[styles.descInput, { backgroundColor: inputBg, color: theme.text }]}
            placeholder="Descripción (opcional)"
            placeholderTextColor={theme.subtext}
            value={description}
            onChangeText={setDesc}
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />

          {/* Selector de fecha */}
          <View style={styles.dateRow}>
            <Text style={[styles.dateLabel, { color: theme.subtext }]}>Fecha</Text>
            <View style={styles.dateChips}>
              {DATE_CHIPS.map(({ offset, label }) => (
                <TouchableOpacity
                  key={offset}
                  style={[
                    styles.dateChip,
                    { borderColor: theme.border, backgroundColor: 'transparent' },
                    dateOffset === offset && { backgroundColor: '#00C4A8', borderColor: '#00C4A8' },
                  ]}
                  onPress={() => setDateOffset(offset)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.dateChipText, { color: dateOffset === offset ? '#fff' : theme.subtext }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cuotas — solo para gastos nuevos */}
          {type === 'expense' && !isEditing && (
            <View style={styles.cuotasRow}>
              <Text style={[styles.dateLabel, { color: theme.subtext }]}>Cuotas</Text>
              <View style={styles.cuotasChips}>
                {CUOTA_OPTIONS.map(n => (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.cuotaChip,
                      { borderColor: theme.border },
                      cuotas === n && { backgroundColor: '#00C4A8', borderColor: '#00C4A8' },
                    ]}
                    onPress={() => setCuotas(n)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cuotaChipText, { color: cuotas === n ? '#fff' : theme.subtext }]}>
                      {n === 1 ? 'Contado' : `${n}x`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Guardar */}
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            activeOpacity={0.85}
            disabled={!canSave || saving}
          >
            <Text style={styles.saveBtnText}>
              {saving
                ? 'Guardando...'
                : isEditing
                  ? 'Guardar cambios'
                  : cuotas > 1
                    ? `Agregar ${cuotas} cuotas de $${amount > 0 ? Math.round(amount / cuotas).toLocaleString('es-AR') : '0'}`
                    : 'Agregar'}
            </Text>
          </TouchableOpacity>

        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:         { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 },
  handle:        { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 4 },

  header:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 20, paddingVertical: 14 },
  title:         { fontSize: 17, fontWeight: '700' },
  editHint:      { fontSize: 11, marginTop: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 2 },
  micBtn:        { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  micBtnActive:  { backgroundColor: '#F05B5322' },
  micIcon:       { fontSize: 20 },
  closeBtn:      { fontSize: 18 },

  voiceBanner:     { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12 },
  voiceRecDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#F05B53' },
  voiceBannerText: { flex: 1, fontSize: 13, fontStyle: 'italic' },
  voiceStopBtn:    { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#F05B5322', borderRadius: 8 },
  voiceStopText:   { fontSize: 12, fontWeight: '700', color: '#F05B53' },

  typeRow:       { flexDirection: 'row', marginHorizontal: 20, borderRadius: 12, padding: 4, marginBottom: 16 },
  typeBtn:       { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  typeBtnText:   { fontSize: 14, fontWeight: '600' },

  amountRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, marginBottom: 16, gap: 4 },
  amountCurrency:{ fontSize: 32, fontWeight: '300', marginTop: 8 },
  amountDisplay: { fontSize: 56, fontWeight: '700', letterSpacing: -2, minWidth: 80 },
  hiddenInput:   { position: 'absolute', opacity: 0, width: 1, height: 1 },

  catScroll:     { marginBottom: 16 },
  catContent:    { paddingHorizontal: 20, gap: 8 },
  catPill:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 6, borderWidth: 1.5, borderColor: 'transparent' },
  catEmoji:      { fontSize: 16 },
  catLabel:      { fontSize: 13, fontWeight: '600' },

  descInput:     { marginHorizontal: 20, borderRadius: 12, padding: 14, fontSize: 15, marginBottom: 12 },

  dateRow:       { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16, gap: 10 },
  dateLabel:     { fontSize: 13, fontWeight: '600', minWidth: 38 },
  dateChips:     { flexDirection: 'row', gap: 8 },
  dateChip:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  dateChipText:  { fontSize: 13, fontWeight: '600' },

  cuotasRow:      { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 16, gap: 10 },
  cuotasChips:    { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  cuotaChip:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  cuotaChipText:  { fontSize: 13, fontWeight: '600' },

  saveBtn:       { marginHorizontal: 20, backgroundColor: '#00C4A8', borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#00C4A8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 6 },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' },
});
