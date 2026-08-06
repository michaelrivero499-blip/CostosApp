import React, { useState, useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Image, TouchableWithoutFeedback, Alert,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, Theme } from '../context/ThemeContext';
import { effectiveAmount, formatAmountCurrency, DIRECTION_COLORS, CURRENCY_SYMBOLS } from '../utils';
import { Debt, Person, Currency } from '../types';

interface Props {
  visible: boolean;
  person: Person;
  debts: Debt[];          // solo deudas pendientes
  onClose: () => void;
}

const MONTHS_ES = [
  'enero','febrero','marzo','abril','mayo','junio',
  'julio','agosto','septiembre','octubre','noviembre','diciembre',
];
const MONTHS_CAP = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

function dateLabel(): string {
  const d = new Date();
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function pdfFilename(personName: string): string {
  const d = new Date();
  const safeName = personName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  return `vera-recordatorio-${safeName}-${d.getDate()}-${MONTHS_ES[d.getMonth()]}-${d.getFullYear()}.pdf`;
}

// ─── Modal principal ─────────────────────────────────────────────────────────

export function ReminderImageModal({ visible, person, debts, onClose }: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [step, setStep]         = useState<'select' | 'confirm'>('select');
  const [selected, setSelected] = useState<Set<string>>(new Set(debts.map(d => d.id)));
  const [sharing, setSharing]   = useState(false);

  // Reset al abrir
  React.useEffect(() => {
    if (visible) {
      setStep('select');
      setSelected(new Set(debts.map(d => d.id)));
    }
  }, [visible]);

  const selectedDebts = debts.filter(d => selected.has(d.id));

  // Neto por moneda de las deudas seleccionadas
  const netByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    selectedDebts.forEach(d => {
      const c   = d.currency ?? 'ARS';
      const eff = effectiveAmount(d);
      map[c] = (map[c] ?? 0) + (d.direction === 'me_debe' ? eff : -eff);
    });
    return Object.entries(map)
      .filter(([, v]) => v !== 0)
      .map(([c, net]) => ({ currency: c as Currency, net }));
  }, [selectedDebts]);

  function toggleDebt(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === debts.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(debts.map(d => d.id)));
    }
  }

  // ── Generar HTML para el PDF ─────────────────────────────────────────────
  function buildHtml(logoSrc: string | null): string {
    const dateStr = dateLabel();

    const mainDirection = selectedDebts.every(d => d.direction === 'me_debe')
      ? 'me_debe'
      : selectedDebts.every(d => d.direction === 'le_debo')
      ? 'le_debo'
      : 'mixed';

    const headerLine =
      mainDirection === 'me_debe' ? 'te recuerdo que tenés pendiente conmigo:'
      : mainDirection === 'le_debo' ? 'te recuerdo lo que tengo pendiente contigo:'
      : 'te recuerdo las deudas pendientes entre nosotros:';

    const logoHtml = logoSrc
      ? `<img src="${logoSrc}" style="width:42px;height:42px;border-radius:10px;object-fit:cover;flex-shrink:0;" />`
      : `<div style="width:42px;height:42px;border-radius:10px;background:#162040;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;color:#00C4A8;flex-shrink:0;">V</div>`;

    const personAvatarHtml = person.avatarUrl
      ? `<img src="${person.avatarUrl}" style="width:44px;height:44px;border-radius:22px;object-fit:cover;flex-shrink:0;" />`
      : `<div style="width:44px;height:44px;border-radius:22px;background:${person.color};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">${person.avatar}</div>`;

    const debtRows = selectedDebts.map(debt => {
      const c   = (debt.currency ?? 'ARS') as Currency;
      const eff = effectiveAmount(debt);
      const isOwedToMe = debt.direction === 'me_debe';
      return `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <div style="width:22px;height:22px;border-radius:11px;background:${isOwedToMe ? '#2ED57322' : '#F05B5322'};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="font-size:10px;color:${isOwedToMe ? '#2ED573' : '#F05B53'};font-weight:700">${isOwedToMe ? '↑' : '↓'}</span>
          </div>
          <div style="flex:1;color:rgba(255,255,255,0.8);font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${debt.description}</div>
          <div style="font-size:14px;font-weight:700;flex-shrink:0;color:${isOwedToMe ? '#2ED573' : '#F05B53'}">${formatAmountCurrency(eff, c)}</div>
        </div>`;
    }).join('');

    const netRows = netByCurrency.map(({ currency, net }) => `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span style="color:rgba(255,255,255,0.4);font-size:12px;font-weight:600">
          ${netByCurrency.length > 1 ? `Total ${(CURRENCY_SYMBOLS as any)[currency]} ${currency}` : 'Total pendiente'}
        </span>
        <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${net > 0 ? '#2ED573' : '#F05B53'}">${net > 0 ? '+' : ''}${formatAmountCurrency(Math.abs(net), currency)}</span>
      </div>`).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    *{margin:0;padding:0;box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
    body{background:#0D1B3E;font-family:-apple-system,'Helvetica Neue',Arial,sans-serif;color:#fff;padding:40px 32px;}
  </style>
</head>
<body>

  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
    ${logoHtml}
    <div>
      <div style="font-size:18px;font-weight:800">Recordatorio</div>
      <div style="color:rgba(255,255,255,0.4);font-size:12px;margin-top:2px">${dateStr}</div>
    </div>
  </div>

  <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:14px"></div>

  <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:14px">
    ${personAvatarHtml}
    <div>
      <div style="color:#FFFFFF;font-size:15px;font-weight:700;margin-bottom:3px">Hola, ${person.name} 👋</div>
      <div style="color:rgba(255,255,255,0.45);font-size:11px;line-height:16px">${headerLine}</div>
    </div>
  </div>

  <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:14px"></div>

  ${debtRows}

  <div style="height:1px;background:rgba(255,255,255,0.08);margin:14px 0"></div>

  ${netRows}

  <div style="height:1px;background:rgba(255,255,255,0.08);margin:14px 0"></div>
  <div style="text-align:center;padding-top:4px">
    <div style="color:rgba(255,255,255,0.9);font-size:20px;font-weight:800;letter-spacing:2px">vera</div>
    <div style="color:rgba(255,255,255,0.3);font-size:10px;letter-spacing:0.5px;margin-top:3px">gestión de deudas personales</div>
  </div>

</body>
</html>`;
  }

  // ── Compartir ─────────────────────────────────────────────────────────────
  async function handleShare() {
    setSharing(true);
    try {
      let logoSrc: string | null = null;
      try {
        const source = Image.resolveAssetSource(require('../../assets/vera-logos/vera_logo_256px.png'));
        if (source?.uri) {
          try {
            const b64 = await FileSystem.readAsStringAsync(source.uri, { encoding: FileSystem.EncodingType.Base64 });
            logoSrc = `data:image/png;base64,${b64}`;
          } catch { logoSrc = source.uri; }
        }
      } catch { /* fallback a "V" */ }

      const html = buildHtml(logoSrc);
      const { uri: tempUri } = await Print.printToFileAsync({ html, base64: false });

      const fname   = pdfFilename(person.name);
      const destUri = (FileSystem.cacheDirectory ?? '') + fname;
      await FileSystem.deleteAsync(destUri, { idempotent: true });
      await FileSystem.copyAsync({ from: tempUri, to: destUri });

      await Sharing.shareAsync(destUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Enviar recordatorio',
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      Alert.alert('Error al generar PDF', String(e));
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.handle} />

              {step === 'select' ? (
                <>
                  {/* ── Paso 1: selección de deudas ── */}
                  <Text style={styles.title}>Crear recordatorio</Text>
                  <Text style={styles.subtitle}>
                    Seleccioná las deudas a incluir en el PDF
                  </Text>

                  <TouchableOpacity style={styles.toggleAllRow} onPress={toggleAll} activeOpacity={0.7}>
                    <View style={[styles.checkbox, selected.size === debts.length && styles.checkboxOn]}>
                      {selected.size === debts.length && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                    <Text style={styles.toggleAllText}>
                      {selected.size === debts.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.divider} />

                  <ScrollView style={styles.debtList} showsVerticalScrollIndicator={false}>
                    {debts.map(debt => {
                      const c = (debt.currency ?? 'ARS') as Currency;
                      const eff = effectiveAmount(debt);
                      const isOn = selected.has(debt.id);
                      const dirColor = DIRECTION_COLORS[debt.direction];
                      return (
                        <TouchableOpacity
                          key={debt.id}
                          style={styles.debtItem}
                          onPress={() => toggleDebt(debt.id)}
                          activeOpacity={0.7}
                        >
                          <View style={[styles.checkbox, isOn && styles.checkboxOn]}>
                            {isOn && <Text style={styles.checkmark}>✓</Text>}
                          </View>
                          <View style={styles.debtItemInfo}>
                            <Text style={styles.debtItemDesc} numberOfLines={1}>{debt.description}</Text>
                            <View style={[styles.dirBadge, { backgroundColor: dirColor + '18' }]}>
                              <Text style={[styles.dirBadgeText, { color: dirColor }]}>
                                {debt.direction === 'me_debe' ? '→ me debe' : '← le debo'}
                              </Text>
                            </View>
                          </View>
                          <Text style={[styles.debtItemAmount, { color: dirColor }]}>
                            {formatAmountCurrency(eff, c)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>

                  <Text style={styles.selectionCount}>
                    {selected.size} de {debts.length} deuda{debts.length !== 1 ? 's' : ''} seleccionada{selected.size !== 1 ? 's' : ''}
                  </Text>

                  <View style={styles.actions}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                      <Text style={styles.cancelText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.nextBtn, selected.size === 0 && styles.btnDisabled]}
                      onPress={() => setStep('confirm')}
                      disabled={selected.size === 0}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.nextText}>Continuar →</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {/* ── Paso 2: confirmación y compartir ── */}
                  <Text style={styles.title}>Recordatorio listo</Text>
                  <Text style={styles.subtitle}>
                    Para {person.name} · {selected.size} deuda{selected.size !== 1 ? 's' : ''}
                  </Text>

                  <View style={styles.confirmBox}>
                    {person.avatarUrl ? (
                      <Image source={{ uri: person.avatarUrl }} style={styles.confirmAvatar} />
                    ) : (
                      <View style={[styles.confirmAvatar, { backgroundColor: person.color, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={{ fontSize: 22 }}>{person.avatar}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.confirmName}>{person.name}</Text>
                      <Text style={styles.confirmSub}>
                        {netByCurrency.length > 0
                          ? netByCurrency.map(({ currency, net }) =>
                              `${net > 0 ? '+' : ''}${formatAmountCurrency(Math.abs(net), currency)}`
                            ).join(' · ')
                          : `${selected.size} deuda${selected.size !== 1 ? 's' : ''} seleccionada${selected.size !== 1 ? 's' : ''}`
                        }
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.shareBtn}
                    onPress={handleShare}
                    disabled={sharing}
                    activeOpacity={0.8}
                  >
                    {sharing
                      ? <ActivityIndicator color="#fff" />
                      : <Text style={styles.shareText}>Compartir PDF</Text>
                    }
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.backBtnFull} onPress={() => setStep('select')} activeOpacity={0.7}>
                    <Text style={styles.cancelText}>← Volver</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ─── Estilos modal ────────────────────────────────────────────────────────────

function createStyles(t: Theme) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: t.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 32,
      maxHeight: '92%',
    },
    handle: {
      width: 36, height: 4, borderRadius: 2,
      backgroundColor: t.border,
      alignSelf: 'center', marginBottom: 16,
    },
    title: {
      fontSize: 20, fontWeight: '700', color: t.text,
      textAlign: 'center', marginBottom: 4,
    },
    subtitle: {
      fontSize: 13, color: t.subtext,
      textAlign: 'center', marginBottom: 16,
    },
    toggleAllRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 6,
    },
    checkbox: {
      width: 22, height: 22, borderRadius: 6,
      borderWidth: 2, borderColor: t.border,
      alignItems: 'center', justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: '#00C4A8', borderColor: '#00C4A8' },
    checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
    toggleAllText: { fontSize: 14, color: t.subtext, fontWeight: '500' },
    divider: { height: 1, backgroundColor: t.border, marginVertical: 8 },
    debtList: { maxHeight: 280 },
    debtItem: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.border,
    },
    debtItemInfo: { flex: 1, gap: 4 },
    debtItemDesc: { fontSize: 14, fontWeight: '500', color: t.text },
    dirBadge: { alignSelf: 'flex-start', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    dirBadgeText: { fontSize: 10, fontWeight: '600' },
    debtItemAmount: { fontSize: 14, fontWeight: '700' },
    selectionCount: {
      textAlign: 'center', fontSize: 12,
      color: t.subtext, marginTop: 10, marginBottom: 4,
    },
    actions: { flexDirection: 'row', gap: 12, marginTop: 12 },
    cancelBtn: {
      flex: 1, paddingVertical: 14, borderRadius: 14,
      backgroundColor: t.isDark ? t.bg : '#F0F0F5',
      alignItems: 'center',
    },
    cancelText: { fontSize: 15, fontWeight: '600', color: t.subtext },
    nextBtn: {
      flex: 2, paddingVertical: 14, borderRadius: 14,
      backgroundColor: '#00C4A8', alignItems: 'center',
    },
    nextText: { fontSize: 15, fontWeight: '700', color: '#fff' },
    btnDisabled: { opacity: 0.35 },
    // Confirm step
    confirmBox: {
      flexDirection: 'row', alignItems: 'center', gap: 14,
      backgroundColor: t.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
      borderRadius: 14, padding: 16, marginBottom: 4,
    },
    confirmAvatar: { width: 48, height: 48, borderRadius: 24 },
    confirmName: { fontSize: 16, fontWeight: '700', color: t.text },
    confirmSub: { fontSize: 13, color: t.subtext, marginTop: 3 },
    shareBtn: {
      width: '100%', backgroundColor: '#00C4A8', borderRadius: 16,
      paddingVertical: 16, alignItems: 'center',
      shadowColor: '#00C4A8', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35, shadowRadius: 10, elevation: 6, marginTop: 8,
    },
    shareText: { fontSize: 16, fontWeight: '700', color: '#fff' },
    backBtnFull: { paddingVertical: 10, alignItems: 'center' },
  });
}
