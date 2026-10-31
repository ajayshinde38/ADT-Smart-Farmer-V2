import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';
import { Icon } from './ui';

/** Subtle condition glyph animation. Does not suggest an additional weather measurement. */
export function WeatherMotionIcon({ name }: { name: React.ComponentProps<typeof Icon>['name'] }) {
  const motion = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let mounted = true;
    let loop: Animated.CompositeAnimation | undefined;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(reduced => {
        if (!mounted || reduced) return;
        loop = Animated.loop(Animated.sequence([
          Animated.timing(motion, { toValue: 1, duration: 1700, useNativeDriver: true }),
          Animated.timing(motion, { toValue: 0, duration: 1700, useNativeDriver: true }),
        ]));
        loop.start();
      })
      .catch(() => undefined);
    return () => { mounted = false; loop?.stop(); motion.stopAnimation(); };
  }, [motion]);
  return (
    <Animated.View style={{
      transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
    }}>
      <Icon name={name} size={38} color="#B96E14" />
    </Animated.View>
  );
}
