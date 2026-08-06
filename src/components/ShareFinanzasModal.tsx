import React, { useMemo } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme, Theme } from '../context/ThemeContext';

interface CategoryEntry {
  cat: { id: string; label: string; emoji: string; color: string; };
  spent: number;
  budget: number | null;
}

type ViewMode = 'expenses' | 'income';

interface Props {
  visible: boolean;
  onClose: () => void;
  month: number;
  year: number;
  totalExpenses: number;
  totalIncome: number;
  netBalance: number;
  chartData: CategoryEntry[];
  vsPercent: number | null;
  mode: ViewMode;
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_LOW = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function todayLabel(): string {
  const d = new Date();
  return `${d.getDate()} de ${MONTHS_LOW[d.getMonth()]} ${d.getFullYear()}`;
}

function pdfFilename(month: number, year: number): string {
  return `vera-finanzas-${MONTHS_LOW[month]}-${year}.pdf`;
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}


export function ShareFinanzasModal({
  visible, onClose, month, year,
  totalExpenses, totalIncome, netBalance,
  chartData, vsPercent, mode,
}: Props) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [sharing, setSharing] = React.useState(false);

  const displayValue = mode === 'expenses' ? totalExpenses : totalIncome;
  const displayColor = mode === 'expenses' ? '#F05B53' : '#2ED573';
  const netColor     = netBalance >= 0 ? '#2ED573' : '#F05B53';
  const vsColor      = mode === 'expenses'
    ? (vsPercent !== null && vsPercent > 0 ? '#F05B53' : '#2ED573')
    : (vsPercent !== null && vsPercent > 0 ? '#2ED573' : '#F05B53');

  const topCats     = chartData.slice(0, 5);
  const totalForPct = topCats.reduce((s, c) => s + c.spent, 0) || 1;

