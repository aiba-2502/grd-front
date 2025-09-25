/**
 * AudioAnalyzer Test Suite
 * TDD: Red Phase - Write failing tests first
 */

import { AudioAnalyzer } from '../AudioAnalyzer';
import { AUDIO_CONFIG, RMS_CONFIG } from '../constants';
import type { AudioAnalyzerConfig } from '../types';

describe('AudioAnalyzer', () => {
  let analyzer: AudioAnalyzer;

  beforeEach(() => {
    analyzer = new AudioAnalyzer();
  });

  describe('RMS計算', () => {
    describe('calculateRMS', () => {
      it('無音時は0を返す', () => {
        const samples = new Float32Array(128).fill(0);
        const rms = analyzer.calculateRMS(samples);
        expect(rms).toBe(0);
      });

      it('正弦波のRMS値を正しく計算する', () => {
        // 1kHz正弦波のサンプル生成（振幅1.0）
        const samples = generateSineWave(1000, AUDIO_CONFIG.SAMPLE_RATE, 128, 1.0);
        const rms = analyzer.calculateRMS(samples);
        // 正弦波のRMS値は振幅/√2 ≈ 0.707
        expect(rms).toBeCloseTo(0.707, 1);
      });

      it('矩形波のRMS値を正しく計算する', () => {
        // 振幅±1.0の矩形波
        const samples = new Float32Array(128);
        for (let i = 0; i < 64; i++) {
          samples[i] = 1.0;
          samples[i + 64] = -1.0;
        }
        const rms = analyzer.calculateRMS(samples);
        // 矩形波のRMS値は振幅と同じ
        expect(rms).toBeCloseTo(1.0, 2);
      });

      it('DCオフセットがある信号でも正しく計算する', () => {
        const samples = new Float32Array(128).fill(0.5);
        const rms = analyzer.calculateRMS(samples);
        expect(rms).toBeCloseTo(0.5, 2);
      });

      it('空配列の場合は0を返す', () => {
        const samples = new Float32Array(0);
        const rms = analyzer.calculateRMS(samples);
        expect(rms).toBe(0);
      });

      it('閾値以下の値は0として扱う', () => {
        const samples = new Float32Array(128).fill(RMS_CONFIG.MIN_THRESHOLD / 2);
        const rms = analyzer.calculateRMS(samples);
        expect(rms).toBe(0);
      });
    });

    describe('getRMSLevel', () => {
      it('正規化されたRMSレベルを返す（0-1の範囲）', () => {
        const samples = generateSineWave(1000, AUDIO_CONFIG.SAMPLE_RATE, 128, 0.5);
        const level = analyzer.getRMSLevel(samples);
        expect(level).toBeGreaterThanOrEqual(0);
        expect(level).toBeLessThanOrEqual(1);
      });

      it('最大振幅の信号で1を返す', () => {
        const samples = new Float32Array(128).fill(1.0);
        const level = analyzer.getRMSLevel(samples);
        expect(level).toBe(1);
      });
    });
  });

  describe('音声バッファ管理', () => {
    describe('processAudioBuffer', () => {
      it('音声バッファを正しく処理する', () => {
        const buffer = new Float32Array(AUDIO_CONFIG.FFT_SIZE).fill(0.5);
        const features = analyzer.processAudioBuffer(buffer);

        expect(features).toBeDefined();
        expect(features.rms).toBeGreaterThan(0);
        expect(features.spectrum).toBeDefined();
        expect(features.spectrum.length).toBe(AUDIO_CONFIG.FFT_SIZE / 2);
        expect(features.timestamp).toBeGreaterThan(0);
      });

      it('複数チャンネルの平均を計算する', () => {
        const leftChannel = new Float32Array(128).fill(0.5);
        const rightChannel = new Float32Array(128).fill(0.3);
        const features = analyzer.processMultiChannelBuffer([leftChannel, rightChannel]);

        expect(features.rms).toBeCloseTo(0.4, 1);
      });
    });

    describe('バッファサイズ管理', () => {
      it('指定されたバッファサイズを保持する', () => {
        const config: AudioAnalyzerConfig = {
          fftSize: 1024
        };
        const analyzer = new AudioAnalyzer(config);

        expect(analyzer.getBufferSize()).toBe(1024);
      });

      it('デフォルトのバッファサイズを使用する', () => {
        const analyzer = new AudioAnalyzer();
        expect(analyzer.getBufferSize()).toBe(AUDIO_CONFIG.FFT_SIZE);
      });
    });
  });

  describe('初期化とクリーンアップ', () => {
    it('正しく初期化される', () => {
      const analyzer = new AudioAnalyzer();
      expect(analyzer.isInitialized()).toBe(true);
    });

    it('リソースを解放できる', () => {
      const analyzer = new AudioAnalyzer();
      analyzer.dispose();
      expect(analyzer.isInitialized()).toBe(false);
    });

    it('dispose後は処理を受け付けない', () => {
      const analyzer = new AudioAnalyzer();
      analyzer.dispose();

      const samples = new Float32Array(128).fill(0.5);
      expect(() => analyzer.calculateRMS(samples)).toThrow('AudioAnalyzer is disposed');
    });
  });

  describe('設定管理', () => {
    it('カスタム設定を受け付ける', () => {
      const config: AudioAnalyzerConfig = {
        fftSize: 4096,
        sampleRate: 44100,
        smoothingTimeConstant: 0.9
      };

      const analyzer = new AudioAnalyzer(config);
      const currentConfig = analyzer.getConfig();

      expect(currentConfig.fftSize).toBe(4096);
      expect(currentConfig.sampleRate).toBe(44100);
      expect(currentConfig.smoothingTimeConstant).toBe(0.9);
    });

    it('不正な設定値を検証する', () => {
      const config: AudioAnalyzerConfig = {
        fftSize: 100, // 2の累乗でない
        sampleRate: -1, // 負の値
        smoothingTimeConstant: 2.0 // 範囲外
      };

      expect(() => new AudioAnalyzer(config)).toThrow();
    });
  });

  describe('スムージング処理', () => {
    it('RMS値をスムージングする', () => {
      const analyzer = new AudioAnalyzer({
        smoothingTimeConstant: 0.8
      });

      // 急激な変化をスムージング
      const samples1 = new Float32Array(128).fill(0);
      const samples2 = new Float32Array(128).fill(1);

      const rms1 = analyzer.calculateSmoothedRMS(samples1);
      const rms2 = analyzer.calculateSmoothedRMS(samples2);

      // スムージングにより急激な変化が緩和される
      expect(rms2).toBeLessThan(1);
      expect(rms2).toBeGreaterThan(0);
      expect(rms1).toBe(0); // 最初の値の確認
    });

    it('連続した同じ値は変化しない', () => {
      const analyzer = new AudioAnalyzer();
      const samples = new Float32Array(128).fill(0.5);

      // 複数回実行して収束させる
      let rms = 0;
      for (let i = 0; i < 10; i++) {
        rms = analyzer.calculateSmoothedRMS(samples);
      }

      // 最終的に入力値に収束
      expect(Math.abs(rms - 0.5)).toBeLessThan(0.1);
    });
  });
});

// Helper functions
function generateSineWave(
  frequency: number,
  sampleRate: number,
  length: number,
  amplitude: number = 1.0
): Float32Array {
  const samples = new Float32Array(length);
  const omega = 2 * Math.PI * frequency / sampleRate;

  for (let i = 0; i < length; i++) {
    samples[i] = amplitude * Math.sin(omega * i);
  }

  return samples;
}

// Custom matchers
expect.extend({
  toBeInRange(received: number, min: number, max: number) {
    const pass = received >= min && received <= max;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${min} - ${max}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${min} - ${max}`,
        pass: false,
      };
    }
  },
});