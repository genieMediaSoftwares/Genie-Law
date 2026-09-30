import React from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GenieHeader, LegalDocumentView } from '../../../components';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { useT } from '../../../i18n/useT';

// Shows the published privacy policy from the backend rather than text baked
// into the app.
export const PrivacyPolicyScreen: React.FC<
  ClientStackScreenProps<'PrivacyPolicy'>
> = ({ navigation }) => {
  const { t } = useT();
  return (
  <SafeAreaView edges={['top']} className="flex-1 bg-background">
    <GenieHeader title={t('settings:privacyPolicy')} onBack={() => navigation.goBack()} />
    <LegalDocumentView
      type="privacy_policy"
      emptyDescription={t('settings:privacyEmpty')}
    />
  </SafeAreaView>
  );
};
