'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContextOptimized';
import dynamic from 'next/dynamic';
import BottomNav from '@/components/BottomNav';
import { logger } from '@/utils/logger';

// Live2Dコンポーネントを動的インポート（SSR無効化 + ローディング表示）
const Live2DComponent = dynamic(() => import('@/components/Live2DComponent'), {
  ssr: false,
  loading: () => (
    <div className="fixed top-4 right-4 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg shadow">
      Live2Dを準備中...
    </div>
  ),
});

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [showLive2D, setShowLive2D] = useState(false);
  const [showWelcomeCard, setShowWelcomeCard] = useState(true);

  useEffect(() => {
    logger.log('[Home] Auth check - isLoading:', isLoading, 'user:', user);
    if (!isLoading && !user) {
      logger.log('[Home] No user found, redirecting to login');
      router.push('/login');
    }
  }, [user, isLoading, router]);

  // Live2Dを即座にロード（遅延削除）
  useEffect(() => {
    if (user) {
      setShowLive2D(true);
    }
  }, [user]);

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
    <>
      {showLive2D && <Live2DComponent />}
      <div className="flex flex-col items-center justify-center min-h-screen relative z-10 pt-16 pb-24">
        {showWelcomeCard && (
          <div className="bg-white/75 backdrop-blur-sm shadow-lg rounded-lg p-6 max-w-md relative">
            {/* ×ボタン */}
            <button
              onClick={() => setShowWelcomeCard(false)}
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="閉じる"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* カードの内容 */}
            <h1 className="text-3xl font-bold mb-4 text-center">心のログ - Kokoro Log</h1>
            <p className="text-lg mb-2 text-center">ようこそ、{user.name || user.email}さん</p>
            <p className="text-gray-600 mt-4 text-center">
              下のナビゲーションからチャット機能をご利用ください
            </p>
          </div>
        )}
      </div>
      <BottomNav />
    </>
  );
}