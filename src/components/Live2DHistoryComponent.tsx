'use client';

import { useEffect, useRef, useState } from 'react';
import { NativeLive2DWrapper } from '@/lib/live2d/NativeLive2DWrapper';
import { usePathname } from 'next/navigation';
import { logger } from '@/utils/logger';

// 履歴画面専用のLive2D設定
const LIVE2D_CONFIG = {
  scale: 0.15,           // より小さく表示して枠内に収める
  horizontalOffset: 0,   // 中央に配置
  verticalOffset: 0,     // 垂直方向のオフセット
  width: 300,
  height: 400,
};

const Live2DHistoryComponent = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<NativeLive2DWrapper | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const setupLive2D = async () => {
      if (!containerRef.current) return;

      try {
        setIsLoading(true);
        setError(null);

        // Load Cubism Core first
        if (!(window as any).Live2DCubismCore) {
          const script = document.createElement('script');
          script.src = '/live2dcubismcore.min.js';
          script.async = true;

          try {
            await new Promise((resolve, reject) => {
              script.onload = resolve;
              script.onerror = reject;
              document.head.appendChild(script);
            });
          } catch (e) {
            logger.warn('Failed to load Cubism Core');
          }
        }

        // Create and initialize wrapper
        const wrapper = new NativeLive2DWrapper();
        wrapperRef.current = wrapper;

        const initialized = await wrapper.initialize(containerRef.current);
        if (!initialized) {
          throw new Error('Failed to initialize Live2D wrapper');
        }

        // Load model
        const modelPath = '/live2d/nike01/nike01.model3.json';
        const loaded = await wrapper.loadModel(modelPath);
        if (!loaded) {
          throw new Error('Failed to load Live2D model');
        }

        // Start rendering
        wrapper.startRendering();

        // Set initial animation
        wrapper.startMotion('Idle', 1);

        // Add greeting animation
        setTimeout(() => {
          wrapper.setExpression('happy');
          wrapper.startMotion('TapBody', 2);
        }, 1000);

        setIsLoading(false);

      } catch (err) {
        logger.error('Error setting up Live2D:', err);
        setError(err instanceof Error ? err.message : 'Failed to load Live2D');
        setIsLoading(false);
      }
    };

    setupLive2D();

    // Cleanup
    return () => {
      if (wrapperRef.current) {
        wrapperRef.current.stopRendering();
        wrapperRef.current.dispose();
        wrapperRef.current = null;
      }
    };
  }, []);

  // インタラクティブ機能
  useEffect(() => {
    if (isLoading || !wrapperRef.current || !containerRef.current) return;

    const container = containerRef.current;

    // マウストラッキング
    const handleMouseMove = (e: MouseEvent) => {
      if (!wrapperRef.current || !container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      wrapperRef.current.onMouseMove(x, y);
    };

    // タップ処理
    const handleClick = (e: MouseEvent) => {
      if (!wrapperRef.current || !container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // タップ位置に応じて異なるモーション
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      if (Math.abs(x - centerX) < 50 && Math.abs(y - centerY) < 100) {
        // 体の中心をタップ
        wrapperRef.current.startMotion('TapBody', 3);
        wrapperRef.current.setExpression('happy');
      } else if (y < rect.height * 0.3) {
        // 頭をタップ
        wrapperRef.current.startMotion('FlickHead', 3);
        wrapperRef.current.setExpression('surprised');
      } else {
        // その他の場所
        wrapperRef.current.startRandomMotion('Idle', 2);
      }

      wrapperRef.current.onTap(x, y);
    };

    // ホバー効果
    const handleMouseEnter = () => {
      if (!wrapperRef.current) return;
      wrapperRef.current.setExpression('happy');
    };

    const handleMouseLeave = () => {
      if (!wrapperRef.current) return;
      wrapperRef.current.setExpression('default');
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isLoading]);

  // 定期的なアイドルモーション
  useEffect(() => {
    if (isLoading || !wrapperRef.current) return;

    const idleInterval = setInterval(() => {
      if (!wrapperRef.current) return;

      // ランダムなアイドルモーション
      const random = Math.random();
      if (random < 0.3) {
        wrapperRef.current.startRandomMotion('Idle', 1);
      } else if (random < 0.5) {
        wrapperRef.current.setRandomExpression();
      }
    }, 5000);

    return () => clearInterval(idleInterval);
  }, [isLoading]);

  // ウィンドウリサイズ処理
  useEffect(() => {
    if (isLoading || !wrapperRef.current || !containerRef.current) return;

    const handleResize = () => {
      if (!wrapperRef.current || !containerRef.current) return;

      const newWidth = containerRef.current.offsetWidth;
      const newHeight = containerRef.current.offsetHeight;
      wrapperRef.current.resize(newWidth, newHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isLoading]);

  // 履歴画面以外では何も表示しない
  if (pathname !== '/history') {
    return null;
  }

  return (
    <div
      ref={containerRef}
      className="live2d-history-container"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: `${LIVE2D_CONFIG.width}px`,
        height: `${LIVE2D_CONFIG.height}px`,
        pointerEvents: 'auto',
        cursor: 'pointer',
        zIndex: 10,
        borderRadius: '12px',
        overflow: 'hidden',
        background: 'rgba(255, 255, 255, 0.05)',
        backdropFilter: 'blur(10px)',
        transition: 'transform 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1.0)';
      }}
    >
      {isLoading && (
        <div className="flex items-center justify-center h-full">
          <div className="text-white/70 text-sm">Loading assistant...</div>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-full">
          <div className="text-red-400 text-sm text-center px-4">
            {error}
          </div>
        </div>
      )}
    </div>
  );
};

export default Live2DHistoryComponent;