import React, { useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { formatAmountCurrency, CURRENCY_SYMBOLS } from '../utils';
import { Currency, Debt } from '../types';
import { useTheme, Theme } from '../context/ThemeContext';

const MONTHS_ES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function todayLabel(): string {
  const d = new Date();
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`;
}

function pdfFilename(): string {
  const d = new Date();
  return `vera-historial-${d.getDate()}-${MONTHS_ES[d.getMonth()]}-${d.getFullYear()}.pdf`;
}

interface Person {
  id: string;
  name: string;
  avatar: string;
  color: string;
  avatarUrl?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  periodLabel: string;
  filteredDebts: Debt[];
  periodTotalsByCurrency: Map<Currency, { meDeben: number; leDebo: number }>;
  pendingCount: number;
  paidCount: number;
  personMap: Record<string, Person>;
}


function avatarHtml(p: Person | undefined): string {
  if (!p) return `<div style="width:32px;height:32px;border-radius:16px;background:#444;flex-shrink:0;"></div>`;
  if (p.avatarUrl) {
    return `<img src="${p.avatarUrl}" style="width:32px;height:32px;border-radius:16px;object-fit:cover;flex-shrink:0;" />`;
  }
  return `<div style="width:32px;height:32px;border-radius:16px;background:${p.color};display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0;">${p.avatar}</div>`;
}

export function ShareHistoryModal({
  visible, onClose, periodLabel, filteredDebts,
  periodTotalsByCurrency, pendingCount, paidCount, personMap,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [sharing, setSharing] = React.useState(false);

  const topDebts = filteredDebts
    .filter(d => d.status === 'pendiente')
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // ── Generar HTML para el PDF ───────────────────────────────────────────────
  function buildHtml(logoSrc: string | null): string {
    const dateStr   = todayLabel();
    const hasTotals = periodTotalsByCurrency.size > 0;

    const logoHtml = logoSrc
      ? `<img src="${logoSrc}" style="width:48px;height:48px;border-radius:12px;object-fit:cover;flex-shrink:0;" />`
      : `<div style="width:48px;height:48px;border-radius:12px;background:#162040;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#00C4A8;flex-shrink:0;">V</div>`;

    const totalsRows = !hasTotals
      ? `<div style="color:rgba(255,255,255,0.4);font-size:14px;text-align:center;padding:8px 0">Sin deudas pendientes en este período</div>`
      : [...periodTotalsByCurrency.entries()].map(([cur, { meDeben, leDebo }]) => {
          const net = meDeben - leDebo;
          return `
            <div style="margin-bottom:14px">
              <div style="color:rgba(255,255,255,0.4);font-size:11px;font-weight:700;letter-spacing:1px;margin-bottom:6px">${(CURRENCY_SYMBOLS as any)[cur]} ${cur}</div>
              <div style="display:flex;gap:16px">
                ${meDeben > 0 ? `<div style="flex:1"><div style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:600;margin-bottom:2px">me deben</div><div style="color:#2ED573;font-size:20px;font-weight:800">+${formatAmountCurrency(meDeben, cur)}</div></div>` : ''}
                ${leDebo  > 0 ? `<div style="flex:1"><div style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:600;margin-bottom:2px">le debo</div><div style="color:#F05B53;font-size:20px;font-weight:800">-${formatAmountCurrency(leDebo, cur)}</div></div>` : ''}
                ${meDeben > 0 && leDebo > 0 ? `<div style="flex:1"><div style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:600;margin-bottom:2px">neto</div><div style="color:${net >= 0 ? '#2ED573' : '#F05B53'};font-size:20px;font-weight:800">${net >= 0 ? '+' : ''}${formatAmountCurrency(Math.abs(net), cur)}</div></div>` : ''}
              </div>
            </div>`;
        }).join('');

    const debtRows = topDebts.map(d => {
      const p    = personMap[d.personId];
      const cur  = (d.currency ?? 'ARS') as Currency;
      const isMe = d.direction === 'me_debe';
      return `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          ${avatarHtml(p)}
          <div style="flex:1;overflow:hidden">
            <div style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?.name ?? '?'}</div>
            <div style="color:rgba(255,255,255,0.4);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.description}</div>
          </div>
          <div style="font-size:14px;font-weight:700;flex-shrink:0;color:${isMe ? '#2ED573' : '#F05B53'}">${isMe ? '+' : '-'}${formatAmountCurrency(d.amount, cur)}</div>
        </div>`;
    }).join('');

    const debtsSection = topDebts.length > 0
      ? `<div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:16px">
           <div style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:700;letter-spacing:1.5px;margin-bottom:12px">DEUDAS PENDIENTES</div>
           ${debtRows}
           ${filteredDebts.filter(d => d.status === 'pendiente').length > 5
             ? `<div style="color:rgba(255,255,255,0.3);font-size:12px;text-align:center;margin-top:4px">+${filteredDebts.filter(d => d.status === 'pendiente').length - 5} más...</div>`
             : ''}
         </div>`
      : '';

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

  <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
    ${logoHtml}
    <div>
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px">Historial</div>
      <div style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:600;margin-top:2px">${periodLabel}</div>
      <div style="color:rgba(255,255,255,0.25);font-size:10px;margin-top:2px">${dateStr}</div>
    </div>
  </div>

  <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:16px"></div>

  ${totalsRows}

  <div style="height:1px;background:rgba(255,255,255,0.08);margin:16px 0"></div>

  <div style="display:flex;justify-content:center;gap:24px;align-items:center">
    <div style="text-align:center">
      <div style="font-size:22px;font-weight:700">${pendingCount}</div>
      <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:2px">pendientes</div>
    </div>
    <div style="width:4px;height:4px;border-radius:2px;background:rgba(255,255,255,0.2);margin-bottom:12px"></div>
    <div style="text-align:center">
      <div style="font-size:22px;font-weight:700">${paidCount}</div>
      <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:2px">saldadas</div>
    </div>
    <div style="width:4px;height:4px;border-radius:2px;background:rgba(255,255,255,0.2);margin-bottom:12px"></div>
    <div style="text-align:center">
      <div style="font-size:22px;font-weight:700">${filteredDebts.length}</div>
      <div style="color:rgba(255,255,255,0.4);font-size:11px;margin-top:2px">total</div>
    </div>
  </div>

  ${debtsSection ? `<div style="height:1px;background:rgba(255,255,255,0.08);margin:16px 0"></div>${debtsSection}` : ''}

  <div style="height:1px;background:rgba(255,255,255,0.08);margin:16px 0"></div>
  <div style="text-align:center;padding-top:4px">
    <div style="color:rgba(255,255,255,0.9);font-size:22px;font-weight:800;letter-spacing:2px">vera</div>
    <div style="color:rgba(255,255,255,0.3);font-size:11px;letter-spacing:0.5px;margin-top:4px">gestión de deudas personales</div>
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

      const fname   = pdfFilename();
      const destUri = (FileSystem.cacheDirectory ?? '') + fname;
      await FileSystem.deleteAsync(destUri, { idempotent: true });
      await FileSystem.copyAsync({ from: tempUri, to: destUri });

      await Sharing.shareAsync(destUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartir historial Vera',
        UTI: 'com.adobe.pdf',
      });
    } catch (e) {
      Alert.alert('Error al generar PDF', String(e));
    } finally {
      setSharing(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.sheetTitle}>Historial</Text>
          <Text style={styles.sheetPeriod}>{periodLabel}</Text>
          <Text style={styles.sheetDate}>{todayLabel()}</Text>

          <View style={styles.miniStats}>
            <View style={styles.miniStat}>
              <Text style={[styles.miniNum, { color: '#F05B53' }]}>{pendingCount}</Text>
              <Text style={styles.miniLabel}>pendientes</Text>
            </View>
            <View style={styles.miniDot} />
            <View style={styles.miniStat}>
              <Text style={[styles.miniNum, { color: '#2ED573' }]}>{paidCount}</Text>
              <Text style={styles.miniLabel}>saldadas</Text>
            </View>
            <View style={styles.miniDot} />
            <View style={styles.miniStat}>
              <Text style={styles.miniNum}>{filteredDebts.length}</Text>
              <Text style={styles.miniLabel}>total</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.shareBtn} onPress={handleShare} disabled={sharing} activeOpacity={0.8}>
            {sharing
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.shareBtnText}>Compartir PDF</Text>
            }
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    sheet: {
      backgroundColor: t.card,
      borderTopLeftRadius: 28, borderTopRightRadius: 28,
      paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40, gap: 12,
    },
    handle: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: t.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)',
      alignSelf: 'center', marginBottom: 4,
    },
    sheetTitle:  { color: t.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
    sheetPeriod: { color: t.subtext, fontSize: 14, marginTop: -4, fontWeight: '600' },
    sheetDate:   { color: t.subtext, fontSize: 12, marginTop: -4, opacity: 0.6 },
    miniStats: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      backgroundColor: t.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8, marginTop: 4,
    },
    miniStat:  { alignItems: 'center', flex: 1 },
    miniNum:   { color: t.text, fontSize: 20, fontWeight: '700' },
    miniLabel: { color: t.subtext, fontSize: 10, marginTop: 2, fontWeight: '600' },
    miniDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: t.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)', marginBottom: 10 },
    shareBtn: {
      width: '100%', backgroundColor: '#00C4A8', borderRadius: 16,
      paddingVertical: 16, alignItems: 'center',
      shadowColor: '#00C4A8', shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35, shadowRadius: 10, elevation: 6, marginTop: 4,
    },
    shareBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    cancelBtn:    { paddingVertical: 10, alignItems: 'center' },
    cancelBtnText: { fontSize: 14, fontWeight: '500', color: t.subtext },
  });
}
