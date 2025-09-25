import axios from 'axios';
import { ChatMessage, ChatRequest, ChatResponse, ChatSession } from '@/types/chat';
import authService from '@/services/authService'; // authServiceをインポートしてインターセプターを有効化
import { adaptChatResponse, adaptMessagesResponse } from '@/utils/chatAdapter';
import { logger } from '@/utils/logger';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ChatApiService {
  private token: string | null = null;

  // トークンを設定
  setToken(token: string) {
    this.token = token;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` })
    };
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/v1/chats`,
        request,
        { headers: this.getHeaders() }
      );
      // Use adapter to ensure compatibility
      return adaptChatResponse(response.data);
    } catch (error) {
      logger.error('Error sending message:', error);
      throw error;
    }
  }

  async getMessages(session_id?: string, page: number = 1, per_page: number = 20): Promise<{
    messages: ChatMessage[];
    total_count: number;
    current_page: number;
    total_pages: number;
  }> {
    try {
      const params = new URLSearchParams();
      if (session_id) params.append('session_id', session_id);
      params.append('page', page.toString());
      params.append('per_page', per_page.toString());

      const response = await axios.get(
        `${API_BASE_URL}/api/v1/chats?${params.toString()}`,
        { headers: this.getHeaders() }
      );
      // Use adapter to ensure compatibility
      return adaptMessagesResponse(response.data);
    } catch (error) {
      logger.error('Error fetching messages:', error);
      throw error;
    }
  }

  async getChatSessions(): Promise<{ sessions: ChatSession[] }> {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/v1/chats/sessions`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      logger.error('Error fetching sessions:', error);
      throw error;
    }
  }

  async deleteMessage(messageId: string): Promise<void> {
    try {
      await axios.delete(
        `${API_BASE_URL}/api/v1/chats/${messageId}`,
        { headers: this.getHeaders() }
      );
    } catch (error) {
      logger.error('Error deleting message:', error);
      throw error;
    }
  }

  async deleteChatSession(sessionId: string): Promise<void> {
    try {
      await axios.delete(
        `${API_BASE_URL}/api/v1/chats/sessions/${sessionId}`,
        { headers: this.getHeaders() }
      );
    } catch (error) {
      logger.error('Error deleting chat session:', error);
      throw error;
    }
  }
}

export const chatApi = new ChatApiService();