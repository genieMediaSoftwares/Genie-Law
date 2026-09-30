import React, { useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';

import { chatApi } from '../../../api/chatApi';
import {
  GenieAvatar,
  GenieCard,
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieSearchInput,
  GenieSkeletonList,
  GenieText,
  GenieRefreshControl,
} from '../../../components';
import { ChatIcon } from '../../../components/icons/ClientIcons';
import { useAuthStore } from '../../../store/authStore';
import { useUiStore } from '../../../store/uiStore';
import type { ChatConversation } from '../../../types/domain';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { formatRelative } from '../../../utils/format';
import { colors } from '../../../theme';
import { useT } from '../../../i18n/useT';
import { practiceAreaLabel } from '../../../i18n/labels';

export const MessagesScreen: React.FC<ClientStackScreenProps<'Messages'>> = ({
  navigation,
}) => {
  const { t } = useT();
  const currentUser = useAuthStore(state => state.user);
  const openDrawer = useUiStore(state => state.openDrawer);
  const [search, setSearch] = useState('');

  const chatsQuery = useQuery({
    queryKey: ['chats'],
    queryFn: chatApi.getChats,
  });

  const chats = chatsQuery.data || [];

  const filteredChats = chats.filter(chat => {
    if (!search.trim()) {
      return true;
    }
    const otherParticipant = chat.participants.find(
      p => p._id !== currentUser?.id,
    );
    const name = otherParticipant?.fullName || '';
    const lastMsg = chat.lastMessage || '';
    return (
      name.toLowerCase().includes(search.toLowerCase()) ||
      lastMsg.toLowerCase().includes(search.toLowerCase())
    );
  });

  const renderItem = ({ item }: { item: ChatConversation }) => {
    const otherParticipant =
      item.participants.find(p => p._id !== currentUser?.id) ||
      item.participants[0];

    const name = otherParticipant?.fullName || t('client:messages.advocate');
    const avatar = otherParticipant?.profileImage;
    const spec = otherParticipant?.specialization;
    const timeText = item.lastMessageAt
      ? formatRelative(item.lastMessageAt)
      : '';
    const unread = item.unreadCount ?? 0;

    return (
      <GenieCard
        tone="surface"
        className="mb-2 flex-row items-center"
        accessibilityLabel={t('client:messages.conversationWith', { name })}
        onPress={() =>
          navigation.navigate('Chat', {
            chatId: item._id,
            name: t('common:advocate.advName', { name }),
            avatar,
          })
        }
      >
        <GenieAvatar
          uri={avatar}
          name={name}
          size="md"
          ring={Boolean(otherParticipant?.isVerified)}
        />

        <View className="ml-3 mr-1 flex-1">
          <View className="flex-row items-center justify-between">
            <GenieText variant="body-lg" className="flex-1 font-bold" numberOfLines={1}>
              {t('common:advocate.advName', { name })}
            </GenieText>
            {timeText ? (
              <GenieText variant="caption" tone="muted" className="ml-2">
                {timeText}
              </GenieText>
            ) : null}
          </View>

          {spec ? (
            <GenieText
              variant="caption"
              tone="gold"
              className="mt-0.5 font-medium"
              numberOfLines={1}
            >
              {practiceAreaLabel(spec)}
            </GenieText>
          ) : null}

          <GenieText
            variant="body-sm"
            tone="secondary"
            className="mt-1"
            numberOfLines={1}
          >
            {item.lastMessage || t('client:messages.noMessagesYet')}
          </GenieText>
        </View>

        {unread > 0 ? (
          <View className="h-5 min-w-5 items-center justify-center rounded-pill bg-gold px-1.5">
            <GenieText variant="caption" tone="on-gold" className="font-bold">
              {unread > 99 ? '99+' : String(unread)}
            </GenieText>
          </View>
        ) : null}
      </GenieCard>
    );
  };

  const renderBody = () => {
    if (chatsQuery.isLoading) {
      return (
        <View className="px-4">
          <GenieSkeletonList count={5} />
        </View>
      );
    }

    if (chatsQuery.isError) {
      return (
        <View className="px-4">
          <GenieErrorState
            title={t('client:messages.loadFailed')}
            message={t('client:messages.checkConnection')}
            onRetry={() => chatsQuery.refetch()}
          />
        </View>
      );
    }

    if (filteredChats.length === 0) {
      return (
        <GenieEmptyState
          icon={<ChatIcon size={28} color={colors.gold} />}
          title={t('client:messages.emptyTitle')}
          description={
            search.trim()
              ? t('client:messages.noMatches', { search })
              : t('client:messages.emptyHint')
          }
          actionLabel={search.trim() ? t('client:messages.clearSearch') : undefined}
          onAction={search.trim() ? () => setSearch('') : undefined}
        />
      );
    }

    return (
      <FlatList
        data={filteredChats}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerClassName="px-4 pb-6"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <GenieRefreshControl onRefresh={() => chatsQuery.refetch()} />
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <GenieHeader
        title={t('client:messages.title')}
        onMenu={openDrawer}
        onBack={() => navigation.goBack()}
      />

      <View className="px-4 pb-3 pt-2">
        <GenieSearchInput
          placeholder={t('client:messages.searchPlaceholder')}
          value={search}
          onChangeText={setSearch}
          onClear={() => setSearch('')}
        />
      </View>

      {renderBody()}
    </SafeAreaView>
  );
};
