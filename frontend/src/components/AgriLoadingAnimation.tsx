import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import Icon from '@expo/vector-icons/MaterialIcons';

interface Props {
  language?: string;
}

const STAGES = [
  {
    icon: 'eco',
    titleEn: 'Scanning Leaf Tissue & Color...',
    titleMr: 'पानाचा रंग व संरचनेचे स्कॅनिंग सुरू आहे...',
    descEn: 'Inspecting leaf blade for subtle visual health indicators.',
    descMr: 'पानावरील सूक्ष्म रंगबदल व आरोग्य खुणा तपासत आहे.',
  },
  {
    icon: 'biotech',
    titleEn: 'Detecting Pest & Disease Symptoms...',
    titleMr: 'रोग व किडीच्या लक्षणांची पडताळणी सुरू आहे...',
    descEn: 'Analyzing foliar patterns against agricultural crop records.',
    descMr: 'कृषी संदर्भानुसार रोगाच्या लक्षणांचे सखोल विश्लेषण.',
  },
  {
    icon: 'grass',
    titleEn: 'Verifying Sugarcane Health Status...',
    titleMr: 'ऊस पीक आरोग्य स्थिती तपासत आहे...',
    descEn: 'Correlating leaf condition with sugarcane growth phase.',
    descMr: 'ऊस पिकाच्या वाढीच्या टप्प्यानुसार अचूक तुलना.',
  },
  {
    icon: 'health-and-safety',
    titleEn: 'Preparing Agronomic Treatment Advice...',
    titleMr: 'कृषी सल्ला आणि उपाययोजना तयार करत आहे...',
    descEn: 'Formulating certified management practices and dosage.',
    descMr: 'योग्य फवारणी व प्रतिबंधात्मक उपायांची शिफारस तयार करत आहे.',
  },
];

export const AgriLoadingAnimation: React.FC<Props> = ({ language }) => {
  const mr = language === 'mr';
  const [currentStage, setCurrentStage] = useState(0);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Pulse & Scan Line loops
  useEffect(() => {
    // 1. Central leaf breathing pulse
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.95,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // 2. Vertical laser scan beam
    const scanLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 1300,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    // 3. Radar wave expansion
    const rippleLoop = Animated.loop(
      Animated.timing(rippleAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    );

    pulseLoop.start();
    scanLoop.start();
    rippleLoop.start();

    return () => {
      pulseLoop.stop();
      scanLoop.stop();
      rippleLoop.stop();
    };
  }, [pulseAnim, scanLineAnim, rippleAnim]);

  // Stage cycling interval with smooth cross-fade
  useEffect(() => {
    const timer = setInterval(() => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0.2,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
      ]).start();

      setCurrentStage((prev) => (prev + 1) % STAGES.length);
    }, 2200);

    return () => clearInterval(timer);
  }, [fadeAnim]);

  // Interpolations
  const scanTranslateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-36, 36],
  });

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.95, 1.45],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.65, 0.35, 0],
  });

  const stage = STAGES[currentStage];

  return (
    <View style={styles.card} accessibilityLiveRegion="polite">
      {/* Top Agricultural Status Pill */}
      <View style={styles.topBadgeRow}>
        <View style={styles.liveBadge}>
          <View style={styles.pulseDot} />
          <Text style={styles.liveBadgeText}>
            {mr ? 'डिजिटल पीक तपासक' : 'AI Crop Health Doctor'}
          </Text>
        </View>
        <Text style={styles.stageIndicator}>
          {currentStage + 1} / {STAGES.length}
        </Text>
      </View>

      {/* Center Animated Scanner */}
      <View style={styles.scannerContainer}>
        {/* Expanding Echo Ripple */}
        <Animated.View
          style={[
            styles.rippleRing,
            {
              transform: [{ scale: rippleScale }],
              opacity: rippleOpacity,
            },
          ]}
        />

        {/* Outer Scanner Border */}
        <View style={styles.scannerOuterRing}>
          {/* Inner Glowing Pod */}
          <View style={styles.scannerInnerCircle}>
            {/* Center Pulsing Leaf Emblem */}
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Icon name={stage.icon as any} size={42} color="#10b981" />
            </Animated.View>

            {/* Sweeping Laser Scan Line */}
            <Animated.View
              style={[
                styles.scanBeam,
                {
                  transform: [{ translateY: scanTranslateY }],
                },
              ]}
            >
              <View style={styles.scanBeamGlow} />
            </Animated.View>
          </View>
        </View>
      </View>

      {/* Dynamic Text Information */}
      <Animated.View style={[styles.textBlock, { opacity: fadeAnim }]}>
        <Text style={styles.stageTitle}>
          {mr ? stage.titleMr : stage.titleEn}
        </Text>
        <Text style={styles.stageDesc}>
          {mr ? stage.descMr : stage.descEn}
        </Text>
      </Animated.View>

      {/* Progress Dots */}
      <View style={styles.dotsRow}>
        {STAGES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === currentStage ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    marginVertical: 4,
  },
  topBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dcfce7',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a',
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.3,
  },
  stageIndicator: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  scannerContainer: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  rippleRing: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: '#34d399',
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  scannerOuterRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    borderColor: '#10b981',
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  scannerInnerCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  scanBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: '#059669',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  scanBeamGlow: {
    width: '100%',
    height: 10,
    marginTop: -4,
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
  },
  textBlock: {
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 8,
    minHeight: 48,
    justifyContent: 'center',
  },
  stageTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065f46',
    textAlign: 'center',
    marginBottom: 4,
  },
  stageDesc: {
    fontSize: 12.5,
    color: '#047857',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 360,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
    marginTop: 14,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 22,
    backgroundColor: '#059669',
  },
  dotInactive: {
    width: 7,
    backgroundColor: '#cbd5e1',
  },
});

