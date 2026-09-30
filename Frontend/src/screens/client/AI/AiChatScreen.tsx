import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GenieAiDisclaimer, GenieHeader, GenieText } from '../../../components/ui';
import {
  ChevronRightIcon,
  RefreshIcon,
  SendIcon,
  SparkleIcon,
} from '../../../components/icons/ClientIcons';
import { AlertIcon, UserIcon } from '../../../components/icons/Icons';
import { aiApi } from '../../../api/aiApi';
import type { ClientStackScreenProps } from '../../../types/navigation';
import { colors } from '../../../theme';
import { formatDateParts } from '../../../utils/format';
import { useT } from '../../../i18n/useT';
import i18n from '../../../i18n';
import { logError } from '../../../utils/log';

interface ChatMessageItem {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  isError?: boolean;
}

const SUGGESTED_QUESTIONS = [
  'assistant:chat.suggested.postCase',
  'assistant:chat.suggested.findLawyer',
  'assistant:chat.suggested.uploadDocs',
  'assistant:chat.suggested.appointments',
  'assistant:chat.suggested.features',
  'assistant:chat.suggested.support',
] as const;

const WELCOME_ID = 'welcome-1';

const timeNow = (): string => formatDateParts(new Date(), { hour: '2-digit', minute: '2-digit' });

const RenderFormattedMessage: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');

  return (
    <View className="gap-2">
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        if (!trimmed) {
          return <View key={idx} className="h-1.5" />;
        }

        if (trimmed.startsWith('###') || trimmed.startsWith('##')) {
          const heading = trimmed.replace(/^#+\s*/, '');
          return (
            <GenieText key={idx} variant="heading-sm" tone="gold" className="font-semibold mt-1">
              {heading}
            </GenieText>
          );
        }

        if (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*')) {
          const content = trimmed.replace(/^[\bullet\-*]\s*/, '');
          return (
            <View key={idx} className="flex-row items-start pl-1 gap-2">
              <View className="h-1.5 w-1.5 rounded-full bg-gold mt-2" />
              <GenieText variant="body-sm" tone="primary" className="flex-1 leading-relaxed">
                {content}
              </GenieText>
            </View>
          );
        }

        return (
          <GenieText key={idx} variant="body-sm" tone="primary" className="leading-relaxed">
            {trimmed}
          </GenieText>
        );
      })}
    </View>
  );
};

