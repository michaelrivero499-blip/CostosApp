import React, { useState, useMemo } from 'react';
import {
  View, Text, Switch, TouchableOpacity,
  ScrollView, StyleSheet, Linking,
} from 'react-native';
import { ConfirmModal } from '../components/ConfirmModal';
import { ShareSummaryModal } from '../components/ShareSummaryModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme, Theme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useCostos } from '../context/CostosContext';
import { useFinanzas } from '../context/FinanzasContext';
import { scheduleTestNotification, requestNotificationPermissions } from '../services/notifications';

const APP_VERSION = '1.0.0';

export function SettingsScreen() {
  const { theme, isDark, toggleTheme } = useTheme();
  const { session, signOut } = useAuth();
  const { persons, debts } = useCostos();
  const { transactions, budgets } = useFinanzas();
  const s = useMemo(() => createStyles(theme), [theme]);

  const [testSent, setTestSent] = useState(false);
  const [showSignOutModal, setShowSignOutModal]   = useState(false);
  const [showDeleteModal,  setShowDeleteModal]    = useState(false);
  const [showExportModal,  setShowExportModal]    = useState(false);

  // ── Stats globales ─────────────────────────────────────────────────────
  const email         = session?.user?.email ?? '—';
  const pendingDebts  = debts.filter(d => d.status === 'pendiente').length;
  const paidDebts     = debts.filter(d => d.status === 'pagado').length;

  const now = new Date();
  const thisMonthTx = useMemo(() => transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }), [transactions]);
  const thisMonthExp = thisMonthTx.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const thisMonthInc = thisMonthTx.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);

  // ── Overdue debts ──────────────────────────────────────────────────────
  const overdueCount = useMemo(() => {
    const today = new Date(); today.setHours(0,0,0,0);
    return debts.filter(d => d.status === 'pendiente' && d.dueDate && new Date(d.dueDate) < today).length;
  }, [debts]);

  async function handleTestNotification() {
    const granted = await requestNotificationPermissions();
    if (!granted) return;
    await scheduleTestNotification();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 6000);
  }

  function handleExportData() {
    setShowExportModal(true);
  }

  function handleSignOut() {
    setShowSignOutModal(true);
  }

  function handleDeleteAccount() {
    setShowDeleteModal(true);
  }

  function confirmSignOut() {
    setShowSignOutModal(false);
    signOut();
  }

  function confirmDeleteAccount() {
    setShowDeleteModal(false);
    const emailAddr = 'soporte@riselai.com';
    const subject   = encodeURIComponent('Solicitud de eliminación de cuenta - Vera');
    const body      = encodeURIComponent(
      `Hola, quiero eliminar mi cuenta de Vera.\n\nEmail de la cuenta: ${session?.user?.email ?? ''}\n\nEntiendo que esta acción es irreversible.`
    );
    Linking.openURL(`mailto:${emailAddr}?subject=${subject}&body=${body}`);
  }

  function handlePrivacyPolicy() {
    Linking.openURL('https://riselai.com/vera/privacy');
  }

  function handleTerms() {
    Linking.openURL('https://riselai.com/vera/terms');
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={[s.headerTitle, { color: theme.text }]}>Ajustes</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>

        {/* ── CUENTA ─────────────────────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: theme.subtext }]}>CUENTA</Text>
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: theme.text }]}>Email</Text>
              <Text style={[s.rowSub, { color: theme.subtext }]} numberOfLines={1}>{email}</Text>
            </View>
          </View>
        </View>

        {/* ── ESTADÍSTICAS GLOBALES ───────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: theme.subtext, marginTop: 24 }]}>ESTADÍSTICAS GLOBALES</Text>
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <View style={s.statsGrid}>
            <View style={s.statBox}>
              <Text style={[s.statNum, { color: theme.text }]}>{persons.length}</Text>
              <Text style={[s.statLabel, { color: theme.subtext }]}>Personas</Text>
            </View>
            <View style={[s.statBox, s.statBorder, { borderColor: theme.border }]}>
              <Text style={[s.statNum, { color: '#F05B53' }]}>{pendingDebts}</Text>
              <Text style={[s.statLabel, { color: theme.subtext }]}>Pendientes</Text>
            </View>
            <View style={[s.statBox, s.statBorder, { borderColor: theme.border }]}>
              <Text style={[s.statNum, { color: '#2ED573' }]}>{paidDebts}</Text>
              <Text style={[s.statLabel, { color: theme.subtext }]}>Saldadas</Text>
            </View>
            <View style={[s.statBox, s.statBorder, { borderColor: theme.border }]}>
              <Text style={[s.statNum, { color: '#5E60CE' }]}>{transactions.length}</Text>
              <Text style={[s.statLabel, { color: theme.subtext }]}>Movim.</Text>
            </View>
          </View>

          {/* Deudas vencidas */}
          {overdueCount > 0 && (
            <>
              <View style={[s.divider, { backgroundColor: theme.border }]} />
              <View style={s.row}>
                <View style={[s.alertDot, { backgroundColor: '#F05B5320' }]}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F05B53' }} />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[s.rowLabel, { color: '#F05B53' }]}>
                    {overdueCount} deuda{overdueCount !== 1 ? 's' : ''} vencida{overdueCount !== 1 ? 's' : ''}
                  </Text>
                  <Text style={[s.rowSub, { color: theme.subtext }]}>Revisalas en la pestaña Deudas</Text>
                </View>
              </View>
            </>
          )}

          {/* Este mes */}
          {thisMonthTx.length > 0 && (
            <>
              <View style={[s.divider, { backgroundColor: theme.border }]} />
              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.rowLabel, { color: theme.text }]}>
                    {now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^\w/, c => c.toUpperCase())}
                  </Text>
                  <Text style={[s.rowSub, { color: theme.subtext }]}>
                    ↑ ${thisMonthInc.toLocaleString('es-AR')} ingresos · ↓ ${thisMonthExp.toLocaleString('es-AR')} gastos
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ── APARIENCIA ──────────────────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: theme.subtext, marginTop: 24 }]}>APARIENCIA</Text>
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: theme.text }]}>Modo oscuro</Text>
              <Text style={[s.rowSub, { color: theme.subtext }]}>Fondo oscuro, menos cansancio visual</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#E5E5EA', true: '#00C4A8' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ── NOTIFICACIONES ──────────────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: theme.subtext, marginTop: 24 }]}>NOTIFICACIONES</Text>
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <TouchableOpacity style={s.row} onPress={handleTestNotification} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: theme.text }]}>Probar notificación</Text>
              <Text style={[s.rowSub, { color: testSent ? '#2ED573' : theme.subtext }]}>
                {testSent ? '✅ Llega en 5 seg — salí de la app' : 'Dispara una notificación de prueba'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── DATOS ───────────────────────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: theme.subtext, marginTop: 24 }]}>DATOS</Text>
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <TouchableOpacity style={s.row} onPress={handleExportData} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: theme.text }]}>Exportar resumen</Text>
              <Text style={[s.rowSub, { color: theme.subtext }]}>Compartir deudas y finanzas del mes</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── ACERCA DE ───────────────────────────────────────────────── */}
        <Text style={[s.sectionTitle, { color: theme.subtext, marginTop: 24 }]}>ACERCA DE</Text>
        <View style={[s.card, { backgroundColor: theme.card }]}>
          <View style={s.row}>
            <View style={{ flex: 1 }}>
              <Text style={[s.rowLabel, { color: theme.text }]}>Vera</Text>
              <Text style={[s.rowSub, { color: theme.subtext }]}>Tu app de finanzas personales con IA</Text>
            </View>
          </View>
          <View style={[s.divider, { backgroundColor: theme.border }]} />
          <View style={s.row}>
            <Text style={[s.rowLabel, { color: theme.text }]}>Versión</Text>
            <Text style={[s.rowValue, { color: theme.subtext }]}>{APP_VERSION}</Text>
          </View>
          <View style={[s.divider, { backgroundColor: theme.border }]} />
          <View style={s.row}>
            <Text style={[s.rowLabel, { color: theme.text }]}>Desarrollado por</Text>
            <Text style={[s.rowValue, { color: theme.subtext }]}>RiselAI</Text>
          </View>
          <View style={[s.divider, { backgroundColor: theme.border }]} />
          <TouchableOpacity style={s.row} onPress={handlePrivacyPolicy} activeOpacity={0.7}>
            <Text style={[s.rowLabel, { color: theme.text }]}>Política de privacidad</Text>
          </TouchableOpacity>
          <View style={[s.divider, { backgroundColor: theme.border }]} />
          <TouchableOpacity style={s.row} onPress={handleTerms} activeOpacity={0.7}>
            <Text style={[s.rowLabel, { color: theme.text }]}>Términos de uso</Text>
          </TouchableOpacity>
        </View>

        {/* ── SESIÓN Y CUENTA ─────────────────────────────────────────── */}
        <View style={[s.card, { backgroundColor: theme.card, marginTop: 32 }]}>
          <TouchableOpacity style={s.row} onPress={handleSignOut} activeOpacity={0.7}>
            <Text style={s.signOutLabel}>Cerrar sesión</Text>
          </TouchableOpacity>
          <View style={[s.divider, { backgroundColor: theme.border }]} />
          <TouchableOpacity style={s.row} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <View style={{ flex: 1 }}>
              <Text style={[s.signOutLabel, { fontSize: 14, color: '#FF3B3099' }]}>Eliminar cuenta</Text>
              <Text style={[s.rowSub, { color: theme.subtext }]}>Borra todos tus datos permanentemente</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={s.bottomPad} />
      </ScrollView>

      <ShareSummaryModal
        visible={showExportModal}
        onClose={() => setShowExportModal(false)}
      />

      <ConfirmModal
        visible={showSignOutModal}
        title="Cerrar sesión"
        message="¿Estás seguro? Tus datos quedan guardados en la nube."
        confirmLabel="Cerrar sesión"
        onConfirm={confirmSignOut}
        onCancel={() => setShowSignOutModal(false)}
      />

      <ConfirmModal
        visible={showDeleteModal}
        title="Eliminar cuenta"
        message="Esta acción eliminará permanentemente tu cuenta y todos tus datos. No se puede deshacer."
        confirmLabel="Solicitar eliminación"
        onConfirm={confirmDeleteAccount}
        onCancel={() => setShowDeleteModal(false)}
      />

    </SafeAreaView>
  );
}

