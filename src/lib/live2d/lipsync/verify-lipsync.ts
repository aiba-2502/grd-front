/**
 * リップシンクの動作検証
 * 修正後の動作を確認するためのユーティリティ
 */

import { RMSProcessor } from './RMSProcessor';
import { logger } from '@/utils/logger';

export class LipSyncVerifier {
  private rmsProcessor: RMSProcessor;
  private scaleFactor: number = 8;
  private threshold: number = 0.02;

  constructor() {
    this.rmsProcessor = new RMSProcessor(2048, 0.3);
  }

  /**
   * 音声データからリップシンク値を計算
   */
  calculateLipSyncValue(pcmData: Float32Array, startIdx: number, endIdx: number): {
    rms: number;
    lipSyncValue: number;
    shouldOpenMouth: boolean;
  } {
    // 固定ウィンドウサイズでRMS計算
    const windowSize = 2048;
    const windowStart = Math.max(0, endIdx - windowSize);
    const windowEnd = endIdx;

    // RMS計算
    let rms = 0;
    let sampleCount = 0;
    for (let i = windowStart; i < windowEnd && i < pcmData.length; i++) {
      const sample = pcmData[i];
      rms += sample * sample;
      sampleCount++;
    }

    if (sampleCount > 0) {
      rms = Math.sqrt(rms / sampleCount);
    }

    // リップシンク値を計算
    let lipSyncValue = Math.min(rms * this.scaleFactor, 1);

    // 閾値以下は0にする
    if (lipSyncValue < this.threshold) {
      lipSyncValue = 0;
    }

    return {
      rms,
      lipSyncValue,
      shouldOpenMouth: lipSyncValue > 0
    };
  }

  /**
   * 期待される動作の検証
   */
  verifyExpectedBehavior(): {
    testCase: string;
    rms: number;
    expectedLipSync: number;
    actualLipSync: number;
    passed: boolean;
  }[] {
    const results = [];
    const testCases = [
      { name: '無音', rms: 0, expectedMin: 0, expectedMax: 0 },
      { name: 'ささやき声', rms: 0.03, expectedMin: 0.15, expectedMax: 0.30 },
      { name: '通常の会話', rms: 0.10, expectedMin: 0.60, expectedMax: 0.90 },
      { name: '大きな声', rms: 0.20, expectedMin: 1.00, expectedMax: 1.00 },
    ];

    for (const testCase of testCases) {
      let lipSyncValue = Math.min(testCase.rms * this.scaleFactor, 1);
      if (lipSyncValue < this.threshold) {
        lipSyncValue = 0;
      }

      const passed = lipSyncValue >= testCase.expectedMin && lipSyncValue <= testCase.expectedMax;

      results.push({
        testCase: testCase.name,
        rms: testCase.rms,
        expectedLipSync: (testCase.expectedMin + testCase.expectedMax) / 2,
        actualLipSync: lipSyncValue,
        passed
      });
    }

    return results;
  }

  /**
   * スムージングの検証
   */
  verifySmoothing(currentValue: number, targetValue: number, isIncreasing: boolean): {
    smoothingFactor: number;
    newValue: number;
    changeRate: number;
  } {
    const smoothingFactor = isIncreasing ? 0.4 : 0.15;
    const newValue = currentValue + (targetValue - currentValue) * smoothingFactor;
    const changeRate = Math.abs(newValue - currentValue);

    return {
      smoothingFactor,
      newValue,
      changeRate
    };
  }

  /**
   * 修正内容のサマリー
   */
  getSummary(): string {
    return `
=== リップシンク修正内容 ===

1. RMS計算の安定化:
   - 固定ウィンドウサイズ: 2048サンプル (約42ms @ 48kHz)
   - 小さすぎるサンプル数（48サンプル）での計算を回避

2. 感度設定の最適化:
   - スケールファクター: 8（以前の15や10000から大幅に改善）
   - 閾値: 0.02（微小なノイズを除外）

3. スムージングの改善:
   - 口を開く時: 0.4（速い反応）
   - 口を閉じる時: 0.15（滑らかな閉じ方）

4. 期待される動作:
   - 無音時: 口は完全に閉じる
   - ささやき声 (RMS ~0.03): わずかに開く
   - 通常会話 (RMS ~0.10): 適度に開く（70-80%）
   - 大きな声 (RMS ~0.20): 完全に開く

=== 修正前の問題 ===
- RMS計算が不安定（極小サンプル数）
- 感度が高すぎて口が開きっぱなし
- スムージングで口が閉じない

=== 修正後の改善 ===
- 安定したRMS値
- 音節ごとの適切な口の開閉
- 自然な口の動き
`;
  }
}

// エクスポート
export function verifyLipSyncFix(): void {
  const verifier = new LipSyncVerifier();

  logger.log('=== リップシンク修正の検証 ===');

  // 期待動作の確認
  const results = verifier.verifyExpectedBehavior();
  logger.table(results);

  // サマリー表示
  logger.log(verifier.getSummary());
}