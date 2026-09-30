import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { base, stroke } from './Icons';
import type { IconProps } from './Icons';
import { colors } from '../../theme';

export const MenuIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Line x1="4" y1="7" x2="20" y2="7" stroke={color ?? colors.white} {...stroke} />
    <Line x1="4" y1="12" x2="20" y2="12" stroke={color ?? colors.white} {...stroke} />
    <Line x1="4" y1="17" x2="20" y2="17" stroke={color ?? colors.white} {...stroke} />
  </Svg>
);

export const BellIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M18 15.5V11a6 6 0 1 0-12 0v4.5L4.5 18h15L18 15.5Z"
      stroke={color ?? colors.white}
      {...stroke}
    />
    <Path d="M10 18a2 2 0 0 0 4 0" stroke={color ?? colors.white} {...stroke} />
  </Svg>
);

export const HomeIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z"
      stroke={color ?? colors.textMuted}
      {...stroke}
    />
    <Path d="M9.5 20.5V14h5v6.5" stroke={color ?? colors.textMuted} {...stroke} />
  </Svg>
);

export const BriefcaseIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M3.5 8.5A1.5 1.5 0 0 1 5 7h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-9Z"
      stroke={color ?? colors.textMuted}
      {...stroke}
    />
    <Path
      d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"
      stroke={color ?? colors.textMuted}
      {...stroke}
    />
    <Line
      x1="3.5"
      y1="12.5"
      x2="20.5"
      y2="12.5"
      stroke={color ?? colors.textMuted}
      {...stroke}
    />
  </Svg>
);

export const ScalesIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Line x1="12" y1="5" x2="12" y2="20" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="7.5" y1="20" x2="16.5" y2="20" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="4.5" y1="8" x2="19.5" y2="8" stroke={color ?? colors.textMuted} {...stroke} />
    <Path
      d="M2.6 13.6 5 8.6l2.4 5a2.5 2.5 0 0 1-4.8 0Z"
      stroke={color ?? colors.textMuted}
      {...stroke}
    />
    <Path
      d="M16.6 13.6 19 8.6l2.4 5a2.5 2.5 0 0 1-4.8 0Z"
      stroke={color ?? colors.textMuted}
      {...stroke}
    />
  </Svg>
);

export const PlusIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Line
      x1="12"
      y1="5.5"
      x2="12"
      y2="18.5"
      stroke={color ?? colors.onGold}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <Line
      x1="5.5"
      y1="12"
      x2="18.5"
      y2="12"
      stroke={color ?? colors.onGold}
      strokeWidth="2.2"
      strokeLinecap="round"
    />
  </Svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="11" cy="11" r="6.5" stroke={color ?? colors.textSecondary} {...stroke} />
    <Line
      x1="15.8"
      y1="15.8"
      x2="20"
      y2="20"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const FilterIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M4 6h16M7 12h10M10 18h4"
      stroke={color ?? colors.gold}
      {...stroke}
    />
  </Svg>
);

export const SortLinesIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Line x1="4" y1="7" x2="20" y2="7" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="4" y1="12" x2="20" y2="12" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="4" y1="17" x2="20" y2="17" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const StarIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="m12 3.6 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.99l-5.25 2.76 1-5.85L3.5 9.75l5.9-.85L12 3.6Z"
      fill={color ?? colors.gold}
    />
  </Svg>
);

// Generic badge-shaped icon: used both as the lawyer verification mark (via
// the dedicated `VerifiedBadge` component, which always passes the fixed
// blue) and as a plain icon elsewhere (e.g. the "Verified" filter tab, which
// colours it to match its own active/inactive tab state). The colour is
// intentionally caller-controlled here — do not hardcode it.
export const VerifiedIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="m12 2.8 2.35 1.7 2.9-.05.88 2.76 2.35 1.7-.92 2.75.92 2.75-2.35 1.7-.88 2.76-2.9-.05L12 21.2l-2.35-1.7-2.9.05-.88-2.76-2.35-1.7.92-2.75-.92-2.75 2.35-1.7.88-2.76 2.9.05L12 2.8Z"
      fill={color ?? colors.gold}
    />
    <Path
      d="m8.6 12.1 2.3 2.3 4.5-4.5"
      stroke={colors.background}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </Svg>
);

