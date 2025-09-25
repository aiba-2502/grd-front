'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useChatStore } from '@/stores/chatStore';
import { chatApi } from '@/services/chatApi';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import dynamic from 'next/dynamic';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';

// Live2Dコンポーネントを動的インポート（SSR無効化）
const Live2DComponent = dynamic(() => import('@/components/Live2DComponent'), {
  ssr: false,
  loading: () => (
    <div className="fixed top-4 right-4 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg shadow">
      Live2Dを準備中...
    </div>
  ),
});

export const ChatContainer: React.FC = () => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const {
    messages,
    sessionId,
    isLoading,
    error,
    settings,
    addMessage,
    setLoading,
    setError,
    setMessages
  } = useChatStore();

  const [token, setToken] = useState<string | null>(null);
  const [showLive2D, setShowLive2D] = useState(false);
  const hasAddedGreetingRef = useRef(false);

  // セッションIDが変わったときにグリーティングフラグをリセット
  useEffect(() => {
    hasAddedGreetingRef.current = false;
  }, [sessionId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // AIの初回グリーティングメッセージを追加する関数
  const addGreetingMessage = useCallback(() => {
    // すでにグリーティングメッセージが追加されているかチェック
    if (!hasAddedGreetingRef.current) {
      const greetingMessage = {
        id: uuidv4(),
        content: '今日はどうしたの？なんでもお話し聞かせてください',
        role: 'assistant' as const,
        session_id: sessionId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      addMessage(greetingMessage);
      hasAddedGreetingRef.current = true;
    }
  }, [sessionId, addMessage]);

  const loadMessages = useCallback(async (retryCount = 0) => {
    try {
      const response = await chatApi.getMessages(sessionId);
      setMessages(response.messages);
      // メッセージが空の場合にグリーティングを追加
      if (response.messages.length === 0) {
        setTimeout(() => {
          addGreetingMessage();
        }, 100);
      }
    } catch (error) {
      // 401エラーの場合はトークンが無効な可能性
      const axiosError = error as { response?: { status?: number } };
      if (axiosError?.response?.status === 401) {
        logger.log('Authentication error - messages will be loaded after login');
        // メッセージをクリア
        setMessages([]);
        // 認証エラー後も、グリーティングを追加
        setTimeout(() => {
          addGreetingMessage();
        }, 100);
      } else if (axiosError?.response?.status === 404 && retryCount < 2) {
        // 404エラーの場合、サーバーの起動を待ってリトライ
        logger.log(`Server may be starting up. Retrying... (attempt ${retryCount + 1})`);
        setTimeout(() => {
          loadMessages(retryCount + 1);
        }, 1000);
      } else if (axiosError?.response?.status === 404) {
        // リトライ後も404の場合は、新規セッションとして扱う
        logger.log('No messages found for this session - starting fresh');
        setMessages([]);
        // 新規セッションの場合もグリーティングを追加
        setTimeout(() => {
          addGreetingMessage();
        }, 100);
      } else {
        logger.error('Failed to load messages:', error);
      }
    }
  }, [sessionId, setMessages, addGreetingMessage]);

  useEffect(() => {
    // トークンを取得
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      setToken(storedToken);
      // chatApiにトークンを設定
      chatApi.setToken(storedToken);
      // Live2Dを遅延ロード
      const timer = setTimeout(() => {
        setShowLive2D(true);
      }, 500);
      // メッセージ読み込み（エラーハンドリング改善）
      loadMessages().catch((error) => {
        // 401と404エラー以外はコンソールにログ出力
        const axiosError = error as { response?: { status?: number } };
        if (axiosError?.response?.status !== 401 && axiosError?.response?.status !== 404) {
          logger.error('Failed to load messages:', error);
        }
        // 新規セッションの可能性があるため、エラーは表示しない
      });
      return () => clearTimeout(timer);
    }
  }, [sessionId, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!token) {
      setError('ログインが必要です');
      return;
    }

    setLoading(true);
    setError(null);

    // 仮のユーザーメッセージを追加
    const tempUserMessage = {
      id: uuidv4(),
      content,
      role: 'user' as const,
      session_id: sessionId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    addMessage(tempUserMessage);

    try {
      const response = await chatApi.sendMessage({
        content,
        session_id: sessionId,
        provider: settings.provider,
        api_key: settings.api_key,
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.max_tokens,
        system_prompt: settings.system_prompt
      });

      // 実際のメッセージで置き換え
      setMessages([
        ...messages.filter(m => m.id !== tempUserMessage.id),
        response.user_message,
        response.assistant_message
      ]);
    } catch (error) {
      const axiosError = error as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'メッセージの送信に失敗しました');
      // エラー時は仮メッセージを削除
      setMessages(messages.filter(m => m.id !== tempUserMessage.id));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Live2D Character - 背景として表示（チャット画面用モデル） */}
      {showLive2D && <Live2DComponent screenType="chat" />}

      {/* チャット画面 - ChatGPT風 */}
      <div className="flex flex-col h-full relative z-10">
        {/* メッセージエリア */}
        <div className="flex-1 overflow-y-auto pb-40">
          <div className="w-full py-6 px-6 sm:px-8 md:px-12 lg:px-16">
            {messages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}
            
            {isLoading && (
              <div className="flex gap-3 mb-6">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">AI</span>
                  </div>
                </div>
                <div className="flex-1">
                  <div className="inline-block bg-white/70 backdrop-blur-sm rounded-lg px-4 py-3 shadow-sm">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {error && (
              <div className="mb-4">
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  <p className="font-medium">エラーが発生しました</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </div>
        
        {/* 入力エリア - ボトムナビの上に固定 */}
        <ChatInput onSend={handleSendMessage} disabled={isLoading || !token} />
      </div>
    </>
  );
};