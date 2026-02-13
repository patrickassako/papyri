import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Card } from 'react-native-paper';

const HistoryScreen = () => {
  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="headlineSmall" style={styles.title}>
            📚 Historique
          </Text>
          <Text style={styles.subtitle}>
            Vos lectures et écoutes récentes apparaîtront ici.
          </Text>
          <Text style={styles.note}>
            (Fonctionnalité disponible après Epic 3)
          </Text>
        </Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2',
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    padding: 20,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
    color: '#B5651D',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#3D2B1F',
  },
  note: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginTop: 12,
  },
});

export default HistoryScreen;
