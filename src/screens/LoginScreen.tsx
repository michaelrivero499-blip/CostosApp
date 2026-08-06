import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { GoogleIcon } from '../components/GoogleIcon';

const LOGO = require('../../assets/vera-logos/vera_logo_transparent.png');

export function LoginScreen() {
  const { theme } = useTheme();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registered, setRegistered] = useState(false);

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      setError('Completá los campos requeridos');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Ingresá un email válido');
      return;
    }
    if (!isLogin && password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!isLogin && password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    setLoading(true);
    setError(null);
    if (isLogin) {
      const err = await signIn(email.trim(), password);
      setLoading(false);
      if (err) setError(err);
    } else {
      const err = await signUp(email.trim(), password);
      setLoading(false);
      if (err) {
        setError(err);
      } else {
        setRegistered(true); // mostramos el mensaje de verificación de email
      }
    }
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    setError(null);
    const err = await signInWithGoogle();
    setGoogleLoading(false);
    if (err) setError(err);
  }

  function toggleMode() {
    setIsLogin(v => !v);
    setError(null);
    setRegistered(false);
    setConfirmPassword('');
    setShowConfirmPassword(false);
  }

  // Pantalla de confirmación post-registro
  if (registered) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.bg }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 48, marginBottom: 20 }}>📬</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: theme.text, textAlign: 'center', marginBottom: 12 }}>
            Revisá tu email
          </Text>
          <Text style={{ fontSize: 15, color: theme.subtext, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            Te enviamos un link de confirmación a{'\n'}
            <Text style={{ fontWeight: '700', color: theme.text }}>{email}</Text>
            {'\n\n'}Confirmá tu cuenta y volvé para ingresar.
          </Text>
          <TouchableOpacity
            style={{ paddingHorizontal: 28, paddingVertical: 14, backgroundColor: '#00C4A8', borderRadius: 14 }}
            onPress={() => { setRegistered(false); setIsLogin(true); }}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Ya confirmé, ingresar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
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
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg, paddingRight: 48 }]}
                placeholder="••••••••"
                placeholderTextColor={theme.subtext}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(v => !v)}>
                <Text style={{ fontSize: 11, fontWeight: '600', color: showPassword ? theme.subtext : '#00C9B1' }}>
                  {showPassword ? 'Ocultar' : 'Ver'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {!isLogin && (
            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.subtext }]}>Confirmá tu contraseña</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.bg, paddingRight: 48 }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.subtext}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword(v => !v)}>
                  <Text style={{ fontSize: 11, fontWeight: '600', color: showConfirmPassword ? theme.subtext : '#00C9B1' }}>
                    {showConfirmPassword ? 'Ocultar' : 'Ver'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

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

          {/* Separador */}
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
            <Text style={[styles.dividerText, { color: theme.subtext }]}>o</Text>
            <View style={[styles.dividerLine, { backgroundColor: theme.border }]} />
          </View>

          {/* Botón Google */}
          <TouchableOpacity
            style={[styles.googleBtn, { borderColor: theme.border, backgroundColor: theme.bg }]}
            onPress={handleGoogle}
            disabled={googleLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color="#4285F4" />
            ) : (
              <>
                <GoogleIcon size={22} />
                <Text style={[styles.googleText, { color: theme.text }]}>
                  Continuar con Google
                </Text>
              </>
            )}
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
  passwordContainer: {
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
  toggleBtn: { alignItems: 'center' },
  toggle: { fontSize: 14, textAlign: 'center' },
  toggleAccent: { color: '#00C9B1', fontWeight: '600' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: -4,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: '500' },
  googleBtn: {
    height: 52,
    borderWidth: 1.5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
