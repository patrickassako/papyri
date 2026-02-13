import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card, Avatar, Divider, Button } from 'react-native-paper';
import { supabase } from '../config/supabase';

const ProfileScreen = ({ navigation }) => {
  const handleLogout = async () => {
    try {
      // Déconnexion Supabase
      await supabase.auth.signOut();

      // Redirection vers Login
      navigation.replace('Login');
    } catch (error) {
      console.error('Erreur déconnexion:', error);
      // Même en cas d'erreur, on redirige vers Login
      navigation.replace('Login');
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content style={styles.header}>
          <Avatar.Text size={80} label="U" style={styles.avatar} />
          <Text variant="headlineSmall" style={styles.name}>
            Utilisateur Test
          </Text>
          <Text variant="bodyMedium" style={styles.email}>
            test@example.com
          </Text>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            Informations
          </Text>
          <Divider style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>Rôle :</Text>
            <Text style={styles.value}>Utilisateur</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Langue :</Text>
            <Text style={styles.value}>Français</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Membre depuis :</Text>
            <Text style={styles.value}>Février 2026</Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card}>
        <Card.Content>
          <Button
            mode="contained"
            icon="logout"
            onPress={handleLogout}
            style={styles.logoutButton}
            buttonColor="#D32F2F"
            textColor="#FFFFFF"
          >
            Se déconnecter
          </Button>
        </Card.Content>
      </Card>

      <Text style={styles.note}>
        Note : Version simplifiée pour tests Epic 1
      </Text>
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
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    backgroundColor: '#B5651D',
    marginBottom: 12,
  },
  name: {
    marginBottom: 4,
    color: '#2C1810',
  },
  email: {
    color: '#3D2B1F',
  },
  sectionTitle: {
    marginBottom: 8,
    color: '#B5651D',
  },
  divider: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    color: '#3D2B1F',
    fontWeight: '600',
  },
  value: {
    color: '#3D2B1F',
  },
  note: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 20,
  },
  logoutButton: {
    marginTop: 8,
  },
});

export default ProfileScreen;