export const BookmarkIcon: React.FC<IconProps & { filled?: boolean }> = ({
  size,
  color,
  filled = false,
}) => (
  <Svg {...base(size)}>
    <Path
      d="M6.5 4.5A1.5 1.5 0 0 1 8 3h8a1.5 1.5 0 0 1 1.5 1.5V20l-5.5-3.8L6.5 20V4.5Z"
      stroke={color ?? colors.textMuted}
      fill={filled ? color ?? colors.gold : 'none'}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </Svg>
);

export const HeartIcon: React.FC<IconProps & { filled?: boolean }> = ({
  size,
  color,
  filled = false,
}) => (
  <Svg {...base(size)}>
    <Path
      d="M12 20.3 4.6 13.2a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5L12 20.3Z"
      stroke={color ?? colors.textMuted}
      fill={filled ? color ?? colors.gold : 'none'}
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </Svg>
);

export const FileIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M6 4.5A1.5 1.5 0 0 1 7.5 3H14l4.5 4.5v12A1.5 1.5 0 0 1 17 21H7.5A1.5 1.5 0 0 1 6 19.5v-15Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Path d="M14 3v4.5h4.5" stroke={color ?? colors.textSecondary} {...stroke} />
  </Svg>
);

export const SettingsIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="3.2" stroke={color ?? colors.textSecondary} {...stroke} />
    <Path
      d="M18.9 14.2a1.5 1.5 0 0 0 .3 1.66l.05.05a1.85 1.85 0 1 1-2.62 2.62l-.05-.05a1.5 1.5 0 0 0-1.66-.3 1.5 1.5 0 0 0-.92 1.38v.14a1.85 1.85 0 1 1-3.7 0v-.07a1.5 1.5 0 0 0-1-1.38 1.5 1.5 0 0 0-1.66.3l-.05.05a1.85 1.85 0 1 1-2.62-2.62l.05-.05a1.5 1.5 0 0 0 .3-1.66 1.5 1.5 0 0 0-1.38-.92H3.8a1.85 1.85 0 1 1 0-3.7h.07a1.5 1.5 0 0 0 1.38-1 1.5 1.5 0 0 0-.3-1.66l-.05-.05A1.85 1.85 0 1 1 7.52 3.3l.05.05a1.5 1.5 0 0 0 1.66.3h.07a1.5 1.5 0 0 0 .92-1.38V2.2a1.85 1.85 0 1 1 3.7 0v.07a1.5 1.5 0 0 0 .92 1.38 1.5 1.5 0 0 0 1.66-.3l.05-.05a1.85 1.85 0 1 1 2.62 2.62l-.05.05a1.5 1.5 0 0 0-.3 1.66v.07a1.5 1.5 0 0 0 1.38.92h.14a1.85 1.85 0 1 1 0 3.7h-.07a1.5 1.5 0 0 0-1.38.92Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const LogoutIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M15 4.5h3A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-3"
      stroke={color ?? colors.error}
      {...stroke}
    />
    <Path d="M11 8.5 14.5 12 11 15.5" stroke={color ?? colors.error} {...stroke} />
    <Line x1="14.5" y1="12" x2="4.5" y2="12" stroke={color ?? colors.error} {...stroke} />
  </Svg>
);

export const ChatIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M20.5 11.5c0 4-3.8 7.2-8.5 7.2a9.8 9.8 0 0 1-2.5-.32L4.5 20l1.3-3.6A6.9 6.9 0 0 1 3.5 11.5c0-4 3.8-7.2 8.5-7.2s8.5 3.2 8.5 7.2Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const SparkleIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M12 3.2 13.7 8.3 18.8 10 13.7 11.7 12 16.8 10.3 11.7 5.2 10 10.3 8.3 12 3.2Z"
      fill={color ?? colors.gold}
    />
    <Path
      d="M18.5 15.2 19.4 17.6 21.8 18.5 19.4 19.4 18.5 21.8 17.6 19.4 15.2 18.5 17.6 17.6 18.5 15.2Z"
      fill={color ?? colors.gold}
      opacity={0.75}
    />
  </Svg>
);

