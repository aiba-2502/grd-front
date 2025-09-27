import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatSettings } from '@/types/chat';

interface ChatStore {
  messages: ChatMessage[];
  sessionId: string;
  isLoading: boolean;
  error: string | null;
  settings: ChatSettings;
  playingMessageId: string | null; // 現在再生中のメッセージID

  // Actions
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setSessionId: (sessionId: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  updateSettings: (settings: Partial<ChatSettings>) => void;
  clearMessages: () => void;
  newSession: () => void;
  setPlayingMessageId: (messageId: string | null) => void; // 再生中のメッセージIDを設定
}

const defaultSettings: ChatSettings = {
  provider: (process.env.NEXT_PUBLIC_SELECT_AI_SERVICE as 'openai' | 'anthropic' | 'google') || 'openai',
  model: process.env.NEXT_PUBLIC_SELECT_AI_MODEL || 'gpt-4o-mini',
  temperature: parseFloat(process.env.NEXT_PUBLIC_TEMPERATURE || '0.7'),
  max_tokens: parseInt(process.env.NEXT_PUBLIC_MAX_TOKENS || '1000'),
  system_prompt: '',
  api_key: undefined // バックエンドの環境変数を使用
};

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      messages: [],
      sessionId: uuidv4(),
      isLoading: false,
      error: null,
      settings: defaultSettings,
      playingMessageId: null,

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message]
        })),

      setMessages: (messages) =>
        set({ messages }),

      setSessionId: (sessionId) =>
        set({ sessionId }),

      setLoading: (isLoading) =>
        set({ isLoading }),

      setError: (error) =>
        set({ error }),

      updateSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings }
        })),

      clearMessages: () =>
        set({ messages: [] }),

      newSession: () =>
        set({
          messages: [],
          sessionId: uuidv4(),
          error: null,
          playingMessageId: null
        }),

      setPlayingMessageId: (messageId) =>
        set({ playingMessageId: messageId })
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        settings: state.settings,
        sessionId: state.sessionId
      })
    }
  )
);