'use client';

import React, { useMemo, useState } from 'react';
import { ChatMessage as ChatMessageType } from '@/types/chat';
import { UserCircleIcon, SpeakerWaveIcon, StopIcon } from '@heroicons/react/24/solid';
import DOMPurify from 'dompurify';
import { VoiceService } from '@/services/voiceApi';
import { useLipSyncHandler } from '@/lib/hooks/useLipSyncHandler';
import { logger } from '@/utils/logger';
import { useChatStore } from '@/stores/chatStore';

interface ChatMessageProps {
  message: ChatMessageType;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { startLipSync, stopLipSync } = useLipSyncHandler();

  // グローバルな音声再生状態を取得
  const { playingMessageId, setPlayingMessageId } = useChatStore();
  const isOtherMessagePlaying = playingMessageId !== null && playingMessageId !== message.id;

  // XSS対策：メッセージ内容をサニタイズ
  const sanitizedContent = useMemo(() => {
    // DOMPurifyでHTMLタグを除去し、安全なテキストのみを残す
    return DOMPurify.sanitize(message.content, {
      ALLOWED_TAGS: [], // すべてのHTMLタグを除去
      ALLOWED_ATTR: [], // すべての属性を除去
      KEEP_CONTENT: true // テキストコンテンツは保持
    });
  }, [message.content]);

  // 音声読み上げ処理
  const handleVoicePlay = async () => {
    // 連打対策：ローディング中または他のメッセージが再生中は何もしない
    if (isLoading || isOtherMessagePlaying) {
      return;
    }

    if (isPlaying) {
      // 再生中の場合は停止
      VoiceService.stopVoice();
      stopLipSync();  // リップシンクも停止
      setIsPlaying(false);
      setPlayingMessageId(null);  // グローバル状態をクリア
    } else {
      // 再生開始
      setIsLoading(true);
      setPlayingMessageId(message.id);  // グローバル状態を設定
      try {
        await VoiceService.playVoice(sanitizedContent, {
          onEnded: () => {
            // 音声再生終了時のコールバック
            stopLipSync();  // リップシンクを停止
            setIsPlaying(false);
            setPlayingMessageId(null);  // グローバル状態をクリア
          },
          onError: (error) => {
            // エラー時のコールバック
            logger.error('音声再生エラー:', error);
            stopLipSync();  // リップシンクを停止
            setIsPlaying(false);
            setPlayingMessageId(null);  // グローバル状態をクリア
            alert('音声再生に失敗しました');
          },
          onLipSyncReady: (audioUrl) => {
            // リップシンクを開始
            startLipSync(audioUrl).catch(error => {
              logger.error('リップシンク開始エラー:', error);
            });
          }
        });
        setIsPlaying(true);
      } catch (error) {
        logger.error('音声再生エラー:', error);
        alert('音声再生に失敗しました');
        setIsPlaying(false);
        setPlayingMessageId(null);  // グローバル状態をクリア
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  return (
    <div className={`flex gap-3 mb-6 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* アバター */}
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
            <UserCircleIcon className="w-6 h-6 text-white" />
          </div>
        ) : (
          <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-blue-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">AI</span>
          </div>
        )}
      </div>
      
      {/* メッセージ内容 - レスポンシブ対応で幅を調整 */}
      <div className={`flex-1 ${isUser ? 'text-right' : ''}`}>
        <div className={`inline-block ${isUser ? 'text-left' : ''}`} 
             style={{ maxWidth: 'calc(100% - 48px)' }}>
          <div className={`rounded-lg px-4 py-2 ${
            isUser
              ? 'bg-gray-100/70 backdrop-blur-sm text-gray-900'
              : 'bg-white/70 backdrop-blur-sm text-gray-900 shadow-sm'
          }`}>
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-all"
               style={{ maxWidth: '28ch', wordBreak: 'break-all', overflowWrap: 'anywhere' }}>
              {sanitizedContent}
            </p>
          </div>
          
          {/* タイムスタンプとボイスボタン */}
          <div className={`flex items-center gap-2 mt-1 ${isUser ? 'justify-end' : ''}`}>
            <div className={`text-xs text-gray-500`}>
              {new Date(message.created_at).toLocaleTimeString('ja-JP', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>

            {/* AIメッセージにのみボイスボタンを表示 */}
            {!isUser && message.role === 'assistant' && (
              <button
                onClick={handleVoicePlay}
                disabled={isLoading || isOtherMessagePlaying}
                className={`p-1 rounded-full transition-all duration-200 ${
                  isLoading || isOtherMessagePlaying
                    ? 'bg-gray-300 cursor-not-allowed opacity-50'
                    : isPlaying
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
                title={isOtherMessagePlaying ? '他のメッセージ再生中' : (isPlaying ? '停止' : '読み上げ')}
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <StopIcon className="w-4 h-4" />
                ) : (
                  <SpeakerWaveIcon className="w-4 h-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};