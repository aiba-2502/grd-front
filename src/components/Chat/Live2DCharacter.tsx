'use client';

import React, { useEffect, useRef, useState } from 'react';
import { NativeLive2DWrapper } from '@/lib/live2d/NativeLive2DWrapper';
import { logger } from '@/utils/logger';

interface Live2DCharacterProps {
  modelPath?: string;
  emotion?: 'Neutral' | 'Happy' | 'Sad' | 'Angry' | 'Relaxed' | 'Surprised';
  isSpeak?: boolean;
  audioUrl?: string; // For lip sync
}

export const Live2DCharacter: React.FC<Live2DCharacterProps> = ({
  modelPath = '/live2d/nike01/nike01.model3.json',
  emotion = 'Neutral',
  isSpeak = false,
  audioUrl
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<NativeLive2DWrapper | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);

  // 初期化
  useEffect(() => {
    const initializeLive2D = async () => {
      if (!containerRef.current) return;

      try {
        // Create wrapper
        const wrapper = new NativeLive2DWrapper();
        wrapperRef.current = wrapper;

        // Initialize
        const initialized = await wrapper.initialize(containerRef.current);
        if (!initialized) {
          logger.error('Failed to initialize Live2D wrapper');
          return;
        }

        setIsInitialized(true);

        // Load model
        const loaded = await wrapper.loadModel(modelPath);
        if (!loaded) {
          logger.error('Failed to load Live2D model');
          return;
        }

        setIsModelLoaded(true);

        // Start rendering
        wrapper.startRendering();

        // Set default expression
        wrapper.setExpression('default');

      } catch (error) {
        logger.error('Live2D initialization error:', error);
      }
    };

    initializeLive2D();

    // Cleanup
    return () => {
      if (wrapperRef.current) {
        wrapperRef.current.stopRendering();
        wrapperRef.current.dispose();
        wrapperRef.current = null;
      }
      setIsInitialized(false);
      setIsModelLoaded(false);
    };
  }, [modelPath]);

  // 感情の変更処理
  useEffect(() => {
    if (!isModelLoaded || !wrapperRef.current) return;

    try {
      // 感情に応じた表情を設定
      const expressionMap: Record<string, string> = {
        'Neutral': 'default',
        'Happy': 'happy',
        'Sad': 'sad',
        'Angry': 'angry',
        'Relaxed': 'relaxed',
        'Surprised': 'surprised'
      };

      const expressionId = expressionMap[emotion] || 'default';
      wrapperRef.current.setExpression(expressionId);

      // 感情に応じたモーションも再生（存在する場合）
      const motionPriority = 2; // Normal priority
      wrapperRef.current.startMotion(emotion, motionPriority);

    } catch (error) {
      logger.error('Failed to set emotion:', error);
    }
  }, [emotion, isModelLoaded]);

  // リップシンク処理
  useEffect(() => {
    if (!isModelLoaded || !wrapperRef.current) return;

    const handleLipSync = async () => {
      try {
        if (isSpeak && audioUrl) {
          // 音声ファイルからリップシンク
          await wrapperRef.current.startLipSync(audioUrl);
        } else if (isSpeak) {
          // 音声ファイルがない場合は簡単な口パクアニメーション
          let lipSyncValue = 0;
          const lipSyncInterval = setInterval(() => {
            lipSyncValue = Math.sin(Date.now() * 0.005) * 0.5 + 0.5;
            wrapperRef.current?.setLipSyncValue(lipSyncValue * 0.7);
          }, 50);

          return () => clearInterval(lipSyncInterval);
        } else {
          // 話していない時は口を閉じる
          wrapperRef.current.stopLipSync();
        }
      } catch (error) {
        logger.error('Lip sync error:', error);
      }
    };

    let cleanup: (() => void) | undefined;

    handleLipSync().then(result => {
      if (typeof result === 'function') {
        cleanup = result;
      }
    });

    return () => {
      if (cleanup && typeof cleanup === 'function') {
        cleanup();
      }
      if (wrapperRef.current) {
        wrapperRef.current.stopLipSync();
      }
    };
  }, [isSpeak, audioUrl, isModelLoaded]);

  // マウスインタラクション
  useEffect(() => {
    if (!isInitialized || !wrapperRef.current || !containerRef.current) return;

    const container = containerRef.current;

    const handleMouseMove = (e: MouseEvent) => {
      if (!wrapperRef.current || !container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      wrapperRef.current.onMouseMove(x, y);
    };

    const handleClick = (e: MouseEvent) => {
      if (!wrapperRef.current || !container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      wrapperRef.current.onTap(x, y);
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current || !container) return;

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      wrapperRef.current.onDragStart(x, y);
    };

    const handleMouseUp = () => {
      if (!wrapperRef.current) return;
      wrapperRef.current.onDragEnd();
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('click', handleClick);
    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseup', handleMouseUp);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('click', handleClick);
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isInitialized]);

  // ウィンドウリサイズ処理
  useEffect(() => {
    if (!isInitialized || !wrapperRef.current || !containerRef.current) return;

    const handleResize = () => {
      if (!wrapperRef.current || !containerRef.current) return;

      const width = containerRef.current.offsetWidth;
      const height = containerRef.current.offsetHeight;
      wrapperRef.current.resize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isInitialized]);

  return (
    <div
      ref={containerRef}
      className="live2d-character-container"
      style={{
        width: '300px',
        height: '400px',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {!isInitialized && (
        <div className="flex items-center justify-center h-full">
          <div className="text-gray-500">Loading Live2D...</div>
        </div>
      )}
    </div>
  );
};