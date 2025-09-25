/**
 * VowelDetector - 母音識別コンポーネント
 * TDD: Green Phase - Minimal implementation to pass tests
 */

import { VOWEL_FORMANTS } from './constants';
import type { FormantData, VowelDetectionResult } from './types';

export interface VowelPattern {
  f1: { min: number; max: number; center: number };
  f2: { min: number; max: number; center: number };
}

export interface Thresholds {
  minConfidence: number;
  maxDistance: number;
  silenceThreshold: number;
}

export interface SlidingWindow {
  push(formants: FormantData): void;
  getAveraged(): FormantData;
}

export interface StateSmoother {
  update(vowel: string): void;
  getSmoothed(): string;
}

export interface Hysteresis {
  process(result: VowelDetectionResult): VowelDetectionResult;
}

export interface MergedVowel {
  vowel: string;
  duration: number;
  averageConfidence: number;
}

export class VowelDetector {
  private patterns: Record<string, VowelPattern>;
  private thresholds: Thresholds;
  private cache: Map<string, VowelDetectionResult>;
  private disposed: boolean = false;

  constructor() {
    // デフォルトのパターンを設定
    this.patterns = { ...VOWEL_FORMANTS };

    // 閾値の設定
    this.thresholds = {
      minConfidence: 0.3,
      maxDistance: 500,
      silenceThreshold: 0.01
    };

    // キャッシュの初期化
    this.cache = new Map();
  }

  /**
   * 母音パターンを取得
   */
  public getPatterns(): Record<string, VowelPattern> {
    return { ...this.patterns };
  }

  /**
   * 閾値を取得
   */
  public getThresholds(): Thresholds {
    return { ...this.thresholds };
  }

  /**
   * カスタムパターンを設定
   */
  public setCustomPatterns(patterns: Partial<Record<string, VowelPattern>>): void {
    this.patterns = { ...this.patterns, ...patterns };
    this.cache.clear(); // キャッシュをクリア
  }

  /**
   * フォルマントから母音を識別
   */
  public identify(formants: FormantData): VowelDetectionResult {
    this.checkDisposed();

    // キャッシュチェック
    const cacheKey = `${formants.f1}_${formants.f2}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 無音判定
    if (formants.f1 < this.thresholds.silenceThreshold &&
        formants.f2 < this.thresholds.silenceThreshold) {
      const result: VowelDetectionResult = {
        vowel: 'silent',
        confidence: 1.0,
        alternatives: []
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    // 各母音との距離を計算
    const distances: Array<{ vowel: string; distance: number; confidence: number }> = [];

    for (const [vowel, pattern] of Object.entries(this.patterns)) {
      const distance = this.calculateDistance(
        formants,
        { f1: pattern.f1.center, f2: pattern.f2.center }
      );
      const confidence = this.calculateConfidence(distance);

      distances.push({ vowel, distance, confidence });
    }

    // 距離でソート
    distances.sort((a, b) => a.distance - b.distance);

    // 最も近い母音を選択
    const best = distances[0];

    // 代替候補を作成
    const alternatives = distances.slice(1, 3).map(d => ({
      vowel: d.vowel,
      confidence: d.confidence
    }));

    const result: VowelDetectionResult = {
      vowel: best.vowel as 'a' | 'i' | 'u' | 'e' | 'o' | 'silent',
      confidence: best.confidence,
      alternatives
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  /**
   * ユークリッド距離を計算
   */
  public calculateDistance(formants1: FormantData, formants2: FormantData): number {
    const df1 = formants1.f1 - formants2.f1;
    const df2 = formants1.f2 - formants2.f2;
    return Math.sqrt(df1 * df1 + df2 * df2);
  }

  /**
   * 信頼度スコアを計算
   */
  public calculateConfidence(distance: number): number {
    // 指数関数的減衰（調整済み）
    const confidence = Math.exp(-distance / 150);
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * 連続音声から母音列を検出
   */
  public detectSequence(formantSequence: FormantData[]): string[] {
    const vowelSequence: string[] = [];

    for (const formants of formantSequence) {
      const result = this.identify(formants);
      vowelSequence.push(result.vowel);
    }

    return vowelSequence;
  }

  /**
   * スライディングウィンドウを作成
   */
  public createSlidingWindow(size: number): SlidingWindow {
    const buffer: FormantData[] = [];

    return {
      push(formants: FormantData): void {
        buffer.push(formants);
        if (buffer.length > size) {
          buffer.shift();
        }
      },

      getAveraged(): FormantData {
        if (buffer.length === 0) {
          return { f1: 0, f2: 0 };
        }

        let sumF1 = 0;
        let sumF2 = 0;
        for (const data of buffer) {
          sumF1 += data.f1;
          sumF2 += data.f2;
        }

        return {
          f1: sumF1 / buffer.length,
          f2: sumF2 / buffer.length
        };
      }
    };
  }

  /**
   * 状態スムーサーを作成
   */
  public createStateSmoother(): StateSmoother {
    const history: string[] = [];
    const historySize = 5;

    return {
      update(vowel: string): void {
        history.push(vowel);
        if (history.length > historySize) {
          history.shift();
        }
      },

      getSmoothed(): string {
        if (history.length === 0) {
          return 'silent';
        }

        // 最頻値を計算
        const counts = new Map<string, number>();
        for (const vowel of history) {
          counts.set(vowel, (counts.get(vowel) || 0) + 1);
        }

        let maxCount = 0;
        let mostFrequent = history[history.length - 1];
        for (const [vowel, count] of counts.entries()) {
          if (count > maxCount) {
            maxCount = count;
            mostFrequent = vowel;
          }
        }

        return mostFrequent;
      }
    };
  }

  /**
   * ヒステリシスを作成
   */
  public createHysteresis(threshold: number): Hysteresis {
    let currentVowel: string | null = null;

    return {
      process(result: VowelDetectionResult): VowelDetectionResult {
        // 初回または高信頼度の場合は更新
        if (currentVowel === null || result.confidence >= threshold) {
          currentVowel = result.vowel;
          return result;
        }

        // 低信頼度の場合は現在の状態を維持
        return {
          ...result,
          vowel: currentVowel as 'a' | 'i' | 'u' | 'e' | 'o' | 'silent'
        };
      }
    };
  }

  /**
   * 連続した同じ母音を統合
   */
  public mergeConsecutive(sequence: VowelDetectionResult[]): MergedVowel[] {
    if (sequence.length === 0) {
      return [];
    }

    const merged: MergedVowel[] = [];
    let currentVowel = sequence[0].vowel;
    let duration = 1;
    let confidenceSum = sequence[0].confidence;

    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i].vowel === currentVowel) {
        duration++;
        confidenceSum += sequence[i].confidence;
      } else {
        // 現在の母音を追加
        merged.push({
          vowel: currentVowel,
          duration,
          averageConfidence: confidenceSum / duration
        });

        // 新しい母音を開始
        currentVowel = sequence[i].vowel;
        duration = 1;
        confidenceSum = sequence[i].confidence;
      }
    }

    // 最後の母音を追加
    merged.push({
      vowel: currentVowel,
      duration,
      averageConfidence: confidenceSum / duration
    });

    return merged;
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    this.disposed = true;
    this.cache.clear();
  }

  /**
   * 破棄状態をチェック
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('VowelDetector is disposed');
    }
  }
}