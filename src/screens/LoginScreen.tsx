import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const LOGO = require('../../assets/vera-logos/vera_logo_transparent.png');

export function LoginScreen() {
  const { theme } = useTheme();
  const { signIn, signUp } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError('Completá los campos requeridos');
      return;
    }
    setLoading(true);
    setError(null);
    const err = isLogin
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);
    setLoading(false);
    if (err) setError(err);
  }

  function toggleMode() {
    setIsLogin(v => !v);
    setError(null);
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
      <KeyboardAvoidingView
        style={styles.inner}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.logoSection}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={[styles.subtitle, { color: theme.subtext }]}>
            {isLogin ? 'Iniciá sesión para continuar' : 'Creá tu cuenta'}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <View style={styles.cardAccent} />

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.subtext }]}>Email</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="tu@email.com"
              placeholderTextColor={theme.subtext}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: theme.subtext }]}>Contraseña</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg }]}
              placeholder="••••••••"
              placeholderTextColor={theme.subtext}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {error !== null && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.btnText}>{isLogin ? 'Ingresar' : 'Registrarse'}</Text>
            }
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={toggleMode} activeOpacity={0.7} style={styles.toggleBtn}>
          <Text style={[styles.toggle, { color: theme.subtext }]}>
            {isLogin ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
            <Text style={styles.toggleAccent}>
              {isLogin ? 'Registrate' : 'Ingresá'}
            </Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 20,
  },
  logoSection: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  logo: {
    width: 180,
    height: 72,
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  card: {
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 0,
    paddingBottom: 28,
    borderWidth: 1,
    gap: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  cardAccent: {
    height: 4,
    backgroundColor: '#00C9B1',
    marginHorizontal: -24,
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  errorBox: {
    backgroundColor: '#FFF0EE',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  errorText: {
    color: '#D93025',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  btn: {
    height: 52,
    backgroundColor: '#00C9B1',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    shadowColor: '#00C9B1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  toggleBtn: { alignItems: 'center' },
  toggle: { fontSize: 14, textAlign: 'center' },
  toggleAccent: { color: '#00C9B1', fontWeight: '600' },
});
