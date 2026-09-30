import React from 'react';
import { View } from 'react-native';

import { GenieButton } from '../ui/GenieButton';
import { GenieModal } from '../ui/GenieModal';
import { GenieText } from '../ui/GenieText';
import type { RejectedDocument } from '../../services/documentRelevance';
import { useT } from '../../i18n/useT';

export interface DocumentRelevanceAlertProps {
  rejected: RejectedDocument[];
  onChooseAnother: () => void;
  onClose: () => void;
}

// Shown when the AI rejects documents as unrelated to the case. The rejected
// files have already been dropped; this explains why and offers a new pick.
export const DocumentRelevanceAlert: React.FC<DocumentRelevanceAlertProps> = ({
  rejected,
  onChooseAnother,
  onClose,
}) => {
  const { t } = useT();
  return (
  <GenieModal
    visible={rejected.length > 0}
    onClose={onClose}
    title={t('documents:relevance.alertTitle')}
  >
    <GenieText variant="body-md" tone="secondary">
      {t('documents:relevance.notRelevant')}
    </GenieText>

    <View className="mt-4 gap-3" testID="document-relevance-alert">
      {rejected.map(({ file, documentType, reason }, index) => (
        <View key={`${file.name}-${index}`}>
          <GenieText variant="body-md" className="font-semibold" numberOfLines={1}>
            {`✕ ${file.name}`}
          </GenieText>
          <GenieText variant="caption" tone="muted" className="mt-0.5">
            {[documentType, reason].filter(Boolean).join(' — ')}
          </GenieText>
        </View>
      ))}
    </View>

    <View className="mt-5 flex-row gap-3">
      <GenieButton
        label={t('documents:relevance.remove')}
        variant="outline"
        onPress={onClose}
        className="flex-1"
      />
      <GenieButton
        label={t('documents:relevance.chooseAnother')}
        onPress={onChooseAnother}
        className="flex-1"
      />
    </View>
  </GenieModal>
  );
};
