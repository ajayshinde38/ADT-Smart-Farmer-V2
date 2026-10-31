import React, { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleProp, ViewStyle } from 'react-native';

/** Small accessible tab/CTA emphasis; only animates when the selection changes. */
export function MotionIcon({ active, children, style }: {
  active: boolean;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const scale = useRef(new Animated.Value(active ? 1.055 : 1)).current;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!mounted) return;
        if (reduced) {
          scale.setValue(1);
          return;
        }
        Animated.spring(scale, {
          toValue: active ? 1.055 : 1,
          friction: 10,
          tension: 100,
          useNativeDriver: true,
        }).start();
      })
      .catch(() => { if (mounted) scale.setValue(active ? 1.055 : 1); });
    return () => { mounted = false; scale.stopAnimation(); };
  }, [active, scale]);

  return <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>;
}
