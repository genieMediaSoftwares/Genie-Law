import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { base, stroke, type IconProps } from './Icons';
import { colors } from '../../theme';

export const CivilIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Line x1="12" y1="4" x2="12" y2="20" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="6" y1="20" x2="18" y2="20" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="4" y1="7" x2="20" y2="7" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M2.5 13 5 7l2.5 6a2.5 2.5 0 0 1-5 0Z" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M16.5 13 19 7l2.5 6a2.5 2.5 0 0 1-5 0Z" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const CriminalIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M12 3 4 7v6c0 5.5 3.8 10.1 8 11.5 4.2-1.4 8-6 8-11.5V7l-8-4Z" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M9.5 12.5 11 14l3.5-3.5" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const FamilyIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M12 21.3 4.6 13.2a4.6 4.6 0 0 1 6.5-6.5l.9.9.9-.9a4.6 4.6 0 0 1 6.5 6.5L12 20.3Z" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const PropertyIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M3 10.5 12 3l9 7.5V20a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 20v-9.5Z" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M9 21v-7h6v7" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const CyberIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Rect x="5" y="11" width="14" height="10" rx="2" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={color ?? colors.gold} {...stroke} />
    <Circle cx="12" cy="16" r="1" fill={color ?? colors.gold} />
  </Svg>
);

export const TaxIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="8" y1="8" x2="16" y2="8" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="8" y1="12" x2="16" y2="12" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="8" y1="16" x2="12" y2="16" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const EmploymentIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Rect x="3" y="8" width="18" height="12" rx="2" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="12" y1="12" x2="12" y2="15" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const ConsumerIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4H6Z" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="3" y1="6" x2="21" y2="6" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M16 10a4 4 0 0 1-8 0" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const BankingIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M3 10 12 3l9 7v2H3v-2Z" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="5" y1="12" x2="5" y2="18" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="9" y1="12" x2="9" y2="18" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="15" y1="12" x2="15" y2="18" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="19" y1="12" x2="19" y2="18" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="3" y1="18" x2="21" y2="18" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const DocumentationIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M14 2v6h6" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="8" y1="13" x2="16" y2="13" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="8" y1="17" x2="14" y2="17" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const MotorAccidentIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M5 17h14M5 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm14 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M3 13V8l3-3h10l3 3v5H3Z" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const MedicalIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M12 4v16M4 12h16" stroke={color ?? colors.gold} strokeWidth="2.2" strokeLinecap="round" />
  </Svg>
);

export const EducationIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Path d="M22 10 12 5 2 10l10 5 10-5Z" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M6 12.5V17c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const ImmigrationIcon: React.FC<IconProps> = ({ size, color }) => (
  <Svg {...base(size)}>
    <Circle cx="12" cy="12" r="9" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="3.6" y1="9" x2="20.4" y2="9" stroke={color ?? colors.gold} {...stroke} />
    <Line x1="3.6" y1="15" x2="20.4" y2="15" stroke={color ?? colors.gold} {...stroke} />
    <Path d="M11.5 3a14 14 0 0 0 0 18M12.5 3a14 14 0 0 1 0 18" stroke={color ?? colors.gold} {...stroke} />
  </Svg>
);

export const getCategoryIcon = (categoryId: string): React.FC<IconProps> => {
  switch (categoryId) {
    case 'civil_cases': return CivilIcon;
    case 'criminal_law': return CriminalIcon;
    case 'family_divorce': return FamilyIcon;
    case 'property_land': return PropertyIcon;
    case 'cyber_crime': return CyberIcon;
    case 'gst_taxation': return TaxIcon;
    case 'employment_labour': return EmploymentIcon;
    case 'consumer_complaints': return ConsumerIcon;
    case 'banking_financial': return BankingIcon;
    case 'business_corporate': return EmploymentIcon;
    case 'documentation': return DocumentationIcon;
    case 'motor_accident_claims': return MotorAccidentIcon;
    case 'medical_negligence': return MedicalIcon;
    case 'education_law': return EducationIcon;
    case 'immigration_visa': return ImmigrationIcon;
    default: return CivilIcon;
  }
};
