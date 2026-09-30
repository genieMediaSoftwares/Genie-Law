import React, { useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { GenieButton, GenieNotice, GenieText } from '../ui';
import { legalApi } from '../../api/legalApi';
import { toAppError } from '../../utils/errors';
import { formatDate } from '../../utils/format';
import { useT } from '../../i18n/useT';

// Asks the signed-in user to accept any published document that requires it
// and that they have not accepted at its current version. Shows nothing at all
// when there is nothing pending, which is the normal case.
export const LegalAcceptanceGate: React.FC = () => {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const pendingQuery = useQuery({
    queryKey: ['legal', 'pending'],
    queryFn: legalApi.listPending,
    // A missing/unreachable legal service must never lock people out of the app.
    retry: false,
  });

  const accept = useMutation({
    mutationFn: async () => {
      for (const document of pendingQuery.data ?? []) {
        await legalApi.accept(document.type, document.version);
      }
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['legal', 'pending'] });
    },
    onError: mutationError => setError(toAppError(mutationError).message),
  });

  const pending = pendingQuery.data ?? [];

  if (pendingQuery.isPending || pendingQuery.isError || pending.length === 0) {
    return null;
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View className="flex-1 bg-overlay">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1 justify-end">
          <View className="max-h-[80%] rounded-t-sheet border-t border-border bg-surface px-4 pb-5 pt-4">
            <GenieText variant="heading-sm">
              {pending.length === 1 ? t('common:legal.reviewOne') : t('common:legal.reviewMany')}
            </GenieText>
            <GenieText variant="body-sm" tone="secondary" className="mt-1">
              {t('common:legal.acceptToContinue')}
            </GenieText>

            <ScrollView
              className="mt-4"
              contentContainerClassName="pb-2"
              showsVerticalScrollIndicator={false}
            >
              {pending.map(document => (
                <View
                  key={document._id}
                  className="mb-3 rounded-card border border-border bg-card p-4"
                >
                  <GenieText variant="body" className="font-semibold">
                    {document.title}
                  </GenieText>
                  <GenieText variant="caption" tone="muted" className="mt-0.5">
                    {t('common:legal.versionLine', {
                      version: document.version,
                      date: formatDate(document.effectiveDate),
                    })}
                  </GenieText>
                  <GenieText
                    variant="body-sm"
                    tone="secondary"
                    className="mt-2 leading-5"
                    numberOfLines={12}
                  >
                    {document.content}
                  </GenieText>
                </View>
              ))}
            </ScrollView>

            {error ? <GenieNotice tone="error" message={error} className="mb-3" /> : null}

            <GenieButton
              label={pending.length === 1 ? t('common:legal.acceptOne') : t('common:legal.acceptMany')}
              loadingLabel={t('common:legal.saving')}
              loading={accept.isPending}
              onPress={() => accept.mutate()}
            />
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};
