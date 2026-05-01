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

export default function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    if (!email) {
      setError('Veuillez entrer votre adresse e-mail');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        {
          redirectTo: 'bibliotheque://reset-password'
        }
      );

      if (resetError) throw resetError;

      setSuccess(true);
    } catch (err) {
      console.error('Reset password error:', err);
      setError(err.message || "Erreur lors de l'envoi du lien");
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
          </View>

          {/* White Card */}
          <View style={styles.card}>
            {/* Logo Papyri */}
            <View style={styles.logoContainer}>
              <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
              <Text style={styles.logoName}>Papyri</Text>
            </View>

            {/* Header */}
            <View style={styles.titleContainer}>
              <Text style={styles.title}>Mot de passe oublié</Text>
              <Text style={styles.subtitle}>
                Pas d'inquiétude, nous vous envoyons un lien pour retrouver l'accès à votre bibliothèque.
              </Text>
            </View>

            {/* Success State */}
            {success ? (
              <View style={styles.successContainer}>
                <MaterialCommunityIcons name="check-circle" size={48} color="#10b981" />
                <Text style={styles.successTitle}>E-mail envoyé !</Text>
                <Text style={styles.successText}>
                  Vérifiez votre boîte de réception et suivez les instructions pour réinitialiser votre mot de passe.
                </Text>
              </View>
            ) : (
              /* Form */
              <View style={styles.form}>
                {/* Email Field */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Adresse e-mail</Text>
                  <TextInput
                    mode="flat"
                    value={email}
                    onChangeText={setEmail}
                    placeholder="exemple@email.com"
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
                        background: '#fff'
                      }
                    }}
                  />
                </View>

                {/* Error Message */}
                {error ? (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}

                {/* Submit Button */}
                <Button
                  mode="contained"
                  onPress={handleResetPassword}
                  loading={loading}
                  disabled={loading}
                  style={styles.submitButton}
                  contentStyle={styles.buttonContent}
                  labelStyle={styles.buttonLabel}
                  buttonColor="#b4641d"
                >
                  Envoyer le lien
                </Button>
              </View>
            )}
          </View>

          {/* Back to Login Link */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              style={styles.backToLogin}
            >
              <MaterialCommunityIcons name="arrow-left" size={14} color="#b4641d" />
              <Text style={styles.backToLoginText}>Retour à la connexion</Text>
            </TouchableOpacity>
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
    paddingVertical: 24,
    justifyContent: 'center'
  },
  header: {
    paddingBottom: 16
  },
  backButton: {
    margin: 0,
    alignSelf: 'flex-start'
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 24
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
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
    color: '#171412',
    letterSpacing: 1,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24
  },
  title: {
    fontFamily: 'Playfair Display',
    fontSize: 28,
    fontWeight: '700',
    color: '#171412',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 36
  },
  subtitle: {
    fontSize: 14,
    color: '#574d44',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8
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
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 56,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e5e0dc'
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
  submitButton: {
    borderRadius: 28,
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
    fontWeight: '700',
    letterSpacing: 0.5
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 16
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#171412'
  },
  successText: {
    fontSize: 14,
    color: '#574d44',
    textAlign: 'center',
    lineHeight: 20
  },
  footer: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24
  },
  backToLogin: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  backToLoginText: {
    fontSize: 14,
    color: '#b4641d',
    fontWeight: '700'
  }
});
