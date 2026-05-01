import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Text, TextInput, Button, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useTranslation } from 'react-i18next';

export default function RegisterScreen({ navigation }) {
  const { t } = useTranslation();

  const [fullName, setFullName]           = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState('');

  const inputTheme = { colors: { primary: '#b4641d', background: '#fbf7f2' } };

  const handleRegister = async () => {
    setError('');

    if (!fullName.trim()) {
      setError('Veuillez saisir votre nom complet.');
      return;
    }
    if (!email.trim()) {
      setError(t('auth.fieldRequired'));
      return;
    }
    if (!password) {
      setError(t('auth.fieldRequired'));
      return;
    }
    if (password.length < 8) {
      setError(t('auth.weakPassword'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (!termsAccepted) {
      setError('Veuillez accepter les Conditions d\'utilisation et la Politique de confidentialité.');
      return;
    }

    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            language: 'fr',
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        navigation.replace('ProfileSelector');
      } else {
        setError(t('auth.resetSent'));
      }
    } catch (err) {
      console.error('Register error:', err);
      if (err.message?.includes('already registered')) {
        setError('Cette adresse e-mail est déjà utilisée.');
      } else {
        setError(err.message || t('auth.registerError'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button */}
          <View style={styles.headerRow}>
            <IconButton
              icon="arrow-left"
              iconColor="#171412"
              size={24}
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            />
          </View>

          {/* Card */}
          <View style={styles.card}>

            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoName}>Papyri</Text>
            </View>

            {/* Title */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{t('auth.registerTitle')}</Text>
              <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>

              {/* Full name */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Nom complet</Text>
                <TextInput
                  mode="flat"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Jean Dupont"
                  autoCapitalize="words"
                  autoComplete="name"
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  placeholderTextColor="#867465"
                  theme={inputTheme}
                />
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.emailLabel')}</Text>
                <TextInput
                  mode="flat"
                  value={email}
                  onChangeText={setEmail}
                  placeholder={t('auth.emailPlaceholder')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  style={styles.input}
                  underlineColor="transparent"
                  activeUnderlineColor="transparent"
                  placeholderTextColor="#867465"
                  theme={inputTheme}
                />
              </View>

              {/* Password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    mode="flat"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="8 caractères minimum"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    placeholderTextColor="#867465"
                    theme={inputTheme}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeIcon}>
                    <MaterialCommunityIcons name={showPassword ? 'eye' : 'eye-off'} size={20} color="#867465" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm password */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.confirmPasswordLabel')}</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    mode="flat"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Répétez le mot de passe"
                    secureTextEntry={!showConfirm}
                    autoCapitalize="none"
                    style={[
                      styles.input,
                      confirmPassword.length > 0 && password !== confirmPassword && styles.inputError,
                    ]}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    placeholderTextColor="#867465"
                    theme={inputTheme}
                  />
                  <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeIcon}>
                    <MaterialCommunityIcons name={showConfirm ? 'eye' : 'eye-off'} size={20} color="#867465" />
                  </TouchableOpacity>
                </View>
                {confirmPassword.length > 0 && password !== confirmPassword && (
                  <Text style={styles.inlineError}>Les mots de passe ne correspondent pas</Text>
                )}
              </View>

              {/* Error */}
              {!!error && (
                <View style={styles.errorContainer}>
                  <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#c25450" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Terms checkbox */}
              <TouchableOpacity
                style={styles.termsRow}
                onPress={() => setTermsAccepted(v => !v)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                  {termsAccepted && (
                    <MaterialCommunityIcons name="check" size={14} color="#fff" />
                  )}
                </View>
                <Text style={styles.termsText}>
                  J'accepte les{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => navigation.navigate('Legal', { type: 'cgu' })}
                  >
                    Conditions d'utilisation
                  </Text>
                  {' '}et la{' '}
                  <Text
                    style={styles.termsLink}
                    onPress={() => navigation.navigate('Legal', { type: 'privacy' })}
                  >
                    Politique de confidentialité
                  </Text>
                </Text>
              </TouchableOpacity>

              {/* Register button */}
              <Button
                mode="contained"
                onPress={handleRegister}
                loading={loading}
                disabled={loading || !termsAccepted}
                style={[styles.registerButton, (!termsAccepted) && styles.registerButtonDisabled]}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                buttonColor="#b4641d"
              >
                {loading ? t('auth.registering') : t('auth.registerButton')}
              </Button>
            </View>

            {/* Login link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                {t('auth.hasAccount')}{' '}
                <Text style={styles.footerLink} onPress={() => navigation.navigate('Login')}>
                  {t('auth.signIn')}
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fbf7f2',
  },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backButton: { margin: 0 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  // Logo
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  logoName: {
    fontFamily: 'Playfair Display',
    fontSize: 22,
    fontWeight: '700',
    color: '#b4641d',
    marginTop: 8,
    letterSpacing: 0.5,
  },

  // Title
  titleContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontFamily: 'Playfair Display',
    fontSize: 26,
    fontWeight: '700',
    color: '#171412',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    color: '#867465',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },

  // Form
  form: { gap: 18 },
  inputGroup: { gap: 6 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#171412',
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#fbf7f2',
    borderRadius: 12,
    height: 56,
    fontSize: 16,
  },
  inputError: {
    borderWidth: 1.5,
    borderColor: '#c25450',
  },
  passwordContainer: { position: 'relative' },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 18,
    zIndex: 10,
  },
  inlineError: {
    fontSize: 12,
    color: '#c25450',
    fontWeight: '500',
    marginLeft: 4,
    marginTop: 4,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(194, 84, 80, 0.1)',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#c25450',
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },

  // Terms
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#b4641d',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: '#b4641d',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },
  termsLink: {
    color: '#b4641d',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },

  // Button
  registerButton: {
    borderRadius: 28,
    marginTop: 4,
    shadowColor: '#b4641d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  buttonContent: { height: 52 },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Footer
  footer: {
    marginTop: 28,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#867465',
  },
  footerLink: {
    color: '#b4641d',
    fontWeight: '700',
  },
});
