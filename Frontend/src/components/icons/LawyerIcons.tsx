import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { base, stroke } from './Icons';
import type { IconProps } from './Icons';
import { colors } from '../../theme';

export const GridIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Rect x="4" y="4" width="7" height="7" rx="1.5" stroke={color ?? colors.textMuted} {...stroke} />
    <Rect x="13" y="4" width="7" height="7" rx="1.5" stroke={color ?? colors.textMuted} {...stroke} />
    <Rect x="4" y="13" width="7" height="7" rx="1.5" stroke={color ?? colors.textMuted} {...stroke} />
    <Rect x="13" y="13" width="7" height="7" rx="1.5" stroke={color ?? colors.textMuted} {...stroke} />
  </Svg>
);

export const ChartIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Line x1="4" y1="20" x2="20" y2="20" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="7.5" y1="20" x2="7.5" y2="13" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="12" y1="20" x2="12" y2="8" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="16.5" y1="20" x2="16.5" y2="11" stroke={color ?? colors.textMuted} {...stroke} />
  </Svg>
);

export const UsersIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="9" cy="8" r="3.2" stroke={color ?? colors.textMuted} {...stroke} />
    <Path
      d="M3.5 19.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5"
      stroke={color ?? colors.textMuted}
      {...stroke}
    />
    <Path
      d="M16 5.6a3.2 3.2 0 0 1 0 6.1M17.2 14.9c2 .6 3.3 2.3 3.3 4.6"
      stroke={color ?? colors.textMuted}
      {...stroke}
    />
  </Svg>
);

export const CalendarIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Rect x="3.5" y="5.5" width="17" height="15" rx="2.5" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="3.5" y1="10" x2="20.5" y2="10" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="8" y1="3.5" x2="8" y2="7" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="16" y1="3.5" x2="16" y2="7" stroke={color ?? colors.textMuted} {...stroke} />
  </Svg>
);

export const UserPlusIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="10" cy="8" r="3.4" stroke={color ?? colors.textMuted} {...stroke} />
    <Path
      d="M3.8 20c0-3.2 2.8-5.4 6.2-5.4 1.2 0 2.3.3 3.2.8"
      stroke={color ?? colors.textMuted}
      {...stroke}
    />
    <Line x1="17.5" y1="14" x2="17.5" y2="20" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="14.5" y1="17" x2="20.5" y2="17" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const CheckCircleIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="8.5" stroke={color ?? colors.success} {...stroke} />
    <Path d="M8.5 12.2l2.4 2.4 4.6-4.9" stroke={color ?? colors.success} {...stroke} />
  </Svg>
);

export const XCircleIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="8.5" stroke={color ?? colors.error} {...stroke} />
    <Line x1="9.2" y1="9.2" x2="14.8" y2="14.8" stroke={color ?? colors.error} {...stroke} />
    <Line x1="14.8" y1="9.2" x2="9.2" y2="14.8" stroke={color ?? colors.error} {...stroke} />
  </Svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M14.5 5.5 8 12l6.5 6.5" stroke={color ?? colors.white} {...stroke} />
  </Svg>
);

export const CrownIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M4 17.5 5.2 8l4.1 3.4L12 6.2l2.7 5.2L18.8 8 20 17.5H4Z"
      stroke={color ?? colors.gold}
      {...stroke}
    />
    <Line x1="4" y1="20" x2="20" y2="20" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);