function createStyles(t: Theme) {
  return StyleSheet.create({
    safe:   { flex: 1, backgroundColor: t.bg },
    header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
    headerTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    scroll: { flex: 1 },

    sectionTitle: {
      fontSize: 11, fontWeight: '700', letterSpacing: 1,
      marginHorizontal: 16, marginBottom: 10,
    },
    card: {
      borderRadius: 14, marginHorizontal: 16,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 14,
    },
    rowLabel: { fontSize: 15, fontWeight: '500' },
    rowSub:   { fontSize: 12, marginTop: 2 },
    rowValue: { fontSize: 15 },
    rowEmoji: { fontSize: 18 },
    divider:  { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

    // Stats grid
    statsGrid:  { flexDirection: 'row' },
    statBox:    { flex: 1, alignItems: 'center', paddingVertical: 16 },
    statBorder: { borderLeftWidth: StyleSheet.hairlineWidth },
    statNum:    { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
    statLabel:  { fontSize: 10, fontWeight: '600', marginTop: 2, letterSpacing: 0.3 },

    // Alert row
    alertDot: {
      width: 36, height: 36, borderRadius: 18,
      alignItems: 'center', justifyContent: 'center',
    },

    signOutLabel: { fontSize: 15, fontWeight: '600', color: '#FF3B30' },
    bottomPad: { height: 40 },
  });
}
