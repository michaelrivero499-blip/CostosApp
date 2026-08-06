import React from 'react';
import Svg, { Path, Rect, Circle, Line, G } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
}

export function DeudasIcon({ size = 24, color = '#8E8E93' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="7" r="3" stroke={color} strokeWidth={1.8} />
      <Path
        d="M3 20c0-3.314 2.686-6 6-6s6 2.686 6 6"
        stroke={color} strokeWidth={1.8} strokeLinecap="round"
      />
      <Path
        d="M17 11v6M20 14h-6"
        stroke={color} strokeWidth={1.8} strokeLinecap="round"
      />
    </Svg>
  );
}

export function EstadisticasIcon({ size = 24, color = '#8E8E93' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="14" width="4" height="7" rx="1" stroke={color} strokeWidth={1.8} />
      <Rect x="10" y="9" width="4" height="12" rx="1" stroke={color} strokeWidth={1.8} />
      <Rect x="17" y="4" width="4" height="17" rx="1" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}

export function FinanzasIcon({ size = 24, color = '#8E8E93' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="6" width="20" height="14" rx="2" stroke={color} strokeWidth={1.8} />
      <Path d="M2 10h20" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M6 15h4" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

export function SearchIcon({ size = 24, color = '#8E8E93' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={1.9} />
      <Path
        d="M15.5 15.5L21 21"
        stroke={color} strokeWidth={1.9} strokeLinecap="round"
      />
    </Svg>
  );
}

export function AjustesIcon({ size = 24, color = '#8E8E93' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.8} />
    </Svg>
  );
}
