'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';

// Live2Dコンポーネントを動的にインポート（クライアントサイドのみ）
const Live2DComponent = dynamic(
  () => import('./Live2DComponent'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center p-4 text-gray-500">
        <div className="animate-pulse">Live2Dモデルを読み込み中...</div>
      </div>
    ),
  }
);

interface Live2DDynamicComponentProps {
  enabled?: boolean;
}

export const Live2DDynamicComponent: React.FC<Live2DDynamicComponentProps> = ({ 
  enabled = true 
}) => {
  const [showLive2D, setShowLive2D] = useState(enabled);

  if (!showLive2D) {
    return (
      <button
        onClick={() => setShowLive2D(true)}
        className="fixed bottom-4 right-4 px-4 py-2 bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition-colors"
      >
        Live2Dを表示
      </button>
    );
  }

  return <Live2DComponent />;
};

export default Live2DDynamicComponent;