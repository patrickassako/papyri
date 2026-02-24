import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  HelperText,
  Banner,
} from 'react-native-paper';
import API_BASE_URL from '../config/api';

// Import shared design tokens
const tokens = require('../config/tokens');

const ResetPasswordScreen = ({ route, navigation }) => {
  // Get token from navigation params or deep link
  const token = route?.params?.token || null;

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [touched, setTouched] = useState({});

  // Check if token exists
  useEffect(() => {
    if (!token) {
      setError('Lien invalide. Veuillez demander un nouveau lien de réinitialisation.');
    }
  }, [token]);

  // Password validation
  const validatePassword = (password) => {
    if (!password) return 'Le mot de passe est obligatoire.';
    if (password.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
    return null;
  };

  // Confirm password validation
  const validateConfirmPassword = (confirmPassword) => {
    if (!confirmPassword) return 'Veuillez confirmer le mot de passe.';
    if (confirmPassword !== formData.password) return 'Les mots de passe ne correspondent pas.';
    return null;
  };

  const errors = {
    password: touched.password ? validatePassword(formData.password) : null,
    confirmPassword: touched.confirmPassword ? validateConfirmPassword(formData.confirmPassword) : null,
  };

  // Check if form is valid
  const isFormValid = () => {
    return (
      !validatePassword(formData.password) &&
      !validateConfirmPassword(formData.confirmPassword) &&
      formData.password &&
      formData.confirmPassword &&
      token
    );
  };

  // Handle form submission
  const handleSubmit = async () => {
    if (!isFormValid()) {
      setTouched({ password: true, confirmPassword: true });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          new_password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error?.message || 'Une erreur est survenue.');
        setLoading(false);
        return;
      }

      // Success
      setSuccess(true);
      setLoading(false);

      // Navigate to login after 2 seconds
      setTimeout(() => {
        navigation.navigate('Login');
      }, 2000);
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Erreur de connexion. Veuillez réessayer.');
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text variant="headlineMedium" style={styles.title}>
          Créer un nouveau mot de passe
        </Text>

        {/* Success Banner */}
        {success && (
          <Banner
            visible={success}
            icon="check-circle"
            style={styles.successBanner}
          >
            Mot de passe modifié avec succès ! Redirection vers la connexion...
          </Banner>
        )}

        {/* Error Banner */}
        {error && (
          <Banner
            visible={!!error}
            actions={[
              {
                label: 'Fermer',
                onPress: () => setError(null),
              },
            ]}
            icon="alert-circle"
            style={styles.errorBanner}
          >
            {error}
          </Banner>
        )}

        {!success && token && (
          <>
            {/* New Password Field */}
            <View style={styles.fieldContainer}>
              <Text variant="labelMedium" style={styles.label}>
                Nouveau mot de passe
              </Text>
              <TextInput
                mode="outlined"
                value={formData.password}
                onChangeText={(value) => setFormData({ ...formData, password: value })}
                onBlur={() => setTouched({ ...touched, password: true })}
                placeholder="Votre nouveau mot de passe"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                error={!!errors.password}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                accessibilityLabel="Nouveau mot de passe"
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword(!showPassword)}
                    accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  />
                }
              />
              <HelperText type={errors.password ? 'error' : 'info'} visible={true} style={styles.helperText}>
                {errors.password || 'Minimum 8 caractères'}
              </HelperText>
            </View>

            {/* Confirm Password Field */}
            <View style={styles.fieldContainer}>
              <Text variant="labelMedium" style={styles.label}>
                Confirmer le mot de passe
              </Text>
              <TextInput
                mode="outlined"
                value={formData.confirmPassword}
                onChangeText={(value) => setFormData({ ...formData, confirmPassword: value })}
                onBlur={() => setTouched({ ...touched, confirmPassword: true })}
                placeholder="Confirmez votre mot de passe"
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                error={!!errors.confirmPassword}
                style={styles.input}
                outlineStyle={styles.inputOutline}
                accessibilityLabel="Confirmer le mot de passe"
                right={
                  <TextInput.Icon
                    icon={showConfirmPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    accessibilityLabel={showConfirmPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                  />
                }
              />
              {errors.confirmPassword && (
                <HelperText type="error" visible={true} style={styles.helperText}>
                  {errors.confirmPassword}
                </HelperText>
              )}
            </View>

            {/* Submit Button */}
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!isFormValid() || loading}
              loading={loading}
              style={styles.submitButton}
              contentStyle={styles.submitButtonContent}
              labelStyle={styles.submitButtonLabel}
              accessibilityLabel="Réinitialiser le mot de passe"
            >
              {loading ? 'Réinitialisation en cours...' : 'Réinitialiser le mot de passe'}
            </Button>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.backgrounds.light,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 32,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: tokens.colors.onSurface.light,
    marginBottom: 32,
    textAlign: 'center',
  },
  successBanner: {
    marginBottom: 24,
    backgroundColor: '#E8F5E9',
  },
  errorBanner: {
    marginBottom: 24,
    backgroundColor: '#FFEBEE',
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.onSurface.light,
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    backgroundColor: tokens.colors.backgrounds.light,
  },
  inputOutline: {
    borderRadius: 8,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
  submitButton: {
    borderRadius: 24,
    backgroundColor: tokens.colors.primary,
  },
  submitButtonContent: {
    height: 48,
  },
  submitButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ResetPasswordScreen;
