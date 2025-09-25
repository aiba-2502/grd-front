'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { ChatSession, Emotion } from '@/types/chat';
import { chatApi } from '@/services/chatApi';
import { useRouter } from 'next/navigation';
import { useChatStore } from '@/stores/chatStore';
import { logger } from '@/utils/logger';
import {
  ChatBubbleLeftRightIcon,
  ClockIcon,
  ChevronRightIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { SearchBox } from './SearchBox';
import { DeleteConfirmModal } from '../Modal/DeleteConfirmModal';

interface SearchParams {
  keyword: string;
  startDate: string;
  endDate: string;
  selectedEmotions: string[];
}

export const HistoryList: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useState<SearchParams>({
    keyword: '',
    startDate: '',
    endDate: '',
    selectedEmotions: [],
  });
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [sessionPreview, setSessionPreview] = useState<string>('');
  const router = useRouter();
  const { setSessionId, setMessages } = useChatStore();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const token = localStorage.getItem('access_token');
      if (token) {
        chatApi.setToken(token);
        const response = await chatApi.getChatSessions();
        setSessions(response.sessions);
      }
    } catch (error) {
      logger.error('Failed to load sessions:', error);
      setError('履歴の読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionDelete = (sessionId: string, preview: string, event: React.MouseEvent) => {
    event.stopPropagation(); // 親のonClickイベントの伝播を防ぐ
    setSessionToDelete(sessionId);
    setSessionPreview(preview || 'チャット履歴');
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!sessionToDelete) return;

    try {
      setDeletingSessionId(sessionToDelete);
      const token = localStorage.getItem('access_token');
      if (token) {
        chatApi.setToken(token);
        await chatApi.deleteChatSession(sessionToDelete);

        // セッションリストから削除
        setSessions(prevSessions =>
          prevSessions.filter(session => session.session_id !== sessionToDelete)
        );

        // モーダルを閉じる
        setDeleteModalOpen(false);
      }
    } catch (error) {
      logger.error('Failed to delete session:', error);
      setError('チャット履歴の削除に失敗しました');
    } finally {
      setDeletingSessionId(null);
      setSessionToDelete(null);
      setSessionPreview('');
    }
  };

  const cancelDelete = () => {
    setDeleteModalOpen(false);
    setSessionToDelete(null);
    setSessionPreview('');
  };

  const handleSessionClick = async (sessionId: string) => {
    try {
      // セッションIDを設定
      setSessionId(sessionId);

      // メッセージを読み込む
      const token = localStorage.getItem('access_token');
      if (token) {
        chatApi.setToken(token);
        const response = await chatApi.getMessages(sessionId);
        setMessages(response.messages);
      }
      
      // チャット画面に遷移
      router.push('/chat');
    } catch (error) {
      logger.error('Failed to load session:', error);
      setError('セッションの読み込みに失敗しました');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return `今日 ${date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `昨日 ${date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays}日前`;
    } else {
      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    }
  };

  // 利用可能な全感情タグを収集
  const availableEmotions = useMemo(() => {
    const emotionMap = new Map<string, Emotion>();

    sessions.forEach(session => {
      if (session.emotions) {
        session.emotions.forEach(emotion => {
          if (!emotionMap.has(emotion.name)) {
            emotionMap.set(emotion.name, emotion);
          }
        });
      }
    });

    return Array.from(emotionMap.values())
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [sessions]);

  // フィルタリングされたセッション
  const filteredSessions = useMemo(() => {
    let filtered = [...sessions];

    // キーワード検索
    if (searchParams.keyword) {
      const keyword = searchParams.keyword.toLowerCase();
      filtered = filtered.filter(session =>
        session.preview?.toLowerCase().includes(keyword)
      );
    }

    // 期間フィルタ
    if (searchParams.startDate) {
      const startDate = new Date(searchParams.startDate);
      startDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(session =>
        new Date(session.last_message_at) >= startDate
      );
    }

    if (searchParams.endDate) {
      const endDate = new Date(searchParams.endDate);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(session =>
        new Date(session.last_message_at) <= endDate
      );
    }

    // 感情タグフィルタ
    if (searchParams.selectedEmotions && searchParams.selectedEmotions.length > 0) {
      filtered = filtered.filter(session => {
        if (!session.emotions || session.emotions.length === 0) {
          return false;
        }
        // セッションが選択された感情のいずれかを含むかチェック
        const sessionEmotionNames = session.emotions.map(e => e.name);
        return searchParams.selectedEmotions.some(selectedEmotion =>
          sessionEmotionNames.includes(selectedEmotion)
        );
      });
    }

    return filtered;
  }, [sessions, searchParams]);

  const handleSearch = (params: SearchParams) => {
    setSearchParams(params);
  };

  // 感情に応じた色を返す関数
  const getEmotionColor = (emotionName: string): string => {
    const colorMap: Record<string, string> = {
      // ポジティブな感情
      joy: 'bg-yellow-100/70 text-yellow-800',
      love: 'bg-pink-100/70 text-pink-800',
      trust: 'bg-green-100/70 text-green-800',
      gratitude: 'bg-purple-100/70 text-purple-800',
      hope: 'bg-blue-100/70 text-blue-800',
      relief: 'bg-teal-100/70 text-teal-800',
      pride: 'bg-indigo-100/70 text-indigo-800',
      contentment: 'bg-lime-100/70 text-lime-800',
      anticipation: 'bg-cyan-100/70 text-cyan-800',

      // ネガティブな感情
      sadness: 'bg-gray-100/70 text-gray-800',
      anger: 'bg-red-100/70 text-red-800',
      fear: 'bg-orange-100/70 text-orange-800',
      anxiety: 'bg-amber-100/70 text-amber-800',
      frustration: 'bg-rose-100/70 text-rose-800',
      guilt: 'bg-stone-100/70 text-stone-800',
      shame: 'bg-zinc-100/70 text-zinc-800',
      disappointment: 'bg-slate-100/70 text-slate-800',
      loneliness: 'bg-gray-200/70 text-gray-700',
      disgust: 'bg-emerald-100/70 text-emerald-800',

      // ニュートラルな感情
      surprise: 'bg-violet-100/70 text-violet-800'
    };

    return colorMap[emotionName] || 'bg-gray-100/70 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p>履歴を読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={loadSessions}
          className="px-4 py-2 bg-blue-500/90 backdrop-blur-sm text-white rounded-lg hover:bg-blue-600/90 transition-colors"
        >
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* 検索ボックス - 常に表示 */}
      <SearchBox
        onSearch={handleSearch}
        availableEmotions={availableEmotions}
      />

      {/* 検索結果の表示 */}
      {(searchParams.keyword || searchParams.startDate || searchParams.endDate || searchParams.selectedEmotions.length > 0) && (
        <div className="mb-3 text-sm text-gray-600">
          検索結果: {filteredSessions.length}件
        </div>
      )}

      {/* セッション一覧 */}
      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">
            まだチャット履歴がありません
          </h3>
          <p className="text-gray-500 mb-6">
            新しい会話を始めてみましょう
          </p>
          <button
            onClick={() => router.push('/chat')}
            className="px-6 py-3 bg-blue-500/90 backdrop-blur-sm text-white rounded-lg hover:bg-blue-600/90 transition-colors"
          >
            チャットを開始
          </button>
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500">
            検索条件に一致する履歴がありません
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[47rem] overflow-y-auto pr-2 scrollbar-thin">
          {filteredSessions.map((session) => (
        <div
          key={session.session_id}
          className="relative bg-white/60 hover:bg-white/70 backdrop-blur-sm rounded-lg p-4 transition-colors border border-gray-200 hover:border-gray-300 group"
        >
          <button
            onClick={() => handleSessionClick(session.session_id)}
            className="w-full text-left focus:outline-none"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-20">
                <div className="flex items-center gap-2 mb-2">
                  <ChatBubbleLeftRightIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500">
                    {session.message_count} メッセージ
                  </span>
                </div>

                <p className="text-sm text-gray-800 line-clamp-2 mb-2">
                  {session.preview || '会話の内容がありません'}
                </p>

                {/* 感情タグ */}
                {session.emotions && session.emotions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {session.emotions.map((emotion, index) => (
                      <span
                        key={index}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          getEmotionColor(emotion.name)
                        }`}
                        title={`強度: ${emotion.intensity}, 頻度: ${emotion.frequency || 1}`}
                      >
                        {emotion.label}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <ClockIcon className="w-3 h-3" />
                  <span>{formatDate(session.last_message_at)}</span>
                </div>
              </div>
            </div>
          </button>

          {/* 右上の矢印アイコン */}
          <div className="absolute top-4 right-4">
            <ChevronRightIcon className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
          </div>

          {/* 右下の削除アイコン */}
          <div className="absolute bottom-4 right-4">
            <button
              onClick={(e) => handleSessionDelete(session.session_id, session.preview || '会話の内容がありません', e)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              disabled={deletingSessionId === session.session_id}
              title="削除"
            >
              {deletingSessionId === session.session_id ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
              ) : (
                <TrashIcon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
          ))}
        </div>
      )}

      {/* 削除確認モーダル */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={cancelDelete}
        onConfirm={confirmDelete}
        title="チャット履歴の削除"
        message={`「${sessionPreview.length > 50 ? sessionPreview.substring(0, 50) + '...' : sessionPreview}」を削除してもよろしいですか？`}
        isDeleting={deletingSessionId !== null}
      />
    </div>
  );
};