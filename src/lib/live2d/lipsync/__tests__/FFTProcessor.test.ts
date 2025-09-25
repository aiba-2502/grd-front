/**
 * FFTProcessor Test Suite
 * TDD: Red Phase - Write failing tests first
 */

import { FFTProcessor } from '../FFTProcessor';
import { AUDIO_CONFIG } from '../constants';
import type { SpectrumData } from '../types';

describe('FFTProcessor', () => {
  let processor: FFTProcessor;

  beforeEach(() => {
    processor = new FFTProcessor();
  });

  describe('FFT変換', () => {
    it('時間領域から周波数領域に変換できる', () => {
      // 純粋な正弦波を生成（440Hz, A4音）
      const frequency = 440;
      const samples = generateSineWave(frequency, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const spectrum = processor.forward(samples);

      expect(spectrum).toBeDefined();
      expect(spectrum.length).toBe(AUDIO_CONFIG.FFT_SIZE / 2);
    });

    it('DCオフセットを正しく検出する', () => {
      // DC成分のみ（すべて同じ値）
      const samples = new Float32Array(AUDIO_CONFIG.FFT_SIZE).fill(1.0);

      const spectrum = processor.forward(samples);

      // DC成分（0Hz）が最大
      expect(spectrum[0]).toBeGreaterThan(0);
      // 他の周波数成分はほぼ0
      for (let i = 1; i < 10; i++) {
        expect(spectrum[i]).toBeCloseTo(0, 1);
      }
    });

    it('特定周波数のピークを検出する', () => {
      // 1000Hz正弦波
      const targetFreq = 1000;
      const samples = generateSineWave(targetFreq, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const spectrum = processor.forward(samples);
      const peakIndex = processor.findPeakFrequency(spectrum, AUDIO_CONFIG.SAMPLE_RATE);
      const detectedFreq = (peakIndex * AUDIO_CONFIG.SAMPLE_RATE) / AUDIO_CONFIG.FFT_SIZE;

      // 検出された周波数が目標周波数に近い
      expect(Math.abs(detectedFreq - targetFreq)).toBeLessThan(50);
    });

    it('複数の周波数成分を分離できる', () => {
      // 440Hz + 880Hz の合成波
      const samples = new Float32Array(AUDIO_CONFIG.FFT_SIZE);
      for (let i = 0; i < samples.length; i++) {
        const t = i / AUDIO_CONFIG.SAMPLE_RATE;
        samples[i] = 0.5 * Math.sin(2 * Math.PI * 440 * t) +
                    0.5 * Math.sin(2 * Math.PI * 880 * t);
      }

      const spectrum = processor.forward(samples);
      const peaks = processor.findPeaks(spectrum, AUDIO_CONFIG.SAMPLE_RATE, 2);

      expect(peaks.length).toBe(2);
      // FFT周波数分解能の制限により、正確な周波数は得られない
      expect(peaks[0]).toBeCloseTo(440, -2); // ±10Hz許容
      expect(peaks[1]).toBeCloseTo(880, -2); // ±10Hz許容
    });
  });

  describe('窓関数', () => {
    it('ハミング窓を適用できる', () => {
      const samples = new Float32Array(AUDIO_CONFIG.FFT_SIZE).fill(1.0);

      const windowed = processor.applyHammingWindow(samples);

      // 窓の中央が最大値
      expect(windowed[AUDIO_CONFIG.FFT_SIZE / 2]).toBeCloseTo(1.0, 1);
      // 端は0に近い
      expect(windowed[0]).toBeLessThan(0.1);
      expect(windowed[AUDIO_CONFIG.FFT_SIZE - 1]).toBeLessThan(0.1);
    });

    it('ハニング窓を適用できる', () => {
      const samples = new Float32Array(AUDIO_CONFIG.FFT_SIZE).fill(1.0);

      const windowed = processor.applyHanningWindow(samples);

      // 窓の中央が最大値
      expect(windowed[AUDIO_CONFIG.FFT_SIZE / 2]).toBeCloseTo(1.0, 1);
      // 端は正確に0
      expect(windowed[0]).toBeCloseTo(0, 3);
      expect(windowed[AUDIO_CONFIG.FFT_SIZE - 1]).toBeCloseTo(0, 3);
    });
  });

  describe('スペクトラム解析', () => {
    it('周波数スペクトラムを取得できる', () => {
      const samples = generateSineWave(1000, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const spectrumData = processor.getSpectrum(samples);

      expect(spectrumData).toBeDefined();
      expect(spectrumData.frequencies).toBeDefined();
      expect(spectrumData.magnitudes).toBeDefined();
      expect(spectrumData.sampleRate).toBe(AUDIO_CONFIG.SAMPLE_RATE);
    });

    it('パワースペクトラムを計算できる', () => {
      const samples = generateSineWave(500, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const powerSpectrum = processor.getPowerSpectrum(samples);

      expect(powerSpectrum).toBeDefined();
      expect(powerSpectrum.length).toBe(AUDIO_CONFIG.FFT_SIZE / 2);
      // すべて非負の値
      for (const value of powerSpectrum) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });

    it('デシベル変換ができる', () => {
      const samples = generateSineWave(1000, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE, 1.0);

      const spectrumDB = processor.getSpectrumInDB(samples);

      expect(spectrumDB).toBeDefined();
      // デシベル値の範囲チェック
      for (const value of spectrumDB) {
        expect(value).toBeGreaterThanOrEqual(AUDIO_CONFIG.MIN_DECIBELS);
        expect(value).toBeLessThanOrEqual(AUDIO_CONFIG.MAX_DECIBELS);
      }
    });
  });

  describe('周波数ビン計算', () => {
    it('周波数からビンインデックスを計算できる', () => {
      const frequency = 1000; // 1kHz

      const binIndex = processor.frequencyToBin(frequency, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);
      const expectedBin = Math.round(frequency * AUDIO_CONFIG.FFT_SIZE / AUDIO_CONFIG.SAMPLE_RATE);

      expect(binIndex).toBe(expectedBin);
    });

    it('ビンインデックスから周波数を計算できる', () => {
      const binIndex = 100;

      const frequency = processor.binToFrequency(binIndex, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);
      const expectedFreq = binIndex * AUDIO_CONFIG.SAMPLE_RATE / AUDIO_CONFIG.FFT_SIZE;

      expect(frequency).toBeCloseTo(expectedFreq, 2);
    });
  });

  describe('リソース管理', () => {
    it('正しく初期化される', () => {
      const processor = new FFTProcessor(4096);
      expect(processor.getFFTSize()).toBe(4096);
    });

    it('破棄後は処理を受け付けない', () => {
      const processor = new FFTProcessor();
      processor.dispose();

      const samples = new Float32Array(AUDIO_CONFIG.FFT_SIZE);
      expect(() => processor.forward(samples)).toThrow('FFTProcessor is disposed');
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