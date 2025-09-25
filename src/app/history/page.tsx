'use client';

import { useAuth } from '@/contexts/AuthContextOptimized';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import BottomNav from '@/components/BottomNav';
import { HistoryList } from '@/components/History/HistoryList';
import dynamic from 'next/dynamic';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useChatStore } from '@/stores/chatStore';

// Live2Dコンポーネントを動的インポート（SSR無効化）- コンテナ内表示版
const Live2DContainedComponent = dynamic(() => import('@/components/Live2DContainedComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400 text-center">
        <div className="animate-pulse">
          <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-2"></div>
          <p className="text-xs">キャラクター準備中...</p>
        </div>
      </div>
    </div>
  ),
});

export default function HistoryPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { newSession } = useChatStore();
  const [showLive2D, setShowLive2D] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    // Live2Dを遅延ロード
    if (user) {
      const timer = setTimeout(() => {
        setShowLive2D(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  const handleNewChat = () => {
    newSession();
    router.push('/chat');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Main Content - 左右分割レイアウト */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Side - Live2D Character エリア - 拡大版 */}
        <div className="w-80 lg:w-96 xl:w-[28rem] bg-transparent border-r border-gray-200 flex-shrink-0 relative overflow-hidden">
          {/* Live2Dコンポーネントを配置 - コンテナ全域を表示領域として使用 */}
          {showLive2D ? (
            <div className="absolute inset-0">
              <Live2DContainedComponent screenType="history" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-gray-400 text-center">
                <div className="animate-pulse">
                  <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-2"></div>
                  <p className="text-xs">キャラクターを読み込み中...</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side - History List */}
        <div className="flex-1 overflow-y-auto bg-transparent pb-24">
          <div className="container mx-auto px-4 py-6 max-w-4xl">
            <HistoryList />
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}