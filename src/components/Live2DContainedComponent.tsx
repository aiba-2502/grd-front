'use client';

import { LAppDelegate } from '@/lib/live2d/demo/lappdelegate';
import { ScreenType } from '@/lib/live2d/demo/lappmodel';
import { useEffect, useRef, useState } from 'react';
import { logger } from '@/utils/logger';

interface Live2DContainedComponentProps {
  screenType?: ScreenType | string;
}

/**
 * コンテナ内に収まるLive2Dコンポーネント
 * 履歴画面など、特定のエリア内に表示する場合に使用
 */
const Live2DContainedComponent = ({ screenType = 'history' }: Live2DContainedComponentProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const delegateRef = useRef<LAppDelegate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitializedRef = useRef(false);

  useEffect(() => {
    const resizeView = () => {
      // レポート画面では初回初期化後のリサイズを無視する
      if (screenType === 'report' && isInitializedRef.current) {
        return;
      }

      if (delegateRef.current) {
        delegateRef.current.onResize();
      }
    };

    const initializeLive2D = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load Cubism Core first
        if (!(window as any).Live2DCubismCore) {
          (window as any).Module = {
            ALLOW_TABLE_GROWTH: 1,
            RESERVED_FUNCTION_POINTERS: 1000
          };

          const script = document.createElement('script');
          script.src = '/live2dcubismcore.min.js';
          script.async = false;

          await new Promise<void>((resolve, reject) => {
            script.onload = () => {
              if ((window as any).Live2DCubismCore) {
                logger.log('Live2DCubismCore loaded successfully');
                resolve();
              } else {
                reject(new Error('Live2DCubismCore not found after script load'));
              }
            };
            script.onerror = () => reject(new Error('Failed to load live2dcubismcore.min.js'));
            document.head.appendChild(script);
          });
        }

        if (canvasRef.current) {
          const appDelegateInstance = LAppDelegate.getInstance();

          if (appDelegateInstance.initializeWithCanvas(canvasRef.current)) {
            appDelegateInstance.run();
            delegateRef.current = appDelegateInstance;
            isInitializedRef.current = true; // 初期化完了をマーク
            setIsLoading(false);
          } else {
            throw new Error('Failed to initialize Live2D delegate');
          }
        }
      } catch (err) {
        logger.error('Failed to initialize Live2D:', err);
        setError(`Failed to initialize Live2D: ${err instanceof Error ? err.message : String(err)}`);
        setIsLoading(false);
      }
    };

    initializeLive2D();

    // リサイズイベントリスナーを追加
    window.addEventListener('resize', resizeView);

    // クリーンアップ
    return () => {
      window.removeEventListener('resize', resizeView);
      if (delegateRef.current) {
        LAppDelegate.releaseInstance();
        delegateRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full h-full relative">
      {error && (
        <div className="absolute top-4 left-4 bg-red-100 text-red-700 p-2 rounded z-10 text-xs">
          {error}
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-gray-400 text-center">
            <div className="animate-pulse">
              <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-2"></div>
              <p className="text-xs">読み込み中...</p>
            </div>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          display: isLoading ? 'none' : 'block',
          pointerEvents: 'auto'
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};

export default Live2DContainedComponent;