  // ── Generar HTML para el PDF ───────────────────────────────────────────────
  function buildHtml(logoSrc: string | null): string {
    const monthLabel = `${MONTHS[month]} ${year}`;
    const dateStr    = todayLabel();

    const logoHtml = logoSrc
      ? `<img src="${logoSrc}" style="width:48px;height:48px;border-radius:12px;object-fit:cover;flex-shrink:0;" />`
      : `<div style="width:48px;height:48px;border-radius:12px;background:#162040;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900;color:#00C4A8;flex-shrink:0;">V</div>`;

    const vsBadge = vsPercent !== null
      ? `<div style="display:inline-block;background:${vsColor}18;border-radius:12px;padding:4px 10px;margin-top:8px">
           <span style="color:${vsColor};font-size:12px;font-weight:700">${vsPercent > 0 ? '▲' : '▼'} ${Math.abs(vsPercent)}% vs mes anterior</span>
         </div>`
      : '';

    const catRows = topCats.map(({ cat, spent, budget }) => {
      const pct        = Math.round((spent / totalForPct) * 100);
      const overBudget = budget !== null && spent > budget;
      const barColor   = overBudget ? '#F05B53' : cat.color;
      return `
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:14px">
          <div style="font-size:20px;width:26px;text-align:center;margin-top:1px">${cat.emoji}</div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
              <span style="color:rgba(255,255,255,0.85);font-size:13px;font-weight:700">${cat.label}</span>
              <span style="color:${overBudget ? '#F05B53' : 'rgba(255,255,255,0.85)'};font-size:14px;font-weight:700">$${fmtK(spent)}</span>
            </div>
            <div style="height:4px;border-radius:2px;background:rgba(255,255,255,0.1);overflow:hidden">
              <div style="height:4px;border-radius:2px;width:${pct}%;background:${barColor}"></div>
            </div>
            ${budget !== null ? `<div style="color:${overBudget ? '#F05B53' : 'rgba(255,255,255,0.3)'};font-size:10px;font-weight:600;margin-top:4px">${overBudget ? `+$${fmtK(spent - budget)} sobre límite` : `${pct}% de $${fmtK(budget)}`}</div>` : ''}
          </div>
        </div>`;
    }).join('');

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
      <div style="font-size:20px;font-weight:800;letter-spacing:-0.5px">Finanzas</div>
      <div style="color:rgba(255,255,255,0.55);font-size:13px;font-weight:600;margin-top:2px">${monthLabel}</div>
      <div style="color:rgba(255,255,255,0.25);font-size:10px;margin-top:2px">${dateStr}</div>
    </div>
  </div>

  <div style="height:1px;background:rgba(255,255,255,0.08);margin-bottom:16px"></div>

  <div>
    <div style="display:inline-block;background:${displayColor}22;border-radius:20px;padding:4px 10px;margin-bottom:8px">
      <span style="color:${displayColor};font-size:12px;font-weight:700">${mode === 'expenses' ? '↓ Gastos' : '↑ Ingresos'}</span>
    </div>
    <div style="font-size:52px;font-weight:800;letter-spacing:-2px;line-height:56px;color:${displayColor}">$${fmtK(displayValue)}</div>
    ${vsBadge}
  </div>

  <div style="height:1px;background:rgba(255,255,255,0.08);margin:16px 0"></div>

  <div style="display:flex">
    <div style="flex:1;text-align:center">
      <div style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:600;margin-bottom:3px">gastos</div>
      <div style="color:#F05B53;font-size:18px;font-weight:800">-$${fmtK(totalExpenses)}</div>
    </div>
    <div style="flex:1;text-align:center">
      <div style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:600;margin-bottom:3px">ingresos</div>
      <div style="color:#2ED573;font-size:18px;font-weight:800">+$${fmtK(totalIncome)}</div>
    </div>
    <div style="flex:1;text-align:center">
      <div style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:600;margin-bottom:3px">neto</div>
      <div style="color:${netColor};font-size:18px;font-weight:800">${netBalance >= 0 ? '+' : '-'}$${fmtK(Math.abs(netBalance))}</div>
    </div>
  </div>

  ${topCats.length > 0 ? `
  <div style="height:1px;background:rgba(255,255,255,0.08);margin:16px 0"></div>
  <div style="color:rgba(255,255,255,0.35);font-size:10px;font-weight:700;letter-spacing:1.5px;margin-bottom:14px">${mode === 'expenses' ? 'TOP GASTOS' : 'FUENTES DE INGRESO'}</div>
  ${catRows}` : ''}

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

      const fname   = pdfFilename(month, year);
      const destUri = (FileSystem.cacheDirectory ?? '') + fname;
      await FileSystem.deleteAsync(destUri, { idempotent: true });
      await FileSystem.copyAsync({ from: tempUri, to: destUri });

      await Sharing.shareAsync(destUri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Compartir finanzas Vera',
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

          <Text style={styles.sheetTitle}>Finanzas</Text>
          <Text style={styles.sheetPeriod}>{MONTHS[month]} {year}</Text>
          <Text style={styles.sheetDate}>{todayLabel()}</Text>

          <View style={styles.miniStats}>
            <View style={styles.miniStat}>
              <Text style={[styles.miniNum, { color: displayColor }]}>${fmtK(displayValue)}</Text>
              <Text style={styles.miniLabel}>{mode === 'expenses' ? 'gastos' : 'ingresos'}</Text>
            </View>
            <View style={styles.miniDot} />
            <View style={styles.miniStat}>
              <Text style={[styles.miniNum, { color: netColor, fontSize: 16 }]}>
                {netBalance >= 0 ? '+' : '-'}${fmtK(Math.abs(netBalance))}
              </Text>
              <Text style={styles.miniLabel}>neto</Text>
            </View>
            {vsPercent !== null && (
              <>
                <View style={styles.miniDot} />
                <View style={styles.miniStat}>
                  <Text style={[styles.miniNum, { color: vsColor, fontSize: 15 }]}>
                    {vsPercent > 0 ? '▲' : '▼'}{Math.abs(vsPercent)}%
                  </Text>
                  <Text style={styles.miniLabel}>vs anterior</Text>
                </View>
              </>
            )}
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
