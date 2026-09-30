import React, { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
import { GenieText } from './GenieText';
import { getUploadUrl, resolveFileUrl } from '../../utils/urls';
import i18n from '../../i18n';

export type GenieAvatarSize = 'xs' | 'sm' | 'md' | 'card' | 'profile' | 'lg' | 'xl' | 'hero';

const SIZES: Record<GenieAvatarSize, { box: string; text: string }> = {
  xs: { box: 'h-[32px] w-[32px]', text: 'text-[11px]' },
  sm: { box: 'h-[32px] w-[32px]', text: 'text-[11px]' },
  md: { box: 'h-[40px] w-[40px]', text: 'text-[13px]' },
  card: { box: 'h-[48px] w-[48px]', text: 'text-[14px]' },
  profile: { box: 'h-[64px] w-[64px]', text: 'text-[18px]' },
  lg: { box: 'h-[80px] w-[80px]', text: 'text-[24px]' },
  xl: { box: 'h-[80px] w-[80px]', text: 'text-[24px]' },
  hero: { box: 'h-[96px] w-[96px]', text: 'text-[28px]' },
};

function initialsOf(name?: string | null): string {
  if (!name) {
    return 'GL';
  }
  return name
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export interface GenieAvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: GenieAvatarSize;
  ring?: boolean;
  className?: string;
}

export const GenieAvatar: React.FC<GenieAvatarProps> = ({
  uri,
  name,
  size = 'sm',
  ring = false,
  className = '',
}) => {
  const { box, text } = SIZES[size];
  const [imageError, setImageError] = useState(false);

  const resolved = getUploadUrl(uri) ?? resolveFileUrl(uri);

  useEffect(() => {
    setImageError(false);
  }, [uri]);

  return (
    <View
      className={[
        box,
        'items-center justify-center overflow-hidden rounded-full bg-surface',
        ring ? 'border-2 border-border' : '',
        className,
      ].join(' ')}
    >
      {resolved && !imageError ? (
        <Image
          source={{ uri: resolved }}
          className={`${box} rounded-full`}
          resizeMode="cover"
          accessibilityLabel={
            name ? i18n.t('common:a11y.personPhoto', { name }) : i18n.t('common:a11y.profilePhoto')
          }
          onError={e => {
            setImageError(true);
            if (__DEV__) {
              console.warn(
                `[GenieAvatar] Image failed to load from resolved URL: "${resolved}" (raw input: "${uri}"). Error:`,
                e.nativeEvent?.error,
              );
            }
          }}
        />
      ) : (
        <GenieText tone="gold" className={`${text} font-bold`}>
          {initialsOf(name)}
        </GenieText>
      )}
    </View>
  );
};
