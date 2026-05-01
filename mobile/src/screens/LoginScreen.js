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
import { Text, TextInput, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import { useTranslation } from 'react-i18next';

export default function LoginScreen({ navigation }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError(t('auth.fieldRequired'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (signInError) throw signInError;

      if (data.session) {
        navigation.replace('ProfileSelector');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || t('auth.loginError'));
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
          {/* White Card */}
          <View style={styles.card}>
            {/* Logo Papyri */}
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
              <Text style={styles.logoName}>Papyri</Text>
            </View>

            {/* Header */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>{t('auth.loginTitle')}</Text>
              <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Email Field */}
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
                  theme={{
                    colors: {
                      primary: '#b4641d',
                      background: '#fbf7f2'
                    }
                  }}
                />
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    mode="flat"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoComplete="password"
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor="transparent"
                    placeholderTextColor="#867465"
                    theme={{
                      colors: {
                        primary: '#b4641d',
                        background: '#fbf7f2'
                      }
                    }}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeIcon}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? 'eye' : 'eye-off'}
                      size={20}
                      color="#867465"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot Password Link */}
              <TouchableOpacity
                onPress={() => navigation.navigate('ForgotPassword')}
                style={styles.forgotPassword}
              >
                <Text style={styles.forgotPasswordText}>{t('auth.forgotPassword')}</Text>
              </TouchableOpacity>

              {/* Error Message */}
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Login Button */}
              <Button
                mode="contained"
                onPress={handleLogin}
                loading={loading}
                disabled={loading}
                style={styles.loginButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                buttonColor="#b4641d"
              >
                {loading ? t('auth.loggingIn') : t('auth.loginButton')}
              </Button>
            </View>

          </View>

          {/* Sign Up Button */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
            <Button
              mode="outlined"
              onPress={() => navigation.navigate('Register')}
              style={styles.registerButton}
              contentStyle={styles.buttonContent}
              labelStyle={styles.registerButtonLabel}
              textColor="#b4641d"
            >
              {t('auth.signUp')}
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fbf7f2'
  },
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingVertical: 40,
    justifyContent: 'center'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20
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
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32
  },
  title: {
    fontFamily: 'Playfair Display',
    fontSize: 32,
    fontWeight: '700',
    color: '#171412',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 40
  },
  subtitle: {
    fontSize: 14,
    color: '#867465',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16
  },
  form: {
    gap: 20
  },
  inputGroup: {
    gap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#171412',
    marginLeft: 4
  },
  input: {
    backgroundColor: '#fbf7f2',
    borderRadius: 12,
    height: 56,
    fontSize: 16
  },
  passwordContainer: {
    position: 'relative'
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 18,
    zIndex: 10
  },
  forgotPassword: {
    alignSelf: 'flex-end'
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#2e4057',
    fontWeight: '500'
  },
  errorContainer: {
    backgroundColor: 'rgba(194, 84, 80, 0.1)',
    borderRadius: 8,
    padding: 12
  },
  errorText: {
    color: '#c25450',
    fontSize: 14,
    textAlign: 'center'
  },
  loginButton: {
    borderRadius: 28,
    marginTop: 8,
    shadowColor: '#b4641d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4
  },
  buttonContent: {
    height: 48
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 12,
  },
  footerText: {
    fontSize: 14,
    color: '#867465'
  },
  registerButton: {
    borderRadius: 28,
    borderColor: '#b4641d',
    borderWidth: 1.5,
    width: '100%',
  },
  registerButtonLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.3,
  }
});
