/**
 * Adapter for handling both legacy (session_id) and new (chat_id) formats
 * during the migration period
 */

import { ChatMessage, ChatResponse, Emotion } from '@/types/chat';

interface NewFormatMessage {
  id: string | number;
  content: string;
  role: 'user' | 'assistant' | 'system';
  chat_id: number;
  sender_id?: number;
  metadata?: Record<string, unknown>;
  emotions?: Emotion[];
  created_at: string;
  updated_at: string;
}

/**
 * Convert chat_id to session_id format
 */
export function chatIdToSessionId(chatId: number): string {
  return `chat-${chatId}`;
}

/**
 * Extract chat_id from session_id format
 */
export function sessionIdToChatId(sessionId: string): number | null {
  if (!sessionId) return null;

  const match = sessionId.match(/^chat-(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }

  // Session ID doesn't follow the pattern, might be a UUID
  return null;
}

/**
 * Normalize message to ChatMessage format for backward compatibility
 */
export function normalizeMessageToLegacy(
  message: ChatMessage | NewFormatMessage,
  sessionId: string
): ChatMessage {
  if ('session_id' in message) {
    return message as ChatMessage;
  }

  // Convert new format to legacy
  const newMsg = message as NewFormatMessage;
  return {
    ...newMsg,
    id: String(newMsg.id), // Ensure ID is string
    session_id: sessionId,
  } as ChatMessage;
}

/**
 * Adapt response to include both formats
 */
export function adaptChatResponse(response: ChatResponse & { chat_id?: number }): ChatResponse {
  // Ensure session_id is always present
  const sessionId = response.session_id ||
    (response.chat_id ? chatIdToSessionId(response.chat_id) : '');

  const result: ChatResponse = {
    session_id: sessionId,
    user_message: normalizeMessageToLegacy(response.user_message, sessionId),
    assistant_message: normalizeMessageToLegacy(response.assistant_message, sessionId),
  };

  return result;
}

interface ApiMessagesResponse {
  messages: Array<ChatMessage | NewFormatMessage>;
  total_count: number;
  current_page: number;
  total_pages: number;
  session_id?: string;
  chat_id?: number;
}

/**
 * Adapt messages list response
 */
export function adaptMessagesResponse(response: ApiMessagesResponse): {
  messages: ChatMessage[];
  total_count: number;
  current_page: number;
  total_pages: number;
} {
  const sessionId = response.session_id ||
    (response.chat_id ? chatIdToSessionId(response.chat_id) : '');

  const messages = response.messages.map((msg) =>
    normalizeMessageToLegacy(msg, sessionId)
  );

  return {
    messages,
    total_count: response.total_count,
    current_page: response.current_page,
    total_pages: response.total_pages,
  };
}

/**
 * Check if we should use new API format
 */
export function shouldUseNewFormat(): boolean {
  // This can be controlled by environment variable or feature flag
  return process.env.NEXT_PUBLIC_USE_NEW_CHAT_FORMAT === 'true';
}