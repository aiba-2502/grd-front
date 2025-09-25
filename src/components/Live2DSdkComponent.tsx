'use client';

import { LAppDelegate } from '@/lib/live2d/demo/lappdelegate';
import { LAppGlManager } from '@/lib/live2d/demo/lappglmanager';
import { useEffect, useRef, useCallback } from 'react';

function Live2DSdkComponent() {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const delegateRef = useRef<LAppDelegate | null>(null);

  // resizeView をuseCallbackでメモ化
  const resizeView = useCallback(() => {
    if (delegateRef.current) {
      delegateRef.current.onResize();
    }
  }, []);

  useEffect(() => {
    if (ref.current) {
      // Canvas要素を設定
      LAppGlManager.setCanvas(ref.current);

      // LAppDelegateのインスタンスを取得して初期化
      const appDelegateInstance = LAppDelegate.getInstance();
      if (appDelegateInstance.initialize()) {
        appDelegateInstance.run();
        delegateRef.current = appDelegateInstance;
      }

      // リサイズイベントリスナーを追加
      window.addEventListener('resize', resizeView);

      // マウスムーブイベントリスナーを追加（キャラクターが視線追従するため）
      const handleMouseMove = (e: MouseEvent) => {
        if (delegateRef.current) {
          // onMouseMoved メソッドを呼び出して視線追従を実現
          (delegateRef.current as any).onMouseMoved(e);
        }
      };

      // マウスが画面から離れた時の処理
      const handleMouseLeave = () => {
        if (delegateRef.current) {
          // 視線を中央に戻す
          const subdelegates = (delegateRef.current as any)._subdelegates;
          if (subdelegates) {
            for (let i = 0; i < subdelegates.getSize(); i++) {
              const subdelegate = subdelegates.at(i);
              if (subdelegate && subdelegate.getLive2DManager) {
                const manager = subdelegate.getLive2DManager();
                if (manager && manager.onMouseLeave) {
                  manager.onMouseLeave();
                }
              }
            }
          }
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseleave', handleMouseLeave);

      // クリーンアップ
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseleave', handleMouseLeave);
        window.removeEventListener('resize', resizeView);
        LAppDelegate.releaseInstance();
      };
    }

    return () => {
      window.removeEventListener('resize', resizeView);
      LAppDelegate.releaseInstance();
    };
  }, [resizeView]);

  return (
    <div id="live2d-container" className="w-screen h-screen fixed top-0 left-0 pointer-events-none z-0">
      <canvas
        ref={ref}
        className="w-full h-full"
        style={{ pointerEvents: 'auto' }}
      />
    </div>
  );
}

export default Live2DSdkComponent;