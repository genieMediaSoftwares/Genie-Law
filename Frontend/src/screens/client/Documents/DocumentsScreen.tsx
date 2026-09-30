import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Share, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { documentsApi } from '../../../api/documentsApi';
import {
  DocumentActionSheet,
  DocumentCard,
  DocumentEmptyState,
  DocumentErrorState,
  DocumentFilterChips,
  DocumentSkeleton,
  DocumentViewerModal,
  DeleteDocumentModal,
  GenieHeader,
  GenieIconButton,
  GenieSearchInput,
  RenameDocumentModal,
  UploadDocumentModal,
  getDocumentBadgeInfo,
  GenieRefreshControl,
} from '../../../components';
import { PlusIcon } from '../../../components/icons/ClientIcons';
import { filePicker } from '../../../services/filePicker';
import { rejectOversizedDocuments } from '../../../services/documentSizeGuard';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useUiStore } from '../../../store/uiStore';
import type { DocumentFilterType } from '../../../components';
import type { PickedFile } from '../../../types/ai';
import type { AppDocument } from '../../../types/domain';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { Platform } from 'react-native';
import { useT } from '../../../i18n/useT';
import i18n from '../../../i18n';
import { logError } from '../../../utils/log';
import { toAppError } from '../../../utils/errors';
import { openDocumentOnDevice } from '../../../services/documentOpener';

// window.alert on web; React Native installs the same global on a device.
const showAlert = (message: string): void => {
  const globalAlert = (globalThis as { alert?: (text: string) => void }).alert;
  if (typeof globalAlert === 'function') {
    globalAlert(message);
  }
};

const appendAcknowledgementFile = (form: FormData, file: PickedFile): void => {
  if (Platform.OS === 'web' && file.file) {
    (form.append as (name: string, value: Blob, fileName?: string) => void)(
      'acknowledgement',
      file.file as Blob,
      file.name,
    );
    return;
  }

  form.append('acknowledgement', {
    uri: file.uri,
    name: file.name,
    type: file.type || 'application/octet-stream',
  } as unknown as Blob);
};

