import React from 'react';
import { Image, ImageSourcePropType, ImageStyle, StyleProp, View } from 'react-native';
import lawLogoImg from '../assets/images/law_logo.png';
import i18n from '../i18n';

interface LogoProps {
  size?: number;
  withHalo?: boolean;
  className?: string;
  style?: StyleProp<ImageStyle>;
}

export const Logo: React.FC<LogoProps> = ({
  size = 72,
  className = '',
  style,
}) => {
  let source: ImageSourcePropType;

  if (typeof lawLogoImg === 'number') {
    source = lawLogoImg;
  } else if (typeof lawLogoImg === 'string') {
    source = { uri: lawLogoImg };
  } else if (
    lawLogoImg &&
    typeof lawLogoImg === 'object' &&
    'default' in lawLogoImg &&
    typeof (lawLogoImg as { default: unknown }).default === 'string'
  ) {
    source = { uri: (lawLogoImg as { default: string }).default };
  } else if (
    lawLogoImg &&
    typeof lawLogoImg === 'object' &&
    'uri' in lawLogoImg
  ) {
    source = lawLogoImg as ImageSourcePropType;
  } else {
    source = { uri: '/law_logo.png' };
  }

  return (
    <View
      className={`items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        source={source}
        style={[{ width: '100%', height: '100%' }, style]}
        resizeMode="contain"
        accessibilityLabel={i18n.t('common:a11y.logo')}
      />
    </View>
  );
};
