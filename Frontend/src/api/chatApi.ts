import { apiClient, unwrap } from './apiClient';
import type { ApiSuccess } from '../types/api';
import type { ChatConversation, ChatMessage, MessageAttachment } from '../types/domain';

export const chatApi = {
  async getChats(): Promise<ChatConversation[]> {
    const response = await apiClient.get<ApiSuccess<ChatConversation[]>>('/chats');
    return unwrap(response);
  },

  async getOrCreateChat(otherUserId: string): Promise<ChatConversation> {
    const response = await apiClient.post<ApiSuccess<ChatConversation>>('/chats', {
      otherUserId,
    });
    return unwrap(response);
  },

  async getMessages(chatId: string): Promise<ChatMessage[]> {
    const response = await apiClient.get<ApiSuccess<ChatMessage[]>>(
      `/chats/${encodeURIComponent(chatId)}/messages`,
    );
    return unwrap(response);
  },

  async sendMessage(
    chatId: string,
    content: string,
    attachments?: MessageAttachment[],
  ): Promise<ChatMessage> {
    const response = await apiClient.post<ApiSuccess<ChatMessage>>(
      `/chats/${encodeURIComponent(chatId)}/messages`,
      { content, attachments },
    );
    return unwrap(response);
  },

  async markAsRead(chatId: string): Promise<void> {
    await apiClient.put<ApiSuccess<null>>(
      `/chats/${encodeURIComponent(chatId)}/read`,
    );
  },
};