export const AiChatScreen: React.FC<ClientStackScreenProps<'AiChat'>> = ({
  navigation,
  route,
}) => {
  const { t } = useT();
  const initialQuestion = route.params?.initialQuestion;
  const [messages, setMessages] = useState<ChatMessageItem[]>([
    {
      id: WELCOME_ID,
      role: 'assistant',
      // Shown from assistant:chat.welcome so it follows the current language.
      text: '',
      timestamp: timeNow(),
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSend = useCallback(
    async (textToSend?: string) => {
      const messageText = (textToSend || inputText).trim();
      if (!messageText || isLoading) {
        return;
      }

      const userMsgId = `user-${Date.now()}`;
      const userMessage: ChatMessageItem = {
        id: userMsgId,
        role: 'user',
        text: messageText,
        timestamp: timeNow(),
      };

      setMessages(prev => [...prev, userMessage]);
      setInputText('');
      setIsLoading(true);
      setErrorNotice(null);
      scrollToBottom();

      try {
        const response = await aiApi.chat({
          message: messageText,
          conversationId,
          mode: 'chat',
        });

        if (response.conversationId) {
          setConversationId(response.conversationId);
        }

        const replyText = response.response?.trim();

        if (!replyText) {
          setErrorNotice(i18n.t('assistant:chat.emptyReply'));
          return;
        }

        const aiMsg: ChatMessageItem = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: replyText,
          timestamp: timeNow(),
        };

        setMessages(prev => [...prev, aiMsg]);
      } catch (err: any) {
        logError('ai-chat', err);
        const errorMsg =
          err?.response?.data?.message ||
          err?.message ||
          i18n.t('assistant:chat.unreachable');
        setErrorNotice(errorMsg);
      } finally {
        setIsLoading(false);
        scrollToBottom();
      }
    },
    [inputText, isLoading, conversationId, scrollToBottom],
  );

  useEffect(() => {
    if (initialQuestion) {
      handleSend(initialQuestion);
    }
  }, [initialQuestion, handleSend]);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
      <GenieHeader
        title={t('assistant:chat.title')}
        subtitle={t('assistant:chat.subtitle')}
        onBack={() => navigation.goBack()}
      />

      <GenieAiDisclaimer className="px-4 pb-1 pt-1" />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        className="flex-1"
      >
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-4 py-3"
          contentContainerClassName="pb-6"
          onContentSizeChange={scrollToBottom}
          showsVerticalScrollIndicator={false}
        >
          {messages.map(msg => (
            <View
              key={msg.id}
              className={`mb-4 flex-row ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'assistant' ? (
                <View className="mr-2 h-9 w-9 items-center justify-center rounded-full bg-gold-muted">
                  <SparkleIcon size={18} color={colors.gold} />
                </View>
              ) : null}

              <View
                className={`max-w-[82%] rounded-[18px] p-4  ${
                  msg.role === 'user'
                    ? 'rounded-tr-none bg-surface-alt'
                    : 'rounded-tl-none bg-surface'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <RenderFormattedMessage
                    text={msg.id === WELCOME_ID ? t('assistant:chat.welcome') : msg.text}
                  />
                ) : (
                  <GenieText variant="body-sm" tone="primary" className="leading-relaxed">
                    {msg.text}
                  </GenieText>
                )}

                <GenieText
                  variant="caption"
                  tone="muted"
                  className={`mt-2 text-small-label ${
                    msg.role === 'user' ? 'text-right tone-gold' : 'text-left'
                  }`}
                >
                  {msg.timestamp}
                </GenieText>
              </View>

              {msg.role === 'user' ? (
                <View className="ml-2 h-9 w-9 items-center justify-center rounded-full bg-gold">
                  <UserIcon size={18} color={colors.onGold} />
                </View>
              ) : null}
            </View>
          ))}

          {isLoading ? (
            <View className="mb-4 flex-row items-center justify-start">
              <View className="mr-2 h-9 w-9 items-center justify-center rounded-full bg-gold-muted">
                <SparkleIcon size={18} color={colors.gold} />
              </View>
              <View className="flex-row items-center gap-2 rounded-[18px] rounded-tl-none bg-surface px-4 py-3">
                <ActivityIndicator size="small" color={colors.gold} />
                <GenieText variant="body-sm" tone="secondary">
                  {t('assistant:chat.thinking')}
                </GenieText>
              </View>
            </View>
          ) : null}

          {errorNotice ? (
            <View className="mb-4 flex-row items-center justify-between rounded-card border border-error bg-error-surface p-3.5">
              <View className="flex-1 flex-row items-center gap-2">
                <AlertIcon size={20} color={colors.error} />
                <GenieText variant="body-sm" tone="error" className="flex-1">
                  {errorNotice}
                </GenieText>
              </View>
              <Pressable
                onPress={() => {
                  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                  if (lastUserMsg) {
                    handleSend(lastUserMsg.text);
                  }
                }}
                className="ml-2 flex-row items-center gap-1 rounded-control bg-error-surface px-3 py-1.5 border border-error active:opacity-70"
              >
                <RefreshIcon size={14} color={colors.error} />
                <GenieText variant="caption" tone="error" className="font-bold">
                  {t('assistant:chat.retry')}
                </GenieText>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>

        <View className="bg-surface px-2 py-2">
          <GenieText variant="caption" tone="secondary" className="px-2 mb-1.5 text-small-label font-medium uppercase tracking-wider">
            {t('assistant:chat.suggestedTitle')}
          </GenieText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-1 pb-1"
          >
            {SUGGESTED_QUESTIONS.map((q, idx) => (
              <Pressable
                key={idx}
                onPress={() => handleSend(t(q))}
                disabled={isLoading}
                className="flex-row items-center gap-1.5 rounded-pill bg-surface-alt px-3 py-1.5 active:bg-gold-muted"
              >
                <GenieText variant="caption" tone="primary" className="text-caption">
                  {t(q)}
                </GenieText>
                <ChevronRightIcon size={12} color={colors.gold} />
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View className="bg-surface p-3">
          <View className="flex-row items-center rounded-control bg-surface px-3 py-1">
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('assistant:chat.placeholder')}
              placeholderTextColor={colors.textMuted}
              editable={!isLoading}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
              className="flex-1 py-2.5 text-body-md text-white"
            />
            <Pressable
              onPress={() => handleSend()}
              disabled={isLoading || !inputText.trim()}
              accessibilityRole="button"
              accessibilityLabel={t('assistant:chat.sendA11y')}
              className={`h-9 w-9 items-center justify-center rounded-full bg-gold ${
                isLoading || !inputText.trim() ? 'opacity-40' : 'active:bg-gold-bright'
              }`}
            >
              <SendIcon size={16} color={colors.onGold} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
