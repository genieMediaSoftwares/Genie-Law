import React from 'react';
import { ScrollView, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';

import {
  GenieEmptyState,
  GenieErrorState,
  GenieNotice,
  GenieSkeleton,
  GenieText,
} from '../ui';
import { legalApi } from '../../api/legalApi';
import { toAppError } from '../../utils/errors';
import { formatDate } from '../../utils/format';
import type { LegalDocumentType } from '../../types/legal';
import { useT } from '../../i18n/useT';

export interface LegalDocumentViewProps {
  type: LegalDocumentType;
  // Shown when the operator has not published this document yet.
  emptyDescription?: string;
}

// Renders whichever version of a legal document the backend currently
// publishes. Nothing is hardcoded in the app: if nothing is published, it says
// so rather than showing text that was never reviewed.
export const LegalDocumentView: React.FC<LegalDocumentViewProps> = ({
  type,
  emptyDescription,
}) => {
  const { t } = useT();
  const documentQuery = useQuery({
    queryKey: ['legal', 'document', type],
    queryFn: () => legalApi.getByType(type),
    retry: false,
  });

  if (documentQuery.isPending) {
    return (
      <View className="gap-3 px-5 pt-4">
        <GenieSkeleton className="h-5 w-2/5" />
        <GenieSkeleton className="h-3 w-full" />
        <GenieSkeleton className="h-3 w-full" />
        <GenieSkeleton className="h-3 w-3/4" />
      </View>
    );
  }

  if (documentQuery.isError) {
    const error = toAppError(documentQuery.error);

    if (error.status === 404) {
      return (
        <GenieEmptyState
          title={t('common:legal.notPublished')}
          description={
            emptyDescription ??
            t('common:legal.notPublishedHint')
          }
        />
      );
    }

    return (
      <View className="px-5 pt-4">
        <GenieErrorState message={error.message} onRetry={() => documentQuery.refetch()} />
      </View>
    );
  }

  const document = documentQuery.data;

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="px-5 pb-10 pt-3"
      showsVerticalScrollIndicator={false}
    >
      <GenieText variant="heading-sm">{document.title}</GenieText>
      <GenieText variant="caption" tone="muted" className="mt-1">
        {t('common:legal.versionLine', {
          version: document.version,
          date: formatDate(document.effectiveDate),
        })}
      </GenieText>

      {!document.legallyReviewed ? (
        <GenieNotice
          tone="warning"
          message={t('common:legal.draftNotice')}
          className="mt-3"
        />
      ) : null}

      <GenieText variant="body-sm" tone="secondary" className="mt-4 leading-5">
        {document.content}
      </GenieText>
    </ScrollView>
  );
};
