import React, { useState, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { Text, Button, IconButton } from 'react-native-paper';
import Svg, { Rect, Circle, Text as SvgText, Path } from 'react-native-svg';

// Import shared design tokens
const tokens = require('../config/tokens');

const { width, height } = Dimensions.get('window');

// Onboarding screens data
const screens = [
  {
    id: 1,
    title: 'Ta Bibliothèque Sans Limites',
    description:
      "Plus de 500 titres, lus depuis n'importe où, même sans réseau. Ebooks, audiobooks, contenus exclusifs — tout en un.",
    illustration: (
      <Svg width={width * 0.8} height={height * 0.4} viewBox="0 0 400 300">
        <Rect x="80" y="100" width="60" height="80" fill="#B5651D" rx="4" />
        <Rect x="150" y="80" width="60" height="100" fill="#D4A017" rx="4" />
        <Rect x="220" y="90" width="60" height="90" fill="#2E4057" rx="4" />
        <Rect x="290" y="110" width="60" height="70" fill="#B5651D" opacity="0.7" rx="4" />
        <Circle cx="200" cy="50" r="30" fill="#D4A017" opacity="0.3" />
        <SvgText
          x="200"
          y="260"
          textAnchor="middle"
          fill="#B5651D"
          fontSize="48"
          fontWeight="bold"
        >
          📚
        </SvgText>
      </Svg>
    ),
    cta: 'Suivant',
  },
  {
    id: 2,
    title: 'Tout Fonctionne Partout',
    description:
      'Commence sur ton téléphone, continue sur ton ordinateur. Tes livres et ta progression te suivent automatiquement.',
    illustration: (
      <Svg width={width * 0.8} height={height * 0.4} viewBox="0 0 400 300">
        <Rect x="80" y="80" width="100" height="140" fill="#2E4057" rx="8" />
        <Rect x="90" y="90" width="80" height="120" fill="#FBF7F2" rx="4" />
        <Rect x="220" y="60" width="140" height="100" fill="#B5651D" rx="8" />
        <Rect x="230" y="70" width="120" height="80" fill="#FBF7F2" rx="4" />
        <Circle cx="350" cy="120" r="15" fill="#D4A017" />
        <Path d="M 180 150 Q 210 130 220 120" stroke="#D4A017" strokeWidth="3" fill="none" />
        <SvgText
          x="200"
          y="260"
          textAnchor="middle"
          fill="#B5651D"
          fontSize="48"
          fontWeight="bold"
        >
          🔄
        </SvgText>
      </Svg>
    ),
    cta: 'Suivant',
  },
  {
    id: 3,
    title: 'Prêt(e) ?',
    description: "Plus de 500 histoires t'attendent. Commence ta première lecture dès maintenant.",
    illustration: (
      <Svg width={width * 0.8} height={height * 0.4} viewBox="0 0 400 300">
        <Circle cx="200" cy="120" r="60" fill="#D4A017" opacity="0.3" />
        <Circle cx="200" cy="110" r="45" fill="#B5651D" />
        <Rect x="170" y="160" width="60" height="90" fill="#2E4057" rx="8" />
        <Rect x="140" y="180" width="50" height="70" fill="#B5651D" rx="4" />
        <SvgText
          x="200"
          y="270"
          textAnchor="middle"
          fill="#B5651D"
          fontSize="48"
          fontWeight="bold"
        >
          ✨
        </SvgText>
      </Svg>
    ),
    cta: 'Commencer à lire',
  },
];

const OnboardingCarousel = ({ onComplete, onSkip }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);

  const handleNext = () => {
    if (activeIndex === screens.length - 1) {
      // Last screen - complete onboarding
      onComplete();
    } else {
      const nextIndex = activeIndex + 1;
      flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
      setActiveIndex(nextIndex);
    }
  };

  const handleScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const index = Math.round(scrollPosition / width);
    setActiveIndex(index);
  };

  const renderItem = ({ item }) => (
    <View style={styles.screen}>
      {/* Illustration */}
      <View style={styles.illustrationContainer}>{item.illustration}</View>

      {/* Content */}
      <View style={styles.contentContainer}>
        <Text variant="headlineMedium" style={styles.title}>
          {item.title}
        </Text>
        <Text variant="bodyMedium" style={styles.description}>
          {item.description}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Skip Button */}
      <IconButton
        icon="close"
        iconColor={tokens.colors.onSurface.light}
        size={24}
        onPress={onSkip}
        style={styles.skipButton}
      />

      {/* FlatList Carousel */}
      <FlatList
        ref={flatListRef}
        data={screens}
        renderItem={renderItem}
        keyExtractor={(item) => item.id.toString()}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        bounces={false}
      />

      {/* Dots Indicators */}
      <View style={styles.dotsContainer}>
        {screens.map((screen, index) => (
          <View
            key={screen.id}
            style={[
              styles.dot,
              {
                backgroundColor:
                  index === activeIndex ? tokens.colors.primary : tokens.colors.neutral[300],
              },
            ]}
          />
        ))}
      </View>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <TouchableOpacity onPress={onSkip}>
          <Text style={styles.skipText}>Passer</Text>
        </TouchableOpacity>

        <Button
          mode="contained"
          onPress={handleNext}
          icon={activeIndex !== screens.length - 1 ? 'chevron-right' : undefined}
          contentStyle={styles.nextButtonContent}
          labelStyle={styles.nextButtonLabel}
          style={styles.nextButton}
          buttonColor={tokens.colors.primary}
        >
          {screens[activeIndex].cta}
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: tokens.colors.backgrounds.light,
  },
  skipButton: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 10,
  },
  screen: {
    width,
    flex: 1,
    paddingTop: 80,
  },
  illustrationContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  contentContainer: {
    paddingHorizontal: 32,
    paddingBottom: 32,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: tokens.colors.primary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 30,
  },
  description: {
    fontSize: 16,
    fontWeight: '400',
    color: tokens.colors.onSurface.light,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
    color: tokens.colors.primary,
  },
  nextButton: {
    borderRadius: 24,
  },
  nextButtonContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  nextButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default OnboardingCarousel;
