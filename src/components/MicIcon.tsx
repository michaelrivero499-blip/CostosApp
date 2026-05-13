import React from 'react';
import Svg, { Path, Line } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function MicIcon({ size = 24, color = '#FFFFFF', strokeWidth = 2 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2C10.343 2 9 3.343 9 5v6c0 1.657 1.343 3 3 3s3-1.343 3-3V5c0-1.657-1.343-3-3-3z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 11c0 3.314 2.686 6 6 6s6-2.686 6-6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="12" y1="17" x2="12" y2="21"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1="9" y1="21" x2="15" y2="21"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}
