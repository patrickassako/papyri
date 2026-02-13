import React, { useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Dimensions,
  Image,
  TouchableOpacity
} from 'react-native';
import { Text, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ONBOARDING_DATA = [
  {
    id: '1',
    title: 'Ta bibliothèque,\npartout.',
    description: "Accédez à des milliers d'ebooks et de livres audio où que vous soyez.",
    imageUrl: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&h=800&fit=crop',
    useRealImage: true,
    buttonText: 'Suivant'
  },
  {
    id: '2',
    title: "Reprends exactement\noù tu t'es arrêté.",
    description: 'Votre progression est synchronisée instantanément sur tous vos appareils.',
    illustration: 'sync',
    buttonText: 'Suivant'
  },
  {
    id: '3',
    title: 'Prépare ta lecture\nhors-ligne.',
    description: 'Téléchargez vos œuvres favorites pour les savourer même sans connexion.',
    illustration: 'offline',
    buttonText: 'Commencer'
  }
];

export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('onboarding_complete', 'true');
    navigation.replace('Login');
  };

  const handleNext = () => {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true
      });
    } else {
      // Last screen - complete onboarding and navigate to login
      completeOnboarding();
    }
  };

  const handleSkip = () => {
    completeOnboarding();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  const renderIllustration = (type) => {
    switch (type) {
      case 'sync':
        return (
          <View style={styles.illustrationContainer}>
            <View style={styles.syncBackground}>
              {/* Tablet */}
              <View style={styles.tablet}>
                <View style={styles.tabletContent}>
                  <MaterialCommunityIcons name="book-open-page-variant" size={40} color="#b4641d" />
                </View>
                <View style={styles.textLines}>
                  <View style={[styles.textLine, { width: '75%' }]} />
                  <View style={[styles.textLine, { width: '100%' }]} />
                  <View style={[styles.textLine, { width: '50%' }]} />
                </View>
              </View>
              {/* Phone */}
              <View style={styles.phone}>
                <View style={styles.phoneContent}>
                  <MaterialCommunityIcons name="headphones" size={24} color="#b4641d" />
                </View>
                <View style={styles.phoneTextLines}>
                  <View style={[styles.phoneTextLine, { width: '75%' }]} />
                  <View style={[styles.phoneTextLine, { width: '100%' }]} />
                </View>
              </View>
              {/* Sync Icon */}
              <View style={styles.syncIcon}>
                <MaterialCommunityIcons name="sync" size={32} color="#fff" />
              </View>
            </View>
          </View>
        );
      case 'offline':
        return (
          <View style={styles.illustrationContainer}>
            <LinearGradient
              colors={['rgba(212, 160, 23, 0.1)', 'rgba(180, 100, 29, 0.05)']}
              style={styles.offlineGradient}
            >
              <View style={styles.offlineIcons}>
                <MaterialCommunityIcons name="airplane" size={80} color="#d4a017" />
                <View style={styles.offlineBookIcon}>
                  <MaterialCommunityIcons name="book-open-variant" size={36} color="#b4641d" />
                </View>
              </View>
            </LinearGradient>
          </View>
        );
      default:
        return null;
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.slide}>
      {/* Illustration Area */}
      <View style={styles.heroSection}>
        {item.useRealImage ? (
          <View style={styles.imageContainer}>
            <View style={styles.imageGlow} />
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.heroImage}
              resizeMode="cover"
            />
            <View style={styles.imageOverlay} />
          </View>
        ) : (
          renderIllustration(item.illustration)
        )}
      </View>

      {/* Content Area */}
      <View style={styles.contentArea}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Background decorative elements */}
      <View style={styles.decorativeTop} />
      <View style={styles.decorativeBottom} />

      {/* Skip Button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>
      </View>

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={ONBOARDING_DATA}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      {/* Footer with pagination and button */}
      <View style={styles.footer}>
        {/* Pagination Dots */}
        <View style={styles.pagination}>
          {ONBOARDING_DATA.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                index === currentIndex && styles.paginationDotActive
              ]}
            />
          ))}
        </View>

        {/* Action Button */}
        <Button
          mode="contained"
          onPress={handleNext}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={styles.buttonLabel}
          icon={({ size, color }) => (
            <MaterialCommunityIcons name="arrow-right" size={20} color={color} />
          )}
          buttonColor="#b4641d"
        >
          {ONBOARDING_DATA[currentIndex].buttonText}
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBF7F2'
  },
  decorativeTop: {
    position: 'absolute',
    top: -80,
    left: -80,
    width: 256,
    height: 256,
    backgroundColor: 'rgba(180, 100, 29, 0.05)',
    borderRadius: 128,
    opacity: 0.5
  },
  decorativeBottom: {
    position: 'absolute',
    bottom: -80,
    right: -80,
    width: 320,
    height: 320,
    backgroundColor: 'rgba(180, 100, 29, 0.05)',
    borderRadius: 160,
    opacity: 0.5
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 4
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b4641d',
    letterSpacing: 0.3
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: 24
  },
  heroSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 48
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 380,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  imageGlow: {
    position: 'absolute',
    width: '90%',
    height: '90%',
    backgroundColor: 'rgba(180, 100, 29, 0.05)',
    borderRadius: 999,
    transform: [{ scale: 0.9 }]
  },
  heroImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    overflow: 'hidden'
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(180, 100, 29, 0.1)',
    borderRadius: 16
  },
  illustrationContainer: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 320,
    justifyContent: 'center',
    alignItems: 'center'
  },
  syncBackground: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(180, 100, 29, 0.05)',
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  tablet: {
    width: 192,
    height: 256,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 4,
    borderColor: '#f5f5f5',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8
  },
  tabletContent: {
    width: '100%',
    height: 128,
    backgroundColor: 'rgba(180, 100, 29, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  textLines: {
    gap: 8
  },
  textLine: {
    height: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4
  },
  phone: {
    position: 'absolute',
    bottom: -16,
    right: -16,
    width: 96,
    height: 192,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 3,
    borderColor: '#f5f5f5',
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12
  },
  phoneContent: {
    width: '100%',
    height: 80,
    backgroundColor: 'rgba(180, 100, 29, 0.1)',
    borderRadius: 6,
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center'
  },
  phoneTextLines: {
    gap: 4
  },
  phoneTextLine: {
    height: 6,
    backgroundColor: '#f5f5f5',
    borderRadius: 3
  },
  syncIcon: {
    position: 'absolute',
    backgroundColor: '#b4641d',
    padding: 12,
    borderRadius: 999,
    shadowColor: '#b4641d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 4,
    borderColor: '#FBF7F2'
  },
  offlineGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  offlineIcons: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  offlineBookIcon: {
    position: 'absolute',
    bottom: -10,
    right: -10,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8
  },
  contentArea: {
    alignItems: 'center',
    marginBottom: 48
  },
  title: {
    fontFamily: 'Playfair Display',
    fontSize: 32,
    fontWeight: '700',
    color: '#171412',
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: 16,
    paddingHorizontal: 8
  },
  description: {
    fontSize: 18,
    color: '#4A443F',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: 16,
    maxWidth: 320
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 32
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(180, 100, 29, 0.2)'
  },
  paginationDotActive: {
    width: 24,
    backgroundColor: '#b4641d'
  },
  button: {
    borderRadius: 28,
    shadowColor: '#b4641d',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8
  },
  buttonContent: {
    height: 56,
    flexDirection: 'row-reverse'
  },
  buttonLabel: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.3
  }
});
