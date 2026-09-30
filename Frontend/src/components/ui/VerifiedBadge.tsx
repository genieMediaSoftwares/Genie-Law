import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../../theme';
import i18n from '../../i18n';

export interface VerifiedBadgeProps {
  size?: number;
  className?: string;
}

// The one lawyer verification badge, used everywhere a verified lawyer's
// name is shown: a compact Instagram-style blue check, always
// `colors.verifiedBadge` (#0095F6) with a white mark. Never gold/yellow, and
// never a caller-supplied colour — that's the whole point of centralizing
// it here instead of colouring a generic icon per screen.
export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ size = 16, className = '' }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    accessibilityLabel={i18n.t('common:a11y.verifiedLawyer')}
  >
    <Path
      d="m12 2.8 2.35 1.7 2.9-.05.88 2.76 2.35 1.7-.92 2.75.92 2.75-2.35 1.7-.88 2.76-2.9-.05L12 21.2l-2.35-1.7-2.9.05-.88-2.76-2.35-1.7.92-2.75-.92-2.75 2.35-1.7.88-2.76 2.9.05L12 2.8Z"
      fill={colors.verifiedBadge}
    />
    <Path
      d="m8.6 12.1 2.3 2.3 4.5-4.5"
      stroke={colors.white}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);