export const ClockIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="8.5" stroke={color ?? colors.textSecondary} {...stroke} />
    <Path d="M12 7v5.2l3.2 2" stroke={color ?? colors.textSecondary} {...stroke} />
  </Svg>
);

export const LocationIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M12 21s6.5-5.7 6.5-10.5a6.5 6.5 0 1 0-13 0C5.5 15.3 12 21 12 21Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Circle cx="12" cy="10.3" r="2.5" stroke={color ?? colors.textSecondary} {...stroke} />
  </Svg>
);

export const ChevronRightIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="m9.5 6.5 5.5 5.5-5.5 5.5" stroke={color ?? colors.textMuted} {...stroke} />
  </Svg>
);

export const InboxIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M3.5 13.5 6 5.5h12l2.5 8v5A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5v-5Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Path
      d="M3.5 13.5H9a3 3 0 0 0 6 0h5.5"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M3 6h18" stroke={color ?? colors.error} {...stroke} />
    <Path
      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
      stroke={color ?? colors.error}
      {...stroke}
    />
  </Svg>
);

export const SendIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="m22 2-7 20-4-9-9-4 20-7Z"
      stroke={color ?? colors.black}
      {...stroke}
    />
    <Line x1="22" y1="2" x2="11" y2="13" stroke={color ?? colors.black} {...stroke} />
  </Svg>
);

export const CameraIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M14.5 4h-5L8 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-4l-1.5-3Z"
      stroke={color ?? colors.white}
      {...stroke}
    />
    <Circle cx="12" cy="14" r="3.5" stroke={color ?? colors.white} {...stroke} />
  </Svg>
);

export const ShieldIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const InfoCircleIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="8.5" stroke={color ?? colors.textSecondary} {...stroke} />
    <Line x1="12" y1="11" x2="12" y2="16" stroke={color ?? colors.textSecondary} {...stroke} />
    <Circle cx="12" cy="8" r="0.9" fill={color ?? colors.textSecondary} />
  </Svg>
);

export const CloseIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Line x1="6" y1="6" x2="18" y2="18" stroke={color ?? colors.white} {...stroke} />
    <Line x1="18" y1="6" x2="6" y2="18" stroke={color ?? colors.white} {...stroke} />
  </Svg>
);

export const PaperclipIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M20 11.5 12.5 19a4.5 4.5 0 0 1-6.4-6.4l7.6-7.6a3 3 0 0 1 4.3 4.3l-7.6 7.6a1.5 1.5 0 0 1-2.1-2.1l7-7"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const MoreVerticalIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="5" r="1.5" fill={color ?? colors.textSecondary} />
    <Circle cx="12" cy="12" r="1.5" fill={color ?? colors.textSecondary} />
    <Circle cx="12" cy="19" r="1.5" fill={color ?? colors.textSecondary} />
  </Svg>
);

export const EyeIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Circle cx="12" cy="12" r="3" stroke={color ?? colors.textSecondary} {...stroke} />
  </Svg>
);

export const EditIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const UploadArrowIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M12 16V4M7 9l5-5 5 5" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M4 20h16" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const DownloadIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M12 4v12M7 11l5 5 5-5" stroke={color ?? colors.textSecondary} {...stroke} />
    <Path d="M4 20h16" stroke={color ?? colors.textSecondary} {...stroke} />
  </Svg>
);

export const ShareIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="18" cy="5" r="3" stroke={color ?? colors.textSecondary} {...stroke} />
    <Circle cx="6" cy="12" r="3" stroke={color ?? colors.textSecondary} {...stroke} />
    <Circle cx="18" cy="19" r="3" stroke={color ?? colors.textSecondary} {...stroke} />
    <Line x1="8.6" y1="13.5" x2="15.4" y2="17.5" stroke={color ?? colors.textSecondary} {...stroke} />
    <Line x1="15.4" y1="6.5" x2="8.6" y2="10.5" stroke={color ?? colors.textSecondary} {...stroke} />
  </Svg>
);

