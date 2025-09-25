'use client';

import { useEffect, useRef, useCallback } from 'react';
import { LAppWavFileHandler } from '@/lib/live2d/demo/lappwavfilehandler';
import { LAppDelegate } from '@/lib/live2d/demo/lappdelegate';
import { RMSProcessor } from '@/lib/live2d/lipsync/RMSProcessor';
import { logger } from '@/utils/logger';

// LAppDelegateの内部構造の型定義
interface DelegateWithSubdelegates {
  _subdelegates: {
    getSize: () => number;
    at: (index: number) => {
      getLive2DManager: () => {
        getModel: (index: number) => {
          setLipSyncValue: (value: number) => void;
        } | null;
      } | null;
    };
  };
}

export function useLipSyncHandler() {
  const wavFileHandlerRef = useRef<LAppWavFileHandler | null>(null);
  const rmsProcessorRef = useRef<RMSProcessor | null>(null);
  const isLipSyncingRef = useRef<boolean>(false);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioStartTimeRef = useRef<number>(0);
  const previousRmsRef = useRef<number>(0);
  const lastUpdateTimeRef = useRef<number>(0);
  const lastSampleOffsetRef = useRef<number>(0);
  const debugLogCountRef = useRef<number>(0);
  const rmsScaleFactorRef = useRef<number>(8); // バランスの取れた感度設定
  const rmsWindowSizeRef = useRef<number>(2048); // RMS計算のウィンドウサイズ

  useEffect(() => {
    // WAVファイルハンドラーとRMSプロセッサを初期化
    wavFileHandlerRef.current = new LAppWavFileHandler();
    rmsProcessorRef.current = new RMSProcessor(2048, 0.3); // 2048サンプル、スムージング係数0.3

    // クリーンアップ
    return () => {
      if (wavFileHandlerRef.current) {
        wavFileHandlerRef.current.releasePcmData();
        wavFileHandlerRef.current = null;
      }
      if (rmsProcessorRef.current) {
        rmsProcessorRef.current = null;
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * リップシンクを停止
   */
  const stopLipSync = useCallback(() => {
    isLipSyncingRef.current = false;
    previousRmsRef.current = 0;
    lastUpdateTimeRef.current = 0;
    lastSampleOffsetRef.current = 0;
    debugLogCountRef.current = 0;

    // RMSプロセッサをリセット
    if (rmsProcessorRef.current) {
      rmsProcessorRef.current.reset();
    }

    // 更新タイマーを停止
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
      updateIntervalRef.current = null;
    }

    // Live2Dモデルのリップシンク値をリセット
    try {
      const appDelegate = LAppDelegate.getInstance();
      // subdelegateを取得（通常最初の1つを使用）
      const subdelegates = (appDelegate as unknown as DelegateWithSubdelegates)._subdelegates;
      if (subdelegates && subdelegates.getSize() > 0) {
        const subdelegate = subdelegates.at(0);
        const manager = subdelegate.getLive2DManager();
        if (manager) {
          const model = manager.getModel(0);
          if (model) {
            model.setLipSyncValue(0);
          }
        }
      }
    } catch (error) {
      logger.error('リップシンク値のリセットエラー:', error);
    }
  }, []);

  /**
   * リップシンク値を更新
   */
  const updateLipSync = useCallback(() => {
    const updateInterval = 33; // 約30FPS (33ms間隔) - より滑らかな動作のため頻度を上げる

    const update = () => {
      if (!isLipSyncingRef.current) {
        return;
      }

      try {
        // Live2Dマネージャーを取得
        const appDelegate = LAppDelegate.getInstance();
        const subdelegates = (appDelegate as unknown as DelegateWithSubdelegates)._subdelegates;
        if (!subdelegates || subdelegates.getSize() === 0) {
          logger.error('Subdelegateが見つかりません');
          return;
        }

        const subdelegate = subdelegates.at(0);
        const manager = subdelegate.getLive2DManager();
        if (!manager) {
          logger.error('Live2Dマネージャーが見つかりません');
          return;
        }

        const model = manager.getModel(0);
        if (!model) {
          logger.error('Live2Dモデルが見つかりません');
          return;
        }

        // 安定したRMS値を計算
        if (wavFileHandlerRef.current && rmsProcessorRef.current) {
          // 現在時刻を取得
          const currentTime = Date.now();

          // 前回の更新からの差分時間を計算（秒単位）
          const deltaTime = lastUpdateTimeRef.current === 0
            ? updateInterval / 1000  // 初回は更新間隔を使用
            : (currentTime - lastUpdateTimeRef.current) / 1000;

          // 現在の更新時刻を記録
          lastUpdateTimeRef.current = currentTime;

          // 音声再生開始からの経過時間（デバッグ用）
          const totalElapsed = (currentTime - audioStartTimeRef.current) / 1000;

          // デバッグログを一定間隔でのみ出力（約100ms間隔 = 10FPS）
          debugLogCountRef.current++;
          const shouldLog = debugLogCountRef.current % 3 === 0;

          // WAVファイルハンドラーを更新してサンプル位置を進める
          const updated = wavFileHandlerRef.current.update(deltaTime);

          if (!updated) {
            logger.log('音声データ終了');
            stopLipSync();
            return;
          }

          // 現在のサンプル位置を取得
          const currentSampleOffset = wavFileHandlerRef.current._sampleOffset;
          const pcmData = wavFileHandlerRef.current._pcmData;
          const samplesPerChannel = wavFileHandlerRef.current._wavFileInfo?._samplesPerChannel || 0;

          // 新しいサンプルを取得してRMSプロセッサに送る
          if (pcmData && pcmData[0] && currentSampleOffset < samplesPerChannel) {
            // 前回の位置から現在位置までのサンプルを取得
            const startIdx = Math.floor(lastSampleOffsetRef.current);
            const endIdx = Math.min(Math.floor(currentSampleOffset), samplesPerChannel);

            // 固定サイズのウィンドウでRMSを計算
            const windowSize = 2048;
            const windowStart = Math.max(0, endIdx - windowSize);
            const windowEnd = endIdx;

            // ウィンドウ内のサンプルでRMS計算
            let rms = 0;
            let sampleCount = 0;
            for (let i = windowStart; i < windowEnd; i++) {
              const sample = pcmData[0][i]; // 最初のチャンネルのみ使用
              rms += sample * sample;
              sampleCount++;
            }

            if (sampleCount > 0) {
              rms = Math.sqrt(rms / sampleCount);
            }

            // RMS値の検証と正規化
            const validatedRms = isNaN(rms) || !isFinite(rms) ? 0 : Math.abs(rms);

            // スケーリング（感度調整）
            let targetRms = Math.min(validatedRms * rmsScaleFactorRef.current, 1);

            // 最小値の閾値設定（微小な値を除外）
            if (targetRms < 0.02) {  // より低い閾値
              targetRms = 0;
            }

            // スムージング処理（前の値との線形補間）
            // 上昇時と下降時で異なるスムージングファクターを使用
            const isIncreasing = targetRms > previousRmsRef.current;
            const smoothingFactor = isIncreasing ? 0.4 : 0.15; // 開く時は速く、閉じる時はより滑らか
            const smoothedRms = previousRmsRef.current + (targetRms - previousRmsRef.current) * smoothingFactor;
            previousRmsRef.current = smoothedRms;

            if (shouldLog) {
              logger.log('リップシンク値計算:', {
                windowStart,
                windowEnd,
                sampleCount,
                rawRms: validatedRms,
                targetRms,
                smoothedRms,
                totalElapsed
              });
            }

            // モデルにリップシンク値を設定
            model.setLipSyncValue(smoothedRms);

            // 現在のサンプル位置を記録
            lastSampleOffsetRef.current = currentSampleOffset;
          }
        }
      } catch (error) {
        logger.error('リップシンク更新エラー:', error);
      }
    };

    // 定期的に更新
    updateIntervalRef.current = setInterval(update, updateInterval);
  }, [stopLipSync]);

  /**
   * リップシンクを開始
   * @param audioUrl 音声ファイルのURL（WAV形式）
   */
  const startLipSync = useCallback(async (audioUrl: string): Promise<void> => {
    logger.log('useLipSyncHandler: リップシンク開始', {
      urlType: audioUrl.startsWith('data:') ? 'Base64 Data URL' : audioUrl.startsWith('blob:') ? 'Blob URL' : 'External URL',
      urlPreview: audioUrl.substring(0, 100),
      hasWavFileHandler: !!wavFileHandlerRef.current
    });

    // 既存のリップシンクを停止
    stopLipSync();

    if (!wavFileHandlerRef.current) {
      logger.error('リップシンク用のオブジェクトが初期化されていません');
      return;
    }

    try {
      isLipSyncingRef.current = true;

      // WAVファイルハンドラーを開始（start内部でloadWavFileが呼ばれる）
      // ただし、startメソッドはPromiseを返さないため、loadWavFileを直接呼ぶ必要がある
      const success = await wavFileHandlerRef.current.loadWavFile(audioUrl);
      if (!success) {
        logger.error('WAVファイルのロードに失敗しました');
        isLipSyncingRef.current = false;
        return;
      }

      logger.log('WAVファイルのロードに成功');

      // ロード後のWAVファイル情報を確認
      logger.log('WAVファイル情報:', {
        numberOfChannels: wavFileHandlerRef.current._wavFileInfo?._numberOfChannels,
        samplingRate: wavFileHandlerRef.current._wavFileInfo?._samplingRate,
        samplesPerChannel: wavFileHandlerRef.current._wavFileInfo?._samplesPerChannel,
        bitsPerSample: wavFileHandlerRef.current._wavFileInfo?._bitsPerSample,
        hasPcmData: !!wavFileHandlerRef.current._pcmData,
        pcmDataLength: wavFileHandlerRef.current._pcmData?.length,
        pcmDataChannelLength: wavFileHandlerRef.current._pcmData?.[0]?.length
      });

      // 最初のPCMサンプルデータを確認（デバッグ用）
      if (wavFileHandlerRef.current._pcmData && wavFileHandlerRef.current._pcmData[0]) {
        const pcmChannel = wavFileHandlerRef.current._pcmData[0];

        // PCMデータの範囲を簡単に確認
        let avgValue = 0;
        const sampleCount = Math.min(10000, pcmChannel.length);

        for (let i = 0; i < sampleCount; i++) {
          avgValue += Math.abs(pcmChannel[i]);
        }
        avgValue /= sampleCount;

        logger.log('PCMデータ確認:', {
          totalSamples: pcmChannel.length,
          avgAmplitude: avgValue
        });

        // 適切な固定感度を設定（自動調整は行わない）
        // 一般的な音声データに対して適切な値
        rmsScaleFactorRef.current = 8;
        logger.log('感度設定: 固定値', rmsScaleFactorRef.current);
      }

      // サンプル位置とRMS値をリセット（startメソッドの処理を直接実行）
      wavFileHandlerRef.current._sampleOffset = 0;
      wavFileHandlerRef.current._userTimeSeconds = 0.0;
      wavFileHandlerRef.current._lastRms = 0.0;

      // RMSプロセッサをリセット
      if (rmsProcessorRef.current) {
        rmsProcessorRef.current.reset();
      }

      // 音声再生開始時刻を記録（タイミング同期のため）
      audioStartTimeRef.current = Date.now();
      lastUpdateTimeRef.current = audioStartTimeRef.current; // 最初の更新時刻も記録
      lastSampleOffsetRef.current = 0; // サンプル位置もリセット
      logger.log('リップシンク開始時刻記録:', audioStartTimeRef.current);

      // リップシンク更新を開始
      updateLipSync();

      // 注意: 音声の再生はVoiceServiceが既に行っているため、
      // ここでは再生しない（二重再生を防ぐ）

    } catch (error) {
      logger.error('リップシンク開始エラー:', error);
      stopLipSync();
    }
  }, [stopLipSync, updateLipSync]);

  return {
    startLipSync,
    stopLipSync,
  };
}