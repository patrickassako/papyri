import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function BottomNavBar({ navigation, activeTab }) {
  const tabs = [
    { name: 'Home', label: 'Accueil', icon: 'home-outline', iconActive: 'home' },
    { name: 'Catalog', label: 'Catalogue', icon: 'view-grid-outline', iconActive: 'view-grid' },
    { name: 'History', label: 'Bibliothèque', icon: 'bookmark-outline', iconActive: 'bookmark' },
    { name: 'Profile', label: 'Profil', icon: 'account-outline', iconActive: 'account' }
  ];

  return (
    <View style={styles.bottomNav}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.navItem}
            onPress={() => navigation.navigate(tab.name)}
          >
            <MaterialCommunityIcons
              name={isActive ? tab.iconActive : tab.icon}
              size={24}
              color={isActive ? '#171412' : '#867465'}
            />
            <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e0dc',
    paddingVertical: 8,
    paddingHorizontal: 8,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 8
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 64,
    gap: 4
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#867465'
  },
  navLabelActive: {
    color: '#171412',
    fontWeight: '700'
  }
});
