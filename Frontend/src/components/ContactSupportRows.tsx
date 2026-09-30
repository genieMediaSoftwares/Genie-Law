import React, { useState } from 'react';
import { View } from 'react-native';

import { GenieNotice, GenieSettingsRow } from './ui';
import { MailIcon, PhoneIcon } from './icons/Icons';
import { openSupport, supportContact } from '../utils/support';
import type { SupportChannel } from '../utils/support';
import { colors } from '../theme';
import { useT } from '../i18n/useT';

export const ContactSupportRows: React.FC = () => {
  const { t } = useT();
  const [failure, setFailure] = useState<string | null>(null);

  const contact = async (channel: SupportChannel) => {
    setFailure(null);
    if (await openSupport(channel)) {
      return;
    }
    setFailure(
      channel === 'phone'
        ? t('settings:support.noCallingApp', { phone: supportContact.phone })
        : t('settings:support.noEmailApp', { email: supportContact.email }),
    );
  };

  return (
    <>
      <GenieSettingsRow
        testID="support-phone"
        label={t('settings:support.call')}
        subtitle={supportContact.phone}
        icon={<PhoneIcon size={18} color={colors.gold} />}
        onPress={() => void contact('phone')}
      />
      <View className="ml-4 h-px bg-border" />
      <GenieSettingsRow
        testID="support-email"
        label={t('settings:support.email')}
        subtitle={supportContact.email}
        icon={<MailIcon size={18} color={colors.gold} />}
        onPress={() => void contact('email')}
      />
      {failure ? (
        <View className="px-4 pb-3">
          <GenieNotice tone="warning" message={failure} />
        </View>
      ) : null}
    </>
  );
};
