import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  TouchableWithoutFeedback, ScrollView,
} from 'react-native';
import { useTheme, Theme } from '../context/ThemeContext';

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const _ref = new Date();
const CURRENT_YEAR = _ref.getFullYear();
const YEARS = Array.from({ length: 15 }, (_, i) => CURRENT_YEAR - 2 + i);

interface Props {
  visible: boolean;
  currentDate?: string;
  onConfirm: (isoDate: string) => void;
  onClose: () => void;
  onClear: () => void;
}

export function DueDatePickerModal({ visible, currentDate, onConfirm, onClose, onClear }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const yearScrollRef = useRef<ScrollView>(null);

  const [pickerYear, setPickerYear]   = useState(_ref.getFullYear());
  const [pickerMonth, setPickerMonth] = useState(_ref.getMonth());
  const [pickerDay, setPickerDay]     = useState(_ref.getDate());

  useEffect(() => {
    if (visible) {
      let year: number;
      if (currentDate) {
        const d = new Date(currentDate);
        year = d.getFullYear();
        setPickerYear(year);
        setPickerMonth(d.getMonth());
        setPickerDay(d.getDate());
      } else {
        const n = new Date();
        year = n.getFullYear();
        setPickerYear(year);
        setPickerMonth(n.getMonth());
        setPickerDay(n.getDate());
      }
      // Scroll al año seleccionado (cada botón ~60px de ancho)
      const idx = YEARS.indexOf(year);
      if (idx >= 0) {
        setTimeout(() => yearScrollRef.current?.scrollTo({ x: idx * 60, animated: false }), 50);
      }
    }
  }, [visible]);

  const maxDays = new Date(pickerYear, pickerMonth + 1, 0).getDate();

  useEffect(() => {
    if (pickerDay > maxDays) setPickerDay(1);
  }, [pickerYear, pickerMonth]);

  const dayRows: (number | null)[][] = [];
  for (let i = 1; i <= maxDays; i += 7) {
    const row: (number | null)[] = Array.from(
      { length: Math.min(7, maxDays - i + 1) },
      (_, j) => i + j,
    );
    while (row.length < 7) row.push(null);
    dayRows.push(row);
  }

  const today = new Date();
  const isCurrentYearMonth = pickerYear === today.getFullYear() && pickerMonth === today.getMonth();
  const todayDay = today.getDate();

  function confirm() {
    onConfirm(new Date(pickerYear, pickerMonth, pickerDay).toISOString());
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>Fecha de vencimiento</Text>

              <Text style={styles.sectionLabel}>AÑO</Text>
              <ScrollView
                ref={yearScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.yearScroll}
                contentContainerStyle={styles.yearScrollContent}
              >
                {YEARS.map(y => (
                  <TouchableOpacity
                    key={y}
                    onPress={() => setPickerYear(y)}
                    style={[styles.yearBtn, pickerYear === y && styles.yearBtnOn]}
                  >
                    <Text style={[styles.yearBtnText, pickerYear === y && styles.yearBtnTextOn]}>
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.sectionLabel}>MES</Text>
              {([[0,1,2,3],[4,5,6,7],[8,9,10,11]] as number[][]).map((row, ri) => (
                <View key={ri} style={styles.monthRow}>
                  {row.map(i => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setPickerMonth(i)}
                      style={[styles.monthBtn, pickerMonth === i && styles.monthBtnOn]}
                    >
                      <Text style={[styles.monthBtnText, pickerMonth === i && styles.monthBtnTextOn]}>
                        {MONTHS_SHORT[i]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}

              <Text style={styles.sectionLabel}>DÍA</Text>

              {dayRows.map((row, ri) => (
                <View key={ri} style={styles.dayRow}>
                  {row.map((d, di) => {
                    if (d === null) return <View key={`empty-${di}`} style={styles.daySlot} />;
                    const isSelected = pickerDay === d;
                    const isToday    = isCurrentYearMonth && todayDay === d;
                    return (
                      <TouchableOpacity
                        key={d}
                        onPress={() => setPickerDay(d)}
                        style={[
                          styles.dayBtn,
                          isSelected && styles.dayBtnOn,
                          !isSelected && isToday && styles.dayBtnToday,
                        ]}
                      >
                        <Text style={[styles.dayBtnText, isSelected && styles.dayBtnTextOn]}>
                          {d}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              <View style={styles.pickerActions}>
                <TouchableOpacity onPress={onClear} style={styles.clearBtn}>
                  <Text style={styles.clearText}>Sin fecha</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirm} style={styles.confirmBtn}>
                  <Text style={styles.confirmText}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

function createStyles(t: Theme) {
  const btnBg     = t.isDark ? t.bg : '#F5F5F5';
  const activeBg  = t.isDark ? '#FFFFFF' : '#1A1A2E';
  const activeText = t.isDark ? t.bg : '#FFFFFF';
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    pickerCard: {
      backgroundColor: t.card,
      borderRadius: 20,
      padding: 24,
      width: '100%',
    },
    pickerTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: t.text,
      textAlign: 'center',
      marginBottom: 20,
    },
    sectionLabel: {
      fontSize: 10,
      fontWeight: '700',
      color: t.subtext,
      letterSpacing: 1,
      marginBottom: 8,
    },
    yearScroll: {
      marginBottom: 16,
    },
    yearScrollContent: {
      gap: 8,
      paddingRight: 4,
    },
    yearBtn: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: btnBg,
    },
    yearBtnOn: { backgroundColor: activeBg },
    yearBtnText: { fontSize: 13, fontWeight: '600', color: t.subtext },
    yearBtnTextOn: { color: activeText },
    monthRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    monthBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: btnBg,
      alignItems: 'center',
    },
    monthBtnOn: { backgroundColor: activeBg },
    monthBtnText: { fontSize: 13, fontWeight: '500', color: t.subtext },
    monthBtnTextOn: { color: activeText, fontWeight: '700' },
    dayRow: {
      flexDirection: 'row',
      gap: 6,
      marginBottom: 6,
    },
    dayBtn: {
      flex: 1,
      aspectRatio: 1,
      borderRadius: 100,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: btnBg,
    },
    daySlot: { flex: 1, aspectRatio: 1 },
    dayBtnOn: { backgroundColor: activeBg },
    dayBtnToday: {
      backgroundColor: btnBg,
      borderWidth: 1,
      borderColor: '#00C9B1',
    },
    dayBtnText: { fontSize: 12, fontWeight: '500', color: t.subtext },
    dayBtnTextOn: { color: activeText, fontWeight: '700' },
    pickerActions: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 12,
    },
    clearBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: btnBg,
      alignItems: 'center',
    },
    clearText: { fontSize: 12, fontWeight: '600', color: t.subtext },
    cancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: btnBg,
      alignItems: 'center',
    },
    cancelText: { fontSize: 12, fontWeight: '600', color: t.subtext },
    confirmBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: activeBg,
      alignItems: 'center',
    },
    confirmText: { fontSize: 12, fontWeight: '700', color: activeText },
  });
}
