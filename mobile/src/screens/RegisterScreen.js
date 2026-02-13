import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Text, TextInput, Button, IconButton } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: '',
            language: 'fr'
          }
        }
      });

      if (signUpError) throw signUpError;

      if (data.session) {
        navigation.replace('Home');
      } else {
        // Email confirmation required
        setError('Veuillez vérifier votre email pour confirmer votre inscription.');
      }
    } catch (err) {
      console.error('Register error:', err);
      if (err.message.includes('already registered')) {
        setError("L'adresse e-mail est déjà utilisée");
      } else {
        setError(err.message || "Erreur lors de l'inscription");
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
          {/* Header with back button */}
          <View style={styles.header}>
            <IconButton
              icon="arrow-left"
              iconColor="#171412"
              size={24}
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            />
            <Text style={styles.headerTitle}>S'INSCRIRE</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* White Card */}
          <View style={styles.card}>
            {/* Header */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Créer un compte</Text>
              <Text style={styles.subtitle}>
                Rejoignez notre communauté de lecteurs passionnés.
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              {/* Email Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  mode="flat"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="votre@email.com"
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
                      background: '#f5f5f5'
                    }
                  }}
                />
                {error && error.includes('e-mail') ? (
                  <Text style={styles.errorTextInline}>{error}</Text>
                ) : null}
              </View>

              {/* Password Field */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Mot de passe</Text>
                <View style={styles.passwordContainer}>
                  <TextInput
                    mode="flat"
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Votre mot de passe"
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
                        background: '#f5f5f5'
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

              {/* Error Message */}
              {error && !error.includes('e-mail') ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Register Button */}
              <Button
                mode="contained"
                onPress={handleRegister}
                loading={loading}
                disabled={loading}
                style={styles.registerButton}
                contentStyle={styles.buttonContent}
                labelStyle={styles.buttonLabel}
                buttonColor="#b4641d"
              >
                Créer mon compte
              </Button>
            </View>

            {/* Login Link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Vous avez déjà un compte ?{' '}
                <Text
                  style={styles.footerLink}
                  onPress={() => navigation.navigate('Login')}
                >
                  Se connecter
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
    backgroundColor: '#fbf7f2'
  },
  keyboardView: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 8,
    paddingVertical: 24
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginBottom: 24
  },
  backButton: {
    margin: 0
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#867465',
    letterSpacing: 1.2
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    shadowColor: 'rgba(180, 100, 29, 0.1)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 5,
    borderWidth: 1,
    borderColor: 'rgba(180, 100, 29, 0.05)'
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40
  },
  title: {
    fontFamily: 'Playfair Display',
    fontSize: 32,
    fontWeight: '700',
    color: '#171412',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 40
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16
  },
  form: {
    gap: 24
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
    backgroundColor: 'rgba(249, 250, 251, 0.5)',
    borderRadius: 28,
    height: 48,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  passwordContainer: {
    position: 'relative'
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 14,
    zIndex: 10
  },
  errorTextInline: {
    fontSize: 12,
    color: '#c25450',
    fontWeight: '500',
    marginLeft: 16,
    marginTop: 4
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
  registerButton: {
    borderRadius: 28,
    marginTop: 16,
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
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3
  },
  footer: {
    marginTop: 40,
    alignItems: 'center'
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280'
  },
  footerLink: {
    color: '#b4641d',
    fontWeight: '700'
  }
});