export const ImageIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="2"
      ry="2"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
    <Circle cx="8.5" cy="8.5" r="1.5" fill={color ?? colors.textSecondary} />
    <Path d="m21 15-5-5L5 21" stroke={color ?? colors.textSecondary} {...stroke} />
  </Svg>
);

export const FolderIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const ScanIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M3 7V5a2 2 0 0 1 2-2h2" stroke={color ?? colors.textSecondary} {...stroke} />
    <Path d="M17 3h2a2 2 0 0 1 2 2v2" stroke={color ?? colors.textSecondary} {...stroke} />
    <Path d="M21 17v2a2 2 0 0 1-2 2h-2" stroke={color ?? colors.textSecondary} {...stroke} />
    <Path d="M7 21H5a2 2 0 0 1-2-2v-2" stroke={color ?? colors.textSecondary} {...stroke} />
    <Line x1="7" y1="12" x2="17" y2="12" stroke={color ?? colors.gold} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

export const WifiOffIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M5 13a10 10 0 0 1 14 0" stroke={color ?? colors.textMuted} {...stroke} />
    <Path d="M8.5 16.5a6 6 0 0 1 7 0" stroke={color ?? colors.textMuted} {...stroke} />
    <Circle cx="12" cy="20" r="1.5" fill={color ?? colors.textMuted} />
    <Circle cx="19" cy="19" r="4.5" fill={colors.error} />
    <Line x1="17.2" y1="17.2" x2="20.8" y2="20.8" stroke={colors.white} strokeWidth="1.6" strokeLinecap="round" />
    <Line x1="20.8" y1="17.2" x2="17.2" y2="20.8" stroke={colors.white} strokeWidth="1.6" strokeLinecap="round" />
  </Svg>
);

export const RefreshIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M21.5 2v6h-6M21.34 15.5A9 9 0 1 1 18 3.5l3.5 4.5"
      stroke={color ?? colors.onGold}
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

export const MicIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Rect
      x="9"
      y="2.5"
      width="6"
      height="11"
      rx="3"
      stroke={color ?? colors.white}
      {...stroke}
    />
    <Path
      d="M5.5 11a6.5 6.5 0 0 0 13 0"
      stroke={color ?? colors.white}
      {...stroke}
    />
    <Line
      x1="12"
      y1="17.5"
      x2="12"
      y2="21"
      stroke={color ?? colors.white}
      {...stroke}
    />
  </Svg>
);

export const CourtIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M3 9.5 12 4l9 5.5" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="6.5" y1="11.5" x2="6.5" y2="17" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="12" y1="11.5" x2="12" y2="17" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="17.5" y1="11.5" x2="17.5" y2="17" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="4" y1="19.5" x2="20" y2="19.5" stroke={color ?? colors.textMuted} {...stroke} />
  </Svg>
);

export const CloudUploadIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path
      d="M7 18h10a4 4 0 0 0 .6-7.95 5.5 5.5 0 0 0-10.72-1.2A3.9 3.9 0 0 0 7 18Z"
      stroke={color ?? colors.gold}
      {...stroke}
    />
    <Path d="M12 16v-5.5M9.6 12.9 12 10.5l2.4 2.4" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const GlobeIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="8.5" stroke={color ?? colors.textSecondary} {...stroke} />
    <Line x1="3.6" y1="9.5" x2="20.4" y2="9.5" stroke={color ?? colors.textSecondary} {...stroke} />
    <Line x1="3.6" y1="14.5" x2="20.4" y2="14.5" stroke={color ?? colors.textSecondary} {...stroke} />
    <Path
      d="M11.5 3.5a14 14 0 0 0 0 17M12.5 3.5a14 14 0 0 1 0 17"
      stroke={color ?? colors.textSecondary}
      {...stroke}
    />
  </Svg>
);

export const CardIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Rect x="3" y="5.5" width="18" height="13" rx="2" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="3" y1="10" x2="21" y2="10" stroke={color ?? colors.textMuted} {...stroke} />
    <Line x1="6.5" y1="15" x2="10" y2="15" stroke={color ?? colors.textMuted} {...stroke} />
  </Svg>
);
