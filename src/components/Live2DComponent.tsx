'use client';

import { LAppDelegate } from '@/lib/live2d/demo/lappdelegate';
import { ScreenType } from '@/lib/live2d/demo/lappmodel';
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { logger } from '@/utils/logger';

interface Live2DComponentProps {
  disableMotions?: boolean; // 動作を無効化するフラグ（後方互換性のため残す）
  screenType?: ScreenType | string; // 画面タイプを明示的に指定（文字列も受け付ける）
}

const Live2DComponent = ({ disableMotions = false, screenType }: Live2DComponentProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const delegateRef = useRef<LAppDelegate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // resizeView 関数をuseEffect内で定義
    const resizeView = () => {
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
          // WASMのテーブル成長を許可するための設定
          (window as any).Module = {
            ALLOW_TABLE_GROWTH: 1,
            RESERVED_FUNCTION_POINTERS: 1000
          };

          const script = document.createElement('script');
          script.src = '/live2dcubismcore.min.js';
          script.async = false;

          await new Promise<void>((resolve, reject) => {
            script.onload = () => {
              // Live2DCubismCoreが正しくロードされたか確認
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
          // LAppDelegateのインスタンスを取得して、キャンバスで初期化
          const appDelegateInstance = LAppDelegate.getInstance();
          // 動作無効化フラグを設定
          if (disableMotions) {
            (appDelegateInstance as any).setDisableMotions(true);
          }
          if (appDelegateInstance.initializeWithCanvas(canvasRef.current)) {
            appDelegateInstance.run();
            delegateRef.current = appDelegateInstance;
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
      // delegateRefが存在する場合のみ解放
      if (delegateRef.current) {
        LAppDelegate.releaseInstance();
        delegateRef.current = null;
      }
    };
  }, []); // 空の依存配列にして、マウント時に一度だけ実行

  return (
    <div className="w-screen h-screen fixed top-0 left-0 pointer-events-none z-0">
      {error && (
        <div className="absolute top-20 left-4 bg-red-100 text-red-700 p-2 rounded z-10">
          {error}
        </div>
      )}
      {isLoading && (
        <div className="absolute top-20 right-4 bg-blue-100 text-blue-700 p-2 rounded z-10">
          Loading Live2D...
        </div>
      )}
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ pointerEvents: 'auto' }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
};

export default Live2DComponent;