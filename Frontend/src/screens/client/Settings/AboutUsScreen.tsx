import React from 'react';
import { View } from 'react-native';

import {
  ContactSupportRows,
  GenieCard,
  GenieHeader,
  GenieScreen,
  GenieSettingsGroup,
  GenieText,
  Logo,
} from '../../../components';
import { env } from '../../../config/env';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { useT } from '../../../i18n/useT';

const Bullet: React.FC<{ children: string }> = ({ children }) => (
  <View className="mb-2 flex-row items-start">
    <View className="mr-2 mt-2 h-1.5 w-1.5 rounded-full bg-gold" />
    <GenieText variant="body-sm" tone="secondary" className="flex-1">
      {children}
    </GenieText>
  </View>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <GenieCard tone="surface" className="mb-3 p-5">
    <GenieText variant="caption" tone="gold" className="mb-2 font-bold tracking-widest">
      {title}
    </GenieText>
    {children}
  </GenieCard>
);

export const AboutUsScreen: React.FC<ClientStackScreenProps<'AboutUs'>> = ({
  navigation,
}) => {
  const { t } = useT();
  return (
  <GenieScreen
    scrollable
    dismissKeyboardOnTap={false}
    header={<GenieHeader title={t('settings:about.title')} onBack={() => navigation.goBack()} />}
    contentContainerClassName="pb-10"
  >
      <View className="my-3 items-center">
        <Logo size={64} />
        <GenieText variant="heading-md" className="mt-2 tracking-[2px]">
          GENIE LAW
        </GenieText>
        <GenieText variant="caption" tone="gold" className="mt-1">
          {t('settings:about.tagline')}
        </GenieText>
        <GenieText variant="caption" tone="muted" className="mt-1 text-small-label">
          {t('settings:about.version', { version: env.appVersion })}
        </GenieText>
      </View>

      <Section title={t('settings:about.mission')}>
        <GenieText variant="body-sm" tone="secondary">
          {t('settings:about.missionText')}
        </GenieText>
      </Section>

      <Section title={t('settings:about.features')}>
        <Bullet>{t('settings:about.feature1')}</Bullet>
        <Bullet>{t('settings:about.feature2')}</Bullet>
        <Bullet>{t('settings:about.feature3')}</Bullet>
        <Bullet>{t('settings:about.feature4')}</Bullet>
      </Section>

      <GenieSettingsGroup title={t('settings:about.contactSupport')}>
        <ContactSupportRows />
      </GenieSettingsGroup>
  </GenieScreen>
  );
};
