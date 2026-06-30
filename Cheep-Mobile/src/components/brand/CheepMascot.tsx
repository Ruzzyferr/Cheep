/**
 * 🐦 Cheep Mascot — the brand character (single source of truth).
 *
 * Vector (react-native-svg) so it stays crisp at any size, themeable, and
 * animatable. The SAME artwork is rendered to the app icon / splash (see
 * assets/mascot/cheep-mascot.svg + scripts that rasterize it).
 *
 * `expression` drives the eyes/accessories for greetings, empty states and the
 * intro tour:
 *   happy    — open eye (default)
 *   wink     — one happy arc
 *   sleep    — closed arc + "z z z"
 *   celebrate— open eye + sparkles
 *   search   — open eye + a little magnifier
 */
import React from 'react';
import Svg, { Ellipse, Path, Circle, G, Line } from 'react-native-svg';

export type MascotExpression = 'happy' | 'wink' | 'sleep' | 'celebrate' | 'search';

const C = {
  bodyMint: '#57C99A',
  mintDark: '#36A77B',
  mintDeep: '#2E9E78',
  belly: '#E8F7EF',
  beak: '#F4772E',
  beakEdge: '#E0631F',
  ink: '#16261F',
  blush: '#FB9C86',
};

export function CheepMascot({
  size = 96,
  expression = 'happy',
  shadow = true,
}: {
  size?: number;
  expression?: MascotExpression;
  shadow?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
      {shadow && <Ellipse cx={60} cy={115} rx={30} ry={4.5} fill={C.ink} opacity={0.08} />}

      {/* tail */}
      <Path d="M30 70 L9 60 L27 80 Z" fill={C.mintDeep} />
      <Path d="M29 78 L11 78 L30 90 Z" fill={C.mintDark} />

      {/* crest */}
      <Path d="M52 24 q3 -9 8 -3 q2 -9 8 -3 q3 6 -2 9 q-7 -3 -14 -3 Z" fill={C.mintDark} />

      {/* body */}
      <Ellipse cx={60} cy={66} rx={37} ry={39} fill={C.bodyMint} stroke={C.mintDeep} strokeWidth={3} />
      {/* belly */}
      <Ellipse cx={64} cy={76} rx={21} ry={24} fill={C.belly} />
      {/* wing */}
      <Path d="M40 50 C30 54 30 74 42 80 C48 74 48 56 40 50 Z" fill={C.mintDark} />

      {/* eye */}
      {expression === 'sleep' || expression === 'wink' ? (
        <Path d="M71 55 Q78 61 85 55" stroke={C.ink} strokeWidth={3} strokeLinecap="round" fill="none" />
      ) : (
        <G>
          <Circle cx={78} cy={55} r={6.5} fill={C.ink} />
          <Circle cx={80.5} cy={52.5} r={2.1} fill="#fff" />
        </G>
      )}

      {/* blush */}
      <Ellipse cx={86} cy={66} rx={5.5} ry={3.6} fill={C.blush} opacity={0.65} />

      {/* beak */}
      <Path
        d="M93 57 Q104 60 110 63 Q104 66 93 67 Q90 62 93 57 Z"
        fill={C.beak}
        stroke={C.beakEdge}
        strokeWidth={1}
      />

      {/* feet */}
      <G stroke={C.beak} strokeWidth={3.5} strokeLinecap="round" fill="none">
        <Path d="M53 104 L53 112" />
        <Path d="M48 115 L53 112 L58 115" />
        <Path d="M69 104 L69 112" />
        <Path d="M64 115 L69 112 L74 115" />
      </G>

      {/* expression extras */}
      {expression === 'celebrate' && (
        <G stroke={C.beak} strokeWidth={2.5} strokeLinecap="round">
          <Line x1={104} y1={24} x2={104} y2={32} />
          <Line x1={100} y1={28} x2={108} y2={28} />
          <Line x1={20} y1={34} x2={20} y2={40} />
          <Line x1={17} y1={37} x2={23} y2={37} />
        </G>
      )}
      {expression === 'sleep' && (
        <G fill={C.mintDeep}>
          <Path d="M96 28 h8 l-8 8 h8" stroke={C.mintDeep} strokeWidth={2} fill="none" strokeLinejoin="round" />
        </G>
      )}
      {expression === 'search' && (
        <G stroke={C.beak} strokeWidth={3} fill="none" strokeLinecap="round">
          <Circle cx={26} cy={40} r={7} />
          <Line x1={31} y1={45} x2={37} y2={51} />
        </G>
      )}
    </Svg>
  );
}
