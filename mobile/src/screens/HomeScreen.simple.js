import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button, Card } from 'react-native-paper';
import * as authService from '../services/auth.service';

const HomeScreen = ({ navigation }) => {
  const handleLogout = async () => {
    try {
      await authService.logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineMedium" style={styles.title}>
            🎉 Bienvenue !
          </Text>
          <Text variant="bodyLarge" style={styles.subtitle}>
            Bibliothèque Numérique
          </Text>
          <Text style={styles.info}>
            Epic 1 - Authentification fonctionnelle ✅
          </Text>
        </Card.Content>
      </Card>

      <Button
        mode="contained"
        icon="book-open-variant"
        onPress={() => navigation.navigate('Catalog')}
        style={styles.button}
      >
        📚 Catalogue
      </Button>

      <Button
        mode="contained"
        icon="account"
        onPress={() => navigation.navigate('Profile')}
        style={styles.button}
      >
        Mon Profil
      </Button>

      <Button
        mode="contained"
        icon="history"
        onPress={() => navigation.navigate('History')}
        style={styles.button}
      >
        Historique
      </Button>

      <Button
        mode="outlined"
        icon="logout"
        onPress={handleLogout}
        style={styles.button}
      >
        Se Déconnecter
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2',
    padding: 20,
  },
  card: {
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#B5651D',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#2E4057',
  },
  info: {
    textAlign: 'center',
    color: '#4A7C59',
  },
  button: {
    marginBottom: 12,
  },
});

export default HomeScreen;
