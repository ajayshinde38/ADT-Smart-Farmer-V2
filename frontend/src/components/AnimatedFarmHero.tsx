
import React, { useEffect, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { AppText as Text } from './ui';
import { ADTMark } from './ADTMark';

type Props = { language: 'en' | 'mr' };

/** Decorative farm scenery; it does not describe the selected farmer's property. */
export function AnimatedFarmHero({ language }: Props) {
  const { width } = useWindowDimensions();
  const compact = width < 385;

  const entrance = useRef(new Animated.Value(0)).current;
  const cloudDrift = useRef(new Animated.Value(0)).current;
  const cowFloat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    let cloudLoop: Animated.CompositeAnimation | undefined;
    let cowLoop: Animated.CompositeAnimation | undefined;

    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduceMotion) => {
        if (!mounted) return;
        if (reduceMotion) {
          entrance.setValue(1);
          cloudDrift.setValue(0);
          cowFloat.setValue(0);
          return;
        }

        Animated.timing(entrance, {
          toValue: 1,
          duration: 550,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();

        cloudLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(cloudDrift, {
              toValue: 1,
              duration: 7800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(cloudDrift, {
              toValue: 0,
              duration: 7800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        );

        cowLoop = Animated.loop(
          Animated.sequence([
            Animated.timing(cowFloat, {
              toValue: 1,
              duration: 2800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(cowFloat, {
              toValue: 0,
              duration: 2800,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        );

        cloudLoop.start();
        cowLoop.start();
      })
      .catch(() => {
        if (mounted) entrance.setValue(1);
      });

    return () => {
      mounted = false;
      cloudLoop?.stop();
      cowLoop?.stop();
      entrance.stopAnimation();
      cloudDrift.stopAnimation();
      cowFloat.stopAnimation();
    };
  }, [entrance, cloudDrift, cowFloat]);

  const mr = language === 'mr';

  const fadeUp = entrance.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });

  const cloudX = cloudDrift.interpolate({
    inputRange: [0, 1],
    outputRange: [-5, 10],
  });

  const cowY = cowFloat.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -3],
  });

  return (
    <Animated.View
      style={[
        styles.outer,
        {
          opacity: entrance,
          transform: [{ translateY: fadeUp }],
        },
      ]}
    >
      <View style={styles.card}>
        <View pointerEvents="none" style={styles.sunGlow} />
        <View pointerEvents="none" style={styles.groundGlow} />

        <Animated.Image
          accessible={false}
          source={require('../assets/illustrations/clouud.png')}
          resizeMode="contain"
          style={[
            styles.cloud,
            { transform: [{ translateX: cloudX }] },
          ]}
        />

        <View style={styles.row}>
          <View style={styles.copy}>
            <View style={styles.brandRow}>
              <ADTMark size={27} />
              <Text style={styles.kicker}>
                ADT SMART FARMER
              </Text>
            </View>

            <Text
              style={[
                styles.title,
                compact && styles.compactTitle,
              ]}
            >
              {mr
                ? 'Ã Â¤Â¤Ã Â¥ÂÃ Â¤Â®Ã Â¤Å¡Ã Â¥ÂÃ Â¤Â¯Ã Â¤Â¾ Ã Â¤Â¶Ã Â¥â€¡Ã Â¤Â¤Ã Â¤Â¾Ã Â¤Å¡Ã Â¤Â¾ Ã Â¤â€ Ã Â¤Â¢Ã Â¤Â¾Ã Â¤ÂµÃ Â¤Â¾'
                : 'Your farm, at a glance'}
            </Text>

            <Text style={styles.subtitle}>
              {mr
                ? 'Ã Â¤Â¹Ã Â¤ÂµÃ Â¤Â¾Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â¨ Ã‚Â· Ã Â¤ÂªÃ Â¥â‚¬Ã Â¤â€¢ Ã Â¤Â¨Ã Â¤Â¿Ã Â¤Â°Ã Â¥â‚¬Ã Â¤â€¢Ã Â¥ÂÃ Â¤Â·Ã Â¤Â£ Ã‚Â· Ã Â¤Â¶Ã Â¥â€¡Ã Â¤Â¤ Ã Â¤Â®Ã Â¤Â¾Ã Â¤Â¹Ã Â¤Â¿Ã Â¤Â¤Ã Â¥â‚¬'
                : 'Weather Ã‚Â· Crop insights Ã‚Â· Field updates'}
            </Text>

            <View style={styles.accentLine} />
          </View>

          <View
            accessible={false}
            style={[
              styles.art,
              { width: compact ? 123 : 155 },
            ]}
          >
            <View style={styles.artGround} />

            <Image
              source={require('../assets/illustrations/tree1.png')}
              resizeMode="contain"
              style={styles.tree}
            />

            <Image
              source={require('../assets/illustrations/House1.png')}
              resizeMode="contain"
              style={styles.house}
            />

            <Image
              source={require('../assets/agriculture/haybell1.png')}
              resizeMode="contain"
              style={styles.hay}
            />

            <Animated.Image
              source={require('../assets/agriculture/cow1.png')}
              resizeMode="contain"
              style={[
                styles.cow,
                { transform: [{ translateY: cowY }] },
              ]}
            />
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 24,
    shadowColor: '#164B2A',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.09,
    shadowRadius: 12,
    elevation: 3,
  },

  card: {
    overflow: 'hidden',
    borderRadius: 24,
    backgroundColor: '#EAF7EC',
    borderWidth: 1,
    borderColor: '#C9E8D0',
    paddingHorizontal: 16,
    paddingVertical: 13,
    minHeight: 190,
  },

  sunGlow: {
    position: 'absolute',
    right: -45,
    top: -84,
    width: 215,
    height: 215,
    borderRadius: 108,
    backgroundColor: '#D3F0CF',
  },

  groundGlow: {
    position: 'absolute',
    right: -55,
    bottom: -95,
    width: 305,
    height: 175,
    borderRadius: 150,
    backgroundColor: '#D9F0D5',
  },

  cloud: {
    position: 'absolute',
    right: 27,
    top: 12,
    width: 118,
    height: 30,
    opacity: 0.57,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 162,
  },

  copy: {
    flex: 1,
    paddingRight: 6,
    paddingVertical: 10,
    zIndex: 2,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 11,
  },

  kicker: {
    color: '#277143',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.45,
    flexShrink: 1,
  },

  title: {
    color: '#153F29',
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
  },

  compactTitle: {
    fontSize: 18,
    lineHeight: 25,
  },

  subtitle: {
    color: '#537363',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 9,
  },

  accentLine: {
    marginTop: 12,
    width: 41,
    height: 4,
    borderRadius: 4,
    backgroundColor: '#71C68B',
  },

  art: {
    height: 158,
    position: 'relative',
    alignSelf: 'flex-end',
  },

  artGround: {
    position: 'absolute',
    bottom: 2,
    right: 0,
    width: '100%',
    height: 43,
    borderRadius: 70,
    backgroundColor: '#C9EBC6',
    opacity: 0.65,
  },

  tree: {
    position: 'absolute',
    top: 17,
    left: 0,
    width: 60,
    height: 105,
    opacity: 0.77,
  },

  house: {
    position: 'absolute',
    top: 29,
    right: -5,
    width: 114,
    height: 68,
    opacity: 0.76,
  },

  hay: {
    position: 'absolute',
    left: 2,
    bottom: 4,
    width: 61,
    height: 47,
  },

  cow: {
    position: 'absolute',
    right: -5,
    bottom: 2,
    width: 109,
    height: 84,
  },
});
