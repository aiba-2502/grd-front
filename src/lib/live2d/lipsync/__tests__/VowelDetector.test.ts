/**
 * VowelDetector Test Suite
 * TDD: Red Phase - Write failing tests first
 */

import { VowelDetector } from '../VowelDetector';
import { VOWEL_FORMANTS } from '../constants';
import type { FormantData, VowelDetectionResult } from '../types';

describe('VowelDetector', () => {
  let detector: VowelDetector;

  beforeEach(() => {
    detector = new VowelDetector();
  });

  describe('Day 4: 母音パターン定義', () => {
    it('母音パターンを正しく定義する', () => {
      const patterns = detector.getPatterns();

      expect(patterns['a']).toEqual({
        f1: { min: 700, max: 900, center: 800 },
        f2: { min: 1200, max: 1600, center: 1400 }
      });

      expect(patterns['i']).toEqual({
        f1: { min: 250, max: 350, center: 300 },
        f2: { min: 2200, max: 2800, center: 2500 }
      });

      expect(patterns['u']).toEqual({
        f1: { min: 300, max: 400, center: 350 },
        f2: { min: 700, max: 1000, center: 850 }
      });

      expect(patterns['e']).toEqual({
        f1: { min: 400, max: 600, center: 500 },
        f2: { min: 1800, max: 2400, center: 2100 }
      });

      expect(patterns['o']).toEqual({
        f1: { min: 450, max: 600, center: 525 },
        f2: { min: 800, max: 1200, center: 1000 }
      });
    });

    it('閾値設定が正しく行われる', () => {
      const thresholds = detector.getThresholds();

      expect(thresholds.minConfidence).toBe(0.3);
      expect(thresholds.maxDistance).toBe(500);
      expect(thresholds.silenceThreshold).toBe(0.01);
    });

    it('カスタムパターンを設定できる', () => {
      const customPatterns = {
        a: {
          f1: { min: 650, max: 950, center: 800 },
          f2: { min: 1100, max: 1700, center: 1400 }
        }
      };

      detector.setCustomPatterns(customPatterns);
      const patterns = detector.getPatterns();

      expect(patterns['a'].f1.min).toBe(650);
      expect(patterns['a'].f1.max).toBe(950);
    });
  });

  describe('Day 5: 母音識別ロジック', () => {
    it('フォルマントから母音を識別する', () => {
      const formants: FormantData = { f1: 800, f2: 1400 };
      const result = detector.identify(formants);

      expect(result.vowel).toBe('a');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('母音「い」を正しく識別する', () => {
      const formants: FormantData = { f1: 300, f2: 2500 };
      const result = detector.identify(formants);

      expect(result.vowel).toBe('i');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('母音「う」を正しく識別する', () => {
      const formants: FormantData = { f1: 350, f2: 850 };
      const result = detector.identify(formants);

      expect(result.vowel).toBe('u');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('母音「え」を正しく識別する', () => {
      const formants: FormantData = { f1: 500, f2: 2100 };
      const result = detector.identify(formants);

      expect(result.vowel).toBe('e');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('母音「お」を正しく識別する', () => {
      const formants: FormantData = { f1: 525, f2: 1000 };
      const result = detector.identify(formants);

      expect(result.vowel).toBe('o');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('無音を検出する', () => {
      const formants: FormantData = { f1: 0, f2: 0 };
      const result = detector.identify(formants);

      expect(result.vowel).toBe('silent');
      expect(result.confidence).toBe(1.0);
    });

    it('曖昧な入力に対して複数候補を返す', () => {
      const formants: FormantData = { f1: 650, f2: 1100 }; // 「あ」と「お」の中間
      const result = detector.identify(formants);

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives.length).toBeGreaterThan(1);
      expect(result.alternatives[0].confidence).toBeGreaterThan(result.alternatives[1].confidence);
    });

    it('ユークリッド距離による類似度計算が正しい', () => {
      const distance = detector.calculateDistance(
        { f1: 800, f2: 1400 },
        { f1: 850, f2: 1450 }
      );

      expect(distance).toBeCloseTo(70.71, 1); // sqrt(50^2 + 50^2)
    });

    it('信頼度スコアが正しく算出される', () => {
      const confidence = detector.calculateConfidence(100); // 距離100
      expect(confidence).toBeGreaterThan(0.5);
      expect(confidence).toBeLessThan(0.6);

      const highConfidence = detector.calculateConfidence(10); // 距離10
      expect(highConfidence).toBeGreaterThan(0.9);

      const lowConfidence = detector.calculateConfidence(500); // 距離500
      expect(lowConfidence).toBeLessThan(0.1);
    });
  });

  describe('Day 6: 時系列処理', () => {
    it('連続音声から母音遷移を検出する', () => {
      const formantSequence: FormantData[] = [
        { f1: 800, f2: 1400 }, // a
        { f1: 300, f2: 2500 }, // i
        { f1: 350, f2: 850 },  // u
        { f1: 500, f2: 2100 }, // e
        { f1: 525, f2: 1000 }  // o
      ];

      const vowelSequence = detector.detectSequence(formantSequence);

      expect(vowelSequence).toEqual(['a', 'i', 'u', 'e', 'o']);
    });

    it('スライディングウィンドウ処理ができる', () => {
      const buffer = detector.createSlidingWindow(3); // サイズ3のウィンドウ

      buffer.push({ f1: 800, f2: 1400 });
      buffer.push({ f1: 810, f2: 1420 });
      buffer.push({ f1: 790, f2: 1410 });

      const averaged = buffer.getAveraged();
      expect(averaged.f1).toBeCloseTo(800, 0);
      expect(averaged.f2).toBeCloseTo(1410, 0);
    });

    it('状態遷移の平滑化ができる', () => {
      const smoother = detector.createStateSmoother();

      smoother.update('a');
      smoother.update('a');
      smoother.update('i'); // ノイズ
      smoother.update('a');
      smoother.update('a');

      const smoothed = smoother.getSmoothed();
      expect(smoothed).toBe('a'); // 最頻値
    });

    it('ヒステリシス処理で急激な変化を抑制する', () => {
      const hysteresis = detector.createHysteresis(0.3); // 閾値0.3

      const result1: VowelDetectionResult = {
        vowel: 'a',
        confidence: 0.9,
        alternatives: []
      };

      const result2: VowelDetectionResult = {
        vowel: 'i',
        confidence: 0.25, // 閾値未満
        alternatives: []
      };

      const result3: VowelDetectionResult = {
        vowel: 'i',
        confidence: 0.8, // 閾値以上
        alternatives: []
      };

      expect(hysteresis.process(result1).vowel).toBe('a');
      expect(hysteresis.process(result2).vowel).toBe('a'); // 変化なし
      expect(hysteresis.process(result3).vowel).toBe('i'); // 変化
    });

    it('連続した同じ母音を統合する', () => {
      const sequence: VowelDetectionResult[] = [
        { vowel: 'a', confidence: 0.9, alternatives: [] },
        { vowel: 'a', confidence: 0.8, alternatives: [] },
        { vowel: 'a', confidence: 0.85, alternatives: [] },
        { vowel: 'i', confidence: 0.9, alternatives: [] },
        { vowel: 'i', confidence: 0.88, alternatives: [] }
      ];

      const merged = detector.mergeConsecutive(sequence);

      expect(merged.length).toBe(2);
      expect(merged[0].vowel).toBe('a');
      expect(merged[0].duration).toBe(3);
      expect(merged[0].averageConfidence).toBeCloseTo(0.85, 2);
      expect(merged[1].vowel).toBe('i');
      expect(merged[1].duration).toBe(2);
      expect(merged[1].averageConfidence).toBeCloseTo(0.89, 2);
    });
  });

  describe('パフォーマンス最適化', () => {
    it('キャッシュを使用して高速化する', () => {
      const formants: FormantData = { f1: 800, f2: 1400 };

      // 1回目の識別
      const start1 = performance.now();
      const result1 = detector.identify(formants);
      const time1 = performance.now() - start1;

      // 2回目の識別（キャッシュ使用）
      const start2 = performance.now();
      const result2 = detector.identify(formants);
      const time2 = performance.now() - start2;

      expect(result1.vowel).toBe(result2.vowel);
      expect(time2).toBeLessThan(time1);
    });

    it('正しくリソースを解放できる', () => {
      detector.dispose();
      expect(() => detector.identify({ f1: 800, f2: 1400 }))
        .toThrow('VowelDetector is disposed');
    });
  });
});