export const DocumentsScreen: React.FC<ClientStackScreenProps<'Documents'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const openDrawer = useUiStore(state => state.openDrawer);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<DocumentFilterType>('All');

  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [actionDocument, setActionDocument] = useState<AppDocument | null>(null);
  const [viewerDocument, setViewerDocument] = useState<AppDocument | null>(null);
  const [renameDocument, setRenameDocument] = useState<AppDocument | null>(null);
  const [deleteDocument, setDeleteDocument] = useState<AppDocument | null>(null);

  const debouncedSearch = useDebouncedValue(search, 300);

  const documentsQuery = useQuery({
    queryKey: ['documents'],
    queryFn: () => documentsApi.getDocuments(),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: PickedFile) => {
      const formData = new FormData();
      appendAcknowledgementFile(formData, file);
      return documentsApi.uploadDocument(formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const replaceMutation = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: PickedFile }) => {
      const formData = new FormData();
      appendAcknowledgementFile(formData, file);
      return documentsApi.replaceDocument(id, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return documentsApi.renameDocument(id, name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return documentsApi.deleteDocument(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
  });

  const allDocuments = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);

  const filteredDocuments = useMemo(() => {
    return allDocuments.filter(doc => {
      const badge = getDocumentBadgeInfo(doc);

      if (selectedFilter === 'PDF' && badge.category !== 'pdf') return false;
      if (selectedFilter === 'DOCX' && badge.category !== 'docx') return false;
      if (selectedFilter === 'Images' && badge.category !== 'image') return false;
      if (selectedFilter === 'TXT' && badge.category !== 'text') return false;

      if (debouncedSearch.trim()) {
        const query = debouncedSearch.trim().toLowerCase();
        const docName = (doc.name || doc.originalName || '').toLowerCase();
        return docName.includes(query);
      }

      return true;
    });
  }, [allDocuments, selectedFilter, debouncedSearch]);

  const handleDownload = useCallback(async (doc: AppDocument) => {
    try {
      // A phone has no downloads folder to drop a blob into: the file is
      // fetched to the app cache and handed to the device (Open with / Save).
      if (Platform.OS !== 'web') {
        await openDocumentOnDevice({
          url: documentsApi.getDownloadUrl(doc._id),
          fileName: doc.name || doc.originalName || 'document',
          mimeType: doc.mimeType || '',
        });
        return;
      }
      const { blob, filename } = await documentsApi.fetchDownloadBlob(doc._id);
      const downloadName = filename || doc.name || doc.originalName || 'document';

      const globalWin = (globalThis as any).window;
      const globalDoc = (globalThis as any).document;

      if (globalWin && globalDoc && globalWin.URL) {
        const url = globalWin.URL.createObjectURL(blob);
        const a = globalDoc.createElement('a');
        a.href = url;
        a.download = downloadName;
        globalDoc.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => globalWin.URL.revokeObjectURL(url), 1000);
      }
    } catch (err: any) {
      logError('document-download', err);
      const status = err?.response?.status;
      showAlert(
        status === 403 || status === 401
          ? i18n.t('documents:screen.noPermission')
          : toAppError(err).message || i18n.t('documents:screen.downloadFailed'),
      );
    }
  }, []);

  const handleShare = useCallback(async (doc: AppDocument) => {
    const viewUrl = documentsApi.getViewUrl(doc._id);
    try {
      await Share.share({
        title: doc.name || doc.originalName,
        url: viewUrl,
        message: i18n.t('documents:screen.shareMessage', {
          name: doc.name || doc.originalName,
          url: viewUrl,
        }),
      });
    } catch (err) {
      logError('document-share', err);
    }
  }, []);

  const handleReplacePick = useCallback(
    async (doc: AppDocument) => {
      try {
        const { accepted: files } = await rejectOversizedDocuments(
          await filePicker.pickDocuments(1),
        );
        if (files.length > 0) {
          await replaceMutation.mutateAsync({ id: doc._id, file: files[0] });
        }
      } catch (err) {
        logError('document-replace', err);
        showAlert(toAppError(err).message);
      }
    },
    [replaceMutation],
  );

  const renderItem = useCallback(
    ({ item }: { item: AppDocument }) => (
      <DocumentCard
        document={item}
        onPress={setViewerDocument}
        onPressMenu={setActionDocument}
      />
    ),
    [],
  );

  const renderBody = () => {
    if (documentsQuery.isPending) {
      return <DocumentSkeleton count={6} />;
    }

    if (documentsQuery.isError) {
      return (
        <DocumentErrorState
          message={documentsQuery.error.message}
          onRetry={() => documentsQuery.refetch()}
        />
      );
    }

    if (allDocuments.length === 0) {
      return (
        <DocumentEmptyState
          onUpload={() => setIsUploadOpen(true)}
        />
      );
    }

    if (filteredDocuments.length === 0) {
      return (
        <DocumentEmptyState
          isFiltered
          onUpload={() => setIsUploadOpen(true)}
        />
      );
    }

    return (
      <FlatList
        data={filteredDocuments}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerClassName="px-4 pb-10"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <GenieRefreshControl onRefresh={() => documentsQuery.refetch()} />
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={t('documents:screen.title')}
        onMenu={openDrawer}
        onBack={() => navigation.goBack()}
        right={
          <GenieIconButton
            icon={<PlusIcon size={20} color={colors.onGold} />}
            onPress={() => setIsUploadOpen(true)}
            accessibilityLabel={t('documents:screen.uploadA11y')}
            className="h-9 w-9 rounded-full bg-gold items-center justify-center border-0 active:bg-gold-bright"
          />
        }
      />

      <View className="px-4 pt-2 pb-1">
        <GenieSearchInput
          placeholder={t('documents:screen.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
        />
      </View>

      <DocumentFilterChips
        selectedFilter={selectedFilter}
        onSelectFilter={setSelectedFilter}
      />

      <View className="flex-1">{renderBody()}</View>

      <UploadDocumentModal
        visible={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={async file => {
          await uploadMutation.mutateAsync(file);
        }}
      />

      <DocumentActionSheet
        visible={Boolean(actionDocument)}
        document={actionDocument}
        onClose={() => setActionDocument(null)}
        onView={doc => setViewerDocument(doc)}
        onRename={doc => setRenameDocument(doc)}
        onReplace={doc => void handleReplacePick(doc)}
        onDownload={doc => handleDownload(doc)}
        onShare={doc => void handleShare(doc)}
        onDelete={doc => setDeleteDocument(doc)}
      />

      <DocumentViewerModal
        visible={Boolean(viewerDocument)}
        document={viewerDocument}
        onClose={() => setViewerDocument(null)}
        onDownload={doc => handleDownload(doc)}
      />

      <RenameDocumentModal
        visible={Boolean(renameDocument)}
        document={renameDocument}
        onClose={() => setRenameDocument(null)}
        onSave={async (doc, newName) => {
          await renameMutation.mutateAsync({ id: doc._id, name: newName });
        }}
      />

      <DeleteDocumentModal
        visible={Boolean(deleteDocument)}
        document={deleteDocument}
        onClose={() => setDeleteDocument(null)}
        onConfirmDelete={async doc => {
          await deleteMutation.mutateAsync(doc._id);
        }}
      />
    </SafeAreaView>
  );
};
