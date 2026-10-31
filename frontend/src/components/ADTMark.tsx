import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/** Original ADT leaf-and-orbit monogram. Pure vector; no external images or fonts. */
export function ADTMark({ size = 32 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" accessible={false}>
      <Circle cx="32" cy="32" r="31" fill="#00450d" />
      <Path
        d="M16 39C21 23 37 15 49 17C48 32 39 45 24 47C21 47 18 44 16 39Z"
        fill="#B8F3A7"
      />
      <Path d="M20 44C30 34 37 29 46 22" fill="none" stroke="#00450d" strokeWidth="3.2" strokeLinecap="round" />
      <Path d="M23 36L21 29M33 29L32 23" fill="none" stroke="#00450d" strokeWidth="2" strokeLinecap="round" />
      <Path d="M10 26C17 11 38 7 51 20" fill="none" stroke="#E3FFCF" strokeWidth="2" strokeLinecap="round" strokeDasharray="2.5 5" opacity="0.8" />
      <Circle cx="51" cy="20" r="3.5" fill="#F5C66A" />
    </Svg>
  );
}
