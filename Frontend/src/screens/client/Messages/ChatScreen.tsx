import React, { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { chatApi } from '../../../api/chatApi';
import {
  GenieAvatar,
  GenieEmptyState,
  GenieErrorState,
  GenieHeader,
  GenieInput,
  GenieSkeletonList,
  GenieText,
  ProfileImageViewer,
} from '../../../components';
import { PaperclipIcon, SendIcon } from '../../../components/icons/ClientIcons';
import { useAuthStore } from '../../../store/authStore';
import type { ChatMessage } from '../../../types/domain';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { formatDateTime } from '../../../utils/format';
import { colors } from '../../../theme';
import { useFallbackPoll } from '../../../hooks/useScreenFocused';
import { useT } from '../../../i18n/useT';

export const ChatScreen: React.FC<ClientStackScreenProps<'Chat'>> = ({
  navigation,
  route,
}) => {
  const { t } = useT();
  const { chatId, name, avatar } = route.params;
  const currentUser = useAuthStore(state => state.user);
  const queryClient = useQueryClient();

  const [messageText, setMessageText] = useState('');
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  // Pushed over Socket.IO; polled (while visible) only if the socket is down.
  const pollChat = useFallbackPoll('chat');

  const messagesQuery = useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => chatApi.getMessages(chatId),
    refetchInterval: pollChat(5000),
  });

  const markReadMutation = useMutation({
    mutationFn: () => chatApi.markAsRead(chatId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const markRead = useRef(markReadMutation.mutate);
  markRead.current = markReadMutation.mutate;

  useEffect(() => {
    markRead.current();
  }, [chatId]);

  const sendMutation = useMutation({
    mutationFn: (text: string) => chatApi.sendMessage(chatId, text),
    onSuccess: () => {
      setMessageText('');
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
      queryClient.invalidateQueries({ queryKey: ['chats'] });
    },
  });

  const handleSend = () => {
    const text = messageText.trim();
    if (!text || sendMutation.isPending) {
      return;
    }
    sendMutation.mutate(text);
  };

  const messages = messagesQuery.data || [];
  const canSend = Boolean(messageText.trim()) && !sendMutation.isPending;

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const senderId =
      typeof item.sender === 'string' ? item.sender : item.sender?._id;
    const isMe = senderId === currentUser?.id;

    return (
      <View className={`mb-3 flex-row ${isMe ? 'justify-end' : 'justify-start'}`}>
        <View
          className={[
            'max-w-[80%] rounded-card px-3 py-2',
            isMe
              ? 'rounded-br-sm bg-gold'
              : 'rounded-bl-sm bg-surface-alt',
          ].join(' ')}
        >
          <GenieText variant="body-lg" tone={isMe ? 'on-gold' : 'primary'}>
            {item.content}
          </GenieText>

          {item.attachments && item.attachments.length > 0 ? (
            <View
              className={`mt-1 border-t pt-1 ${
                isMe ? 'border-border' : 'border-border'
              }`}
            >
              {item.attachments.map((att, idx) => (
                <View key={idx} className="flex-row items-center">
                  <PaperclipIcon
                    size={13}
                    color={isMe ? colors.onGold : colors.textSecondary}
                  />
                  <GenieText
                    variant="caption"
                    tone={isMe ? 'on-gold' : 'secondary'}
                    className="ml-1 flex-1 font-medium"
                    numberOfLines={1}
                  >
                    {att.name}
                  </GenieText>
                </View>
              ))}
            </View>
          ) : null}

          <GenieText
            variant="caption"
            tone={isMe ? 'on-gold' : 'muted'}
            className="mt-1 self-end text-small-label"
          >
            {formatDateTime(item.createdAt)}
          </GenieText>
        </View>
      </View>
    );
  };

  const renderBody = () => {
    if (messagesQuery.isLoading) {
      return (
        <View className="px-4 py-4">
          <GenieSkeletonList count={4} />
        </View>
      );
    }

    if (messagesQuery.isError) {
      return (
        <View className="px-4 py-4">
          <GenieErrorState
            title={t('client:messages.chat.loadFailed')}
            message={t('client:messages.checkConnection')}
            onRetry={() => messagesQuery.refetch()}
          />
        </View>
      );
    }

    if (messages.length === 0) {
      return (
        <GenieEmptyState
          title={t('client:messages.chat.empty')}
          description={t('client:messages.chat.startWith', {
            name: name || t('client:messages.chat.yourAdvocate'),
          })}
        />
      );
    }

    return (
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item._id}
        renderItem={renderMessageItem}
        contentContainerClassName="px-4 py-4"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
      />
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <GenieHeader
        title={name || t('client:messages.chat.conversation')}
        onBack={() => navigation.goBack()}
        right={
          avatar ? (
            <Pressable
              onPress={() => setIsPhotoOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={t('client:messages.chat.viewPhotoA11y', {
                name: name || t('client:messages.chat.contact'),
              })}
            >
              <GenieAvatar uri={avatar} name={name || t('client:messages.advocate')} size="xs" />
            </Pressable>
          ) : null
        }
      />

      <ProfileImageViewer
        visible={isPhotoOpen}
        onClose={() => setIsPhotoOpen(false)}
        imageUri={avatar}
        name={name}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderBody()}

        <View className="flex-row items-center bg-surface px-4 py-2">
          <View className="mr-2 flex-1">
            <GenieInput
              placeholder={t('client:messages.chat.placeholder')}
              value={messageText}
              onChangeText={setMessageText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
          </View>

          <Pressable
            onPress={handleSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={t('client:messages.chat.send')}
            accessibilityState={{ disabled: !canSend }}
            className={`h-11 w-11 items-center justify-center rounded-full bg-gold active:bg-gold-pressed ${
              canSend ? '' : 'opacity-40'
            }`}
          >
            <SendIcon size={20} color={colors.onGold} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
