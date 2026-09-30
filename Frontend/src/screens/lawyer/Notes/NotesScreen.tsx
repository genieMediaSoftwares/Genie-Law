import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  GenieButton,
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieIconButton,
  GenieModal,
  GenieNotice,
  GenieSearchInput,
  GenieSkeletonList,
  GenieText,
  GenieRefreshControl,
} from '../../../components';
import {
  ClockIcon,
  FileIcon,
  PlusIcon,
} from '../../../components/icons/ClientIcons';
import { UsersIcon } from '../../../components/icons/LawyerIcons';
import { lawyerApi } from '../../../api/lawyerApi';
import { toAppError } from '../../../utils/errors';
import { formatRelative } from '../../../utils/format';
import type {
  LawyerClientRow,
  LawyerNote,
  LawyerNoteRow,
} from '../../../types/lawyer';
import type { LawyerStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';

interface DraftState {
  clientId: string;
  noteId?: string;
  title: string;
  text: string;
  caseId: string | null;
}

const emptyDraft = (clientId: string): DraftState => ({
  clientId,
  title: '',
  text: '',
  caseId: null,
});

export const NotesScreen: React.FC<LawyerStackScreenProps<'Notes'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  // Notes are loaded for one client at a time: the backend has no endpoint
  // for all of a lawyer's notes, and one request per client would not scale.
  const [pickedClientId, setPickedClientId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LawyerNoteRow | null>(null);
  const [isPickingClient, setIsPickingClient] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const clientsQuery = useQuery({
    queryKey: ['lawyer', 'clients'],
    queryFn: lawyerApi.getClients,
  });

  const clients = useMemo<LawyerClientRow[]>(() => {
    const groups = clientsQuery.data;
    if (!groups) {
      return [];
    }
    const all = [...groups.accepted, ...groups.inProgress, ...groups.closed];
    const seen = new Set<string>();
    return all.filter(row => {
      if (!row.clientId || seen.has(row.clientId)) {
        return false;
      }
      seen.add(row.clientId);
      return true;
    });
  }, [clientsQuery.data]);

  const cases = useMemo(() => {
    const groups = clientsQuery.data;
    if (!groups) {
      return [];
    }
    return [...groups.accepted, ...groups.inProgress, ...groups.closed];
  }, [clientsQuery.data]);

  const activeClient =
    clients.find(client => client.clientId === pickedClientId) ?? clients[0] ?? null;
  const activeClientId = activeClient?.clientId ?? null;

  const notesQuery = useQuery({
    queryKey: ['lawyer', 'notes', activeClientId],
    queryFn: () => lawyerApi.getClientNotes(activeClientId as string),
    enabled: Boolean(activeClientId),
  });

  const isLoading =
    clientsQuery.isPending || (Boolean(activeClientId) && notesQuery.isPending);

  const loadError = (clientsQuery.error ?? notesQuery.error) as Error | null;

  const notes = useMemo<LawyerNoteRow[]>(() => {
    if (!activeClient || !notesQuery.data) {
      return [];
    }
    return notesQuery.data
      .map(note => ({
        ...note,
        clientId: activeClient.clientId,
        clientName: activeClient.name,
      }))
      .sort(
        (x, y) =>
          new Date(y.updatedAt || y.date).getTime() -
          new Date(x.updatedAt || x.date).getTime(),
      );
  }, [activeClient, notesQuery.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      return notes;
    }
    return notes.filter(
      note =>
        note.title.toLowerCase().includes(q) ||
        note.text.toLowerCase().includes(q) ||
        note.clientName.toLowerCase().includes(q),
    );
  }, [notes, search]);

  const refreshNotes = async (clientId: string) => {
    await queryClient.invalidateQueries({
      queryKey: ['lawyer', 'notes', clientId],
    });
  };

  const saveMutation = useMutation({
    mutationFn: async (value: DraftState): Promise<LawyerNote> => {
      const payload = {
        title: value.title.trim(),
        text: value.text.trim(),
        caseId: value.caseId ?? null,
      };

      return value.noteId
        ? lawyerApi.updateClientNote(value.clientId, value.noteId, payload)
        : lawyerApi.addClientNote(value.clientId, payload);
    },
    onSuccess: async (_created, value) => {
      setDraft(null);
      setFormError(null);
      setPickedClientId(value.clientId);
      await refreshNotes(value.clientId);
    },
    onError: error => setFormError(toAppError(error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (note: LawyerNoteRow) =>
      lawyerApi.deleteClientNote(note.clientId, note._id),
    onSuccess: async (_void, note) => {
      setPendingDelete(null);
      await refreshNotes(note.clientId);
    },
    onError: error => {
      setPendingDelete(null);
      setActionError(toAppError(error).message);
    },
  });

  const casesForDraft = draft
    ? cases.filter(row => row.clientId === draft.clientId)
    : [];

  const renderBody = () => {
    if (isLoading) {
      return <GenieSkeletonList count={3} />;
    }

    if (loadError && notes.length === 0) {
      return (
        <GenieErrorState
          message={loadError.message}
          onRetry={() => {
            void clientsQuery.refetch();
            void notesQuery.refetch();
          }}
        />
      );
    }

    if (filtered.length === 0) {
      return (
        <GenieEmptyState
          icon={<FileIcon size={28} color={colors.gold} />}
          title={search.trim() ? t('lawyer:notes.noMatches') : t('lawyer:notes.none')}
          description={
            search.trim()
              ? t('lawyer:notes.nothingMatches', { search })
              : clients.length === 0
              ? t('lawyer:notes.noClientsHint')
              : t('lawyer:notes.privateHint')
          }
          actionLabel={
            search.trim()
              ? t('lawyer:notes.clearSearch')
              : clients.length > 0
              ? t('lawyer:notes.newNote')
              : undefined
          }
          onAction={
            search.trim()
              ? () => setSearch('')
              : clients.length > 0
              ? () => setIsPickingClient(true)
              : undefined
          }
        />
      );
    }

    return filtered.map(note => {
      const relatedCase = cases.find(row => row.caseId === note.case);

      return (
        <Pressable
          key={`${note.clientId}-${note._id}`}
          onPress={() => {
            setFormError(null);
            setDraft({
              clientId: note.clientId,
              noteId: note._id,
              title: note.title ?? '',
              text: note.text ?? '',
              caseId: note.case ?? null,
            });
          }}
          accessibilityRole="button"
          accessibilityLabel={note.title || t('lawyer:notes.untitled')}
          className="mb-3 rounded-card border border-border bg-card p-4 active:opacity-90"
        >
          <View className="flex-row items-start justify-between">
            <GenieText
              variant="heading-sm"
              className="flex-1 pr-2"
              numberOfLines={1}
            >
              {note.title || t('lawyer:notes.untitled')}
            </GenieText>

            <Pressable
              onPress={() => {
                setActionError(null);
                setPendingDelete(note);
              }}
              accessibilityRole="button"
              accessibilityLabel={t('lawyer:notes.deleteA11y', {
                title: note.title || t('lawyer:notes.untitledShort'),
              })}
              className="min-h-touch min-w-touch items-center justify-center active:opacity-70"
            >
              <GenieText variant="body-sm" tone="error">
                {t('lawyer:notes.delete')}
              </GenieText>
            </Pressable>
          </View>

          <GenieText
            variant="body-sm"
            tone="secondary"
            numberOfLines={3}
            className="mt-1 leading-5"
          >
            {note.text}
          </GenieText>

          <View className="mt-3 flex-row flex-wrap items-center gap-x-3 gap-y-1.5">
            <View className="flex-row items-center gap-1.5">
              <UsersIcon size={12} color={colors.textMuted} />
              <GenieText variant="caption" tone="muted">
                {note.clientName}
              </GenieText>
            </View>

            {relatedCase ? (
              <View className="flex-row items-center gap-1.5">
                <FileIcon size={12} color={colors.gold} />
                <GenieText variant="caption" tone="gold" numberOfLines={1}>
                  {relatedCase.issue}
                </GenieText>
              </View>
            ) : null}

            <View className="flex-row items-center gap-1.5">
              <ClockIcon size={12} color={colors.textMuted} />
              <GenieText variant="caption" tone="muted">
                {formatRelative(note.updatedAt || note.date)}
              </GenieText>
            </View>
          </View>
        </Pressable>
      );
    });
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={t('lawyer:notes.title')}
        onBack={() => navigation.goBack()}
        right={
          <GenieIconButton
            icon={<PlusIcon size={22} color={colors.gold} />}
            accessibilityLabel={t('lawyer:notes.newA11y')}
            onPress={() => {
              setFormError(null);
              setIsPickingClient(true);
            }}
          />
        }
      />

      <View className="px-4 pb-3 pt-1">
        <GenieSearchInput
          placeholder={t('lawyer:notes.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
        />
      </View>

      {clients.length > 1 ? (
        <FlatList
          horizontal
          data={clients}
          keyExtractor={client => client.clientId}
          showsHorizontalScrollIndicator={false}
          className="max-h-14 grow-0"
          contentContainerClassName="gap-2 px-4 pb-3"
          initialNumToRender={8}
          renderItem={({ item: client }) => {
            const active = client.clientId === activeClientId;
            return (
              <Pressable
                onPress={() => setPickedClientId(client.clientId)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={client.name}
                className={`min-h-touch justify-center rounded-pill border px-4 ${
                  active ? 'border-border bg-gold' : 'border-border bg-surface active:opacity-80'
                }`}
              >
                <GenieText variant="body-sm" tone={active ? 'on-gold' : 'secondary'} numberOfLines={1}>
                  {client.name}
                </GenieText>
              </Pressable>
            );
          }}
        />
      ) : null}

      {actionError ? (
        <View className="px-4 pb-2">
          <GenieNotice tone="error" message={actionError} />
        </View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pb-8"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <GenieRefreshControl onRefresh={() => Promise.all([clientsQuery.refetch(), notesQuery.refetch()])} />
        }
      >
        {renderBody()}
      </ScrollView>

      <GenieModal
        visible={isPickingClient}
        onClose={() => setIsPickingClient(false)}
        title={t('lawyer:notes.whoseFile')}
      >
        {clients.length === 0 ? (
          <GenieText variant="body-md" tone="secondary">
            {t('lawyer:notes.noMatters')}
          </GenieText>
        ) : (
          <ScrollView className="max-h-80" showsVerticalScrollIndicator={false}>
            {clients.map(client => (
              <Pressable
                key={client.clientId}
                onPress={() => {
                  setIsPickingClient(false);
                  setDraft(emptyDraft(client.clientId));
                }}
                accessibilityRole="button"
                accessibilityLabel={client.name}
                className="mb-2 min-h-touch justify-center rounded-control border border-border bg-card px-4 py-3 active:opacity-80"
              >
                <GenieText variant="body-md">{client.name}</GenieText>
              </Pressable>
            ))}
          </ScrollView>
        )}
      </GenieModal>

      <GenieModal
        visible={Boolean(draft)}
        onClose={() => {
          if (!saveMutation.isPending) {
            setDraft(null);
          }
        }}
        dismissOnBackdropPress={!saveMutation.isPending}
        title={draft?.noteId ? t('lawyer:notes.editNote') : t('lawyer:notes.newNote')}
      >
        {draft ? (
          <ScrollView
            className="max-h-[400px]"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <GenieText variant="body-sm" className="mb-2 font-medium">
              {t('lawyer:notes.titleLabel')}
            </GenieText>
            <TextInput
              value={draft.title}
              onChangeText={value =>
                setDraft(current => (current ? { ...current, title: value } : current))
              }
              placeholder={t('lawyer:notes.optional')}
              placeholderTextColor={colors.textMuted}
              editable={!saveMutation.isPending}
              maxLength={200}
              className="min-h-control rounded-control border border-border bg-card px-4 py-3 text-body-lg text-white"
              accessibilityLabel={t('lawyer:notes.titleA11y')}
            />

            <GenieText variant="body-sm" className="mb-2 mt-4 font-medium">
              {t('lawyer:notes.note')}
              <GenieText variant="body-sm" tone="error">
                {' *'}
              </GenieText>
            </GenieText>
            <TextInput
              value={draft.text}
              onChangeText={value =>
                setDraft(current => (current ? { ...current, text: value } : current))
              }
              placeholder={t('lawyer:notes.notePlaceholder')}
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              editable={!saveMutation.isPending}
              className="min-h-[140px] rounded-control border border-border bg-card px-4 py-3 text-body-lg text-white"
              accessibilityLabel={t('lawyer:notes.noteA11y')}
            />

            {casesForDraft.length > 0 ? (
              <>
                <GenieText variant="body-sm" className="mb-2 mt-4 font-medium">
                  {t('lawyer:notes.fileAgainst')}
                </GenieText>

                <Pressable
                  onPress={() =>
                    setDraft(current =>
                      current ? { ...current, caseId: null } : current,
                    )
                  }
                  accessibilityRole="button"
                  accessibilityState={{ selected: draft.caseId === null }}
                  className={`mb-2 min-h-touch justify-center rounded-control border px-4 py-3 active:opacity-80 ${
                    draft.caseId === null
                      ? 'border-border bg-gold-muted'
                      : 'border-border bg-card'
                  }`}
                >
                  <GenieText
                    variant="body-sm"
                    tone={draft.caseId === null ? 'gold' : 'secondary'}
                  >
                    {t('lawyer:notes.general')}
                  </GenieText>
                </Pressable>

                {casesForDraft.map(row => {
                  const active = draft.caseId === row.caseId;
                  return (
                    <Pressable
                      key={row.caseId}
                      onPress={() =>
                        setDraft(current =>
                          current ? { ...current, caseId: row.caseId } : current,
                        )
                      }
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={`mb-2 min-h-touch justify-center rounded-control border px-4 py-3 active:opacity-80 ${
                        active
                          ? 'border-border bg-gold-muted'
                          : 'border-border bg-card'
                      }`}
                    >
                      <GenieText
                        variant="body-sm"
                        tone={active ? 'gold' : 'secondary'}
                        numberOfLines={1}
                      >
                        {row.issue}
                      </GenieText>
                    </Pressable>
                  );
                })}
              </>
            ) : null}

            {formError ? (
              <GenieNotice tone="error" message={formError} className="mt-3" />
            ) : null}
          </ScrollView>
        ) : null}

        <View className="mt-4 flex-row gap-3">
          <GenieButton
            label={t('lawyer:notes.cancel')}
            variant="outline"
            disabled={saveMutation.isPending}
            onPress={() => setDraft(null)}
            className="flex-1"
          />
          <GenieButton
            label={saveMutation.isPending ? t('lawyer:notes.saving') : t('lawyer:notes.save')}
            loading={saveMutation.isPending}
            disabled={!draft?.text.trim()}
            onPress={() => {
              if (draft) {
                setFormError(null);
                saveMutation.mutate(draft);
              }
            }}
            className="flex-1"
          />
        </View>
      </GenieModal>

      <GenieModal
        visible={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        title={t('lawyer:notes.deleteTitle')}
      >
        <GenieText variant="body-md" tone="secondary">
          {pendingDelete
            ? t('lawyer:notes.deleteMessage', {
                title: pendingDelete.title || t('lawyer:notes.untitled'),
              })
            : ''}
        </GenieText>

        <View className="mt-5 flex-row gap-3">
          <GenieButton
            label={t('lawyer:notes.keep')}
            variant="outline"
            onPress={() => setPendingDelete(null)}
            className="flex-1"
          />
          <GenieButton
            label={t('lawyer:notes.delete')}
            variant="danger"
            loading={deleteMutation.isPending}
            onPress={() => {
              if (pendingDelete) {
                deleteMutation.mutate(pendingDelete);
              }
            }}
            className="flex-1"
          />
        </View>
      </GenieModal>
    </SafeAreaView>
  );
};
