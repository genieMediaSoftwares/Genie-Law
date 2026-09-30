import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { colors, sizing } from '../../theme';

export interface IconProps {
  size?: number;
  color?: string;
}

export const base = (size?: number) => ({
  width: size ?? sizing.iconSize,
  height: size ?? sizing.iconSize,
  viewBox: '0 0 24 24',
});

export const stroke = {
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  fill: 'none',
};

export const MailIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Path
      d="m3.5 7.5 7.4 5.3a2 2 0 0 0 2.2 0l7.4-5.3"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const LockIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M5 11a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Path
      d="M8 9V7a4 4 0 1 1 8 0v2"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Circle cx="12" cy="14.5" r="1.4" fill={color ?? colors.textSecondary} />
  </Svg>
);

export const UserIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="8" r="3.6" stroke={color ?? colors.textSecondary} {...stroke} />
    <Path
      d="M4.5 20a7.5 7.5 0 0 1 15 0"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const PhoneIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M7.5 3.5h9a1.5 1.5 0 0 1 1.5 1.5v14a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5a1.5 1.5 0 0 1 1.5-1.5Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Line
      x1="10.5"
      y1="17.5"
      x2="13.5"
      y2="17.5"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const EyeIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Circle cx="12" cy="12" r="3" stroke={color ?? colors.textSecondary} {...stroke} />
  </Svg>
);

export const EyeOffIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M9.9 5.1A9.6 9.6 0 0 1 12 4.9c6 0 9.5 6.2 9.5 6.2a16.4 16.4 0 0 1-3.2 3.9M6.6 6.7A16.2 16.2 0 0 0 2.5 11.1S6 17.3 12 17.3a9.7 9.7 0 0 0 3.6-.7"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Path
      d="M10 9.3a3 3 0 0 0 4.1 4.2"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Line x1="3.5" y1="3.5" x2="20.5" y2="20.5" stroke={color ?? colors.textSecondary} {...stroke} />
  </Svg>
);

export const ChevronDownIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="m6.5 9.5 5.5 5.5 5.5-5.5" stroke={color ?? colors.textSecondary} {...stroke} />
  </Svg>
);

export const CheckIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="m5 12.5 4.5 4.5L19 7" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const BackIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M15 5.5 8.5 12l6.5 6.5" stroke={color ?? colors.white} {...stroke} />
  </Svg>
);

export const AlertIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="8.5" stroke={color ?? colors.error} {...stroke} />
    <Line x1="12" y1="8" x2="12" y2="12.8" stroke={color ?? colors.error} {...stroke} />
    <Circle cx="12" cy="15.9" r="0.9" fill={color ?? colors.error} />
  </Svg>
);

export const GoogleIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M21 12.2c0-.7-.06-1.2-.18-1.8H12v3.3h5.1a4.4 4.4 0 0 1-1.9 2.9v2.4h3.1c1.8-1.7 2.7-4.1 2.7-6.8Z"
      fill={color ?? colors.white}
    />
    <Path
      d="M12 21.5c2.4 0 4.5-.8 6-2.2l-3.1-2.4c-.8.6-1.9.9-2.9.9-2.3 0-4.2-1.5-4.9-3.6H3.9v2.4A9 9 0 0 0 12 21.5Z"
      fill={color ?? colors.white}
    />
    <Path
      d="M7.1 14.2a5.4 5.4 0 0 1 0-3.4V8.4H3.9a9 9 0 0 0 0 8.2l3.2-2.4Z"
      fill={color ?? colors.white}
    />
    <Path
      d="M12 6.7c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 3.9 8.4l3.2 2.4c.7-2.1 2.6-4.1 4.9-4.1Z"
      fill={color ?? colors.white}
    />
  </Svg>
);
