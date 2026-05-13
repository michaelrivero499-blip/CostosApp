import React from 'react';
import {
  View, Text, Switch, TouchableOpacity,
  ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

const APP_VERSION = '1.0.0';

export function SettingsScreen({ navigation }: Props) {
  const { theme, isDark, toggleTheme } = useTheme();
  const { signOut } = useAuth();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backArrow, { color: theme.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Ajustes</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionTitle, { color: theme.subtext }]}>APARIENCIA</Text>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>Modo oscuro</Text>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: '#E5E5EA', true: '#00C9B1' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.subtext, marginTop: 24 }]}>ACERCA DE</Text>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.row}>
            <Text style={[styles.rowLabel, { color: theme.text }]}>Versión</Text>
            <Text style={[styles.rowValue, { color: theme.subtext }]}>{APP_VERSION}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.row}>
            <View>
              <Text style={[styles.rowLabel, { color: theme.text }]}>Vera</Text>
              <Text style={[styles.rowSub, { color: theme.subtext }]}>Tu app de finanzas personales</Text>
            </View>
          </View>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.subtext, marginTop: 24 }]}>CUENTA</Text>

        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <TouchableOpacity style={styles.row} onPress={signOut} activeOpacity={0.7}>
            <Text style={styles.signOutLabel}>Cerrar sesión</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 24 },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: { flex: 1 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  card: {
    borderRadius: 12,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowLabel: { fontSize: 15, fontWeight: '500' },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowValue: { fontSize: 15 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  signOutLabel: { fontSize: 15, fontWeight: '600', color: '#FF3B30' },
  bottomPad: { height: 40 },
});
