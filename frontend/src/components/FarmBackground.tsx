import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

const pages = ['home', 'weather', 'gis', 'scan', 'advisory', 'alerts', 'profile', 'login'] as const;
type Page = typeof pages[number];

/** Sparse page-level decoration. Actual farm facts and maps always stay in the foreground. */
export function FarmBackground({ page }: { page: Page }) {
  // Home has an illustrated hero of its own; Scan and GIS maps need zero obstructions.
  if (page !== 'weather' && page !== 'advisory') return null;
  return (
    <View pointerEvents="none" accessible={false} accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants" style={styles.layer}>
      {page === 'weather' ? (
        <Image source={require('../assets/agriculture/windmill.png')}
          resizeMode="contain" style={styles.weatherImage} />
      ) : (
        <Image source={require('../assets/grain-illustration.png')}
          resizeMode="contain" style={styles.advisoryImage} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  weatherImage: { position: 'absolute', width: 98, height: 148, right: -18, top: 132, opacity: 0.11 },
  advisoryImage: { position: 'absolute', width: 94, height: 150, left: -26, top: 220, opacity: 0.10 },
});
