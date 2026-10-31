import React from 'react';
import { ScrollView, ScrollViewProps, StyleSheet, View } from 'react-native';
import { FarmBackground } from './FarmBackground';

type Props = ScrollViewProps & { page: React.ComponentProps<typeof FarmBackground>['page'] };

/** Fixed decoration layer; only the foreground content scrolls. */
export function FarmPage({ page, style, children, ...props }: Props) {
  const backgroundColor = StyleSheet.flatten(style)?.backgroundColor || '#f7faf7';
  return <View style={[styles.frame, { backgroundColor }]}>
    <FarmBackground page={page} />
    <ScrollView {...props} style={[style, styles.content]}>{children}</ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  frame: { flex: 1, flexBasis: 0, minHeight: 0, position: 'relative', overflow: 'hidden' },
  content: { flex: 1, flexBasis: 0, minHeight: 0, backgroundColor: 'transparent' },
});
