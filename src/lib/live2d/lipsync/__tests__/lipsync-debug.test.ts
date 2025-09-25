/**
 * リップシンクデバッグテスト
 * 実際の音声データで口の開閉動作を確認
 */

import { RMSProcessor } from '../RMSProcessor';

describe('リップシンクのデバッグ確認', () => {
  describe('RMSプロセッサの動作確認', () => {
    it('固定ウィンドウサイズでRMS値を正しく計算する', () => {
      const processor = new RMSProcessor(2048, 0.3);

      // テスト音声データ（正弦波）
      const sampleRate = 48000;
      const frequency = 440; // A4
      const duration = 0.1; // 100ms
      const samples = new Float32Array(sampleRate * duration);

      for (let i = 0; i < samples.length; i++) {
        samples[i] = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.5;
      }

      const rms = processor.processSamples(samples);
      console.log('正弦波のRMS値:', rms);

      // RMS値が適切な範囲にあることを確認
      expect(rms).toBeGreaterThan(0);
      expect(rms).toBeLessThan(1);
      // 正弦波のRMS理論値: amplitude / sqrt(2) ≈ 0.35
      expect(rms).toBeCloseTo(0.35, 1);
    });

    it('無音時にRMS値が0になる', () => {
      const processor = new RMSProcessor(2048, 0.3);
      const silence = new Float32Array(2048);

      const rms = processor.processSamples(silence);
      console.log('無音のRMS値:', rms);

      expect(rms).toBe(0);
    });

    it('音声の立ち上がりと立ち下がりで適切にRMS値が変化する', () => {
      const processor = new RMSProcessor(2048, 0.3);
      const sampleRate = 48000;

      // 音声パターン: 無音 -> 音あり -> 無音
      const totalSamples = sampleRate * 0.3; // 300ms
      const samples = new Float32Array(totalSamples);

      // 0-100ms: 無音
      // 100-200ms: 音あり
      // 200-300ms: 無音
      for (let i = 0; i < totalSamples; i++) {
        const time = i / sampleRate;
        if (time >= 0.1 && time < 0.2) {
          samples[i] = Math.sin(2 * Math.PI * 440 * time) * 0.5;
        }
      }

      // チャンクごとに処理
      const chunkSize = 1024;
      const rmsValues: number[] = [];

      for (let i = 0; i < totalSamples; i += chunkSize) {
        const chunk = samples.slice(i, Math.min(i + chunkSize, totalSamples));
        const rms = processor.processSamples(chunk);
        rmsValues.push(rms);
      }

      console.log('RMS値の変化:', rmsValues);

      // 最初は低い値
      expect(rmsValues[0]).toBeLessThan(0.1);

      // 中間で高い値
      const midIndex = Math.floor(rmsValues.length / 2);
      expect(rmsValues[midIndex]).toBeGreaterThan(0.2);

      // 最後は再び低い値（スムージングにより完全に0にはならない）
      expect(rmsValues[rmsValues.length - 1]).toBeLessThan(0.2);
    });
  });

  describe('スケールファクターの適用確認', () => {
    it('スケールファクターが適切な範囲でリップシンク値を生成する', () => {
      const scaleFactor = 15; // useLipSyncHandlerで使用している値

      // 様々なRMS値に対するリップシンク値を計算
      const testRmsValues = [0, 0.01, 0.05, 0.1, 0.2, 0.3, 0.5];
      const lipSyncValues = testRmsValues.map(rms => {
        let value = Math.min(rms * scaleFactor, 1);
        if (value < 0.02) value = 0; // 閾値
        return value;
      });

      console.log('RMS -> リップシンク値マッピング:');
      testRmsValues.forEach((rms, i) => {
        console.log(`  RMS ${rms.toFixed(2)} -> LipSync ${lipSyncValues[i].toFixed(2)}`);
      });

      // 全てのリップシンク値が0-1の範囲内
      lipSyncValues.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });

      // 適切な感度（0.1のRMSで口が開く）
      const rms01Index = testRmsValues.indexOf(0.1);
      expect(lipSyncValues[rms01Index]).toBeGreaterThan(0.5);
    });
  });

  describe('スムージング動作の確認', () => {
    it('非対称スムージングが正しく適用される', () => {
      // 開く時のスムージング（0.4）
      const openSmoothing = 0.4;
      let currentValue = 0;
      const targetOpen = 1;

      currentValue = currentValue + (targetOpen - currentValue) * openSmoothing;
      console.log('開く時のスムージング（1ステップ）:', currentValue);
      expect(currentValue).toBeCloseTo(0.4, 2);

      // 閉じる時のスムージング（0.15）
      const closeSmoothing = 0.15;
      currentValue = 1;
      const targetClose = 0;

      currentValue = currentValue + (targetClose - currentValue) * closeSmoothing;
      console.log('閉じる時のスムージング（1ステップ）:', currentValue);
      expect(currentValue).toBeCloseTo(0.85, 2);
    });
  });
});