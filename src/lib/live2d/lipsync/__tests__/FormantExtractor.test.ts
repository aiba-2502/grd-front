/**
 * FormantExtractor Test Suite
 * TDD: Red Phase - Write failing tests first
 */

import { FormantExtractor } from '../FormantExtractor';
import { FFTProcessor } from '../FFTProcessor';
import { AUDIO_CONFIG, VOWEL_FORMANTS } from '../constants';
import type { FormantData } from '../types';

describe('FormantExtractor', () => {
  let extractor: FormantExtractor;
  let fftProcessor: FFTProcessor;

  beforeEach(() => {
    fftProcessor = new FFTProcessor();
    extractor = new FormantExtractor(fftProcessor);
  });

  describe('フォルマント検出', () => {
    it('スペクトラムからフォルマントを抽出できる', () => {
      // テスト用の合成音声スペクトラム（母音「あ」を模擬）
      const spectrum = createVowelSpectrum('a', AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const formants = extractor.extractFormants(spectrum, AUDIO_CONFIG.SAMPLE_RATE);

      expect(formants).toBeDefined();
      expect(formants.f1).toBeGreaterThan(0);
      expect(formants.f2).toBeGreaterThan(0);
    });

    it('第1フォルマントを正しく検出する', () => {
      // F1 = 800Hz付近にピークを持つスペクトラム
      const spectrum = createFormantPeak(800, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const formants = extractor.extractFormants(spectrum, AUDIO_CONFIG.SAMPLE_RATE);

      // 800Hz付近を検出
      expect(formants.f1).toBeGreaterThan(700);
      expect(formants.f1).toBeLessThan(900);
    });

    it('第2フォルマントを正しく検出する', () => {
      // F1 = 800Hz, F2 = 1400Hz付近にピークを持つスペクトラム
      const spectrum = createDoubleFormantPeaks(800, 1400, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const formants = extractor.extractFormants(spectrum, AUDIO_CONFIG.SAMPLE_RATE);

      // F2を正しく検出
      expect(formants.f2).toBeGreaterThan(1300);
      expect(formants.f2).toBeLessThan(1500);
    });

    it('母音「あ」のフォルマントパターンを検出する', () => {
      const spectrum = createVowelSpectrum('a', AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const formants = extractor.extractFormants(spectrum, AUDIO_CONFIG.SAMPLE_RATE);

      // 「あ」の典型的なフォルマント
      expect(formants.f1).toBeGreaterThan(VOWEL_FORMANTS.a.f1.min);
      expect(formants.f1).toBeLessThan(VOWEL_FORMANTS.a.f1.max);
      expect(formants.f2).toBeGreaterThan(VOWEL_FORMANTS.a.f2.min);
      expect(formants.f2).toBeLessThan(VOWEL_FORMANTS.a.f2.max);
    });

    it('母音「い」のフォルマントパターンを検出する', () => {
      const spectrum = createVowelSpectrum('i', AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const formants = extractor.extractFormants(spectrum, AUDIO_CONFIG.SAMPLE_RATE);

      // 「い」の典型的なフォルマント
      expect(formants.f1).toBeGreaterThan(VOWEL_FORMANTS.i.f1.min);
      expect(formants.f1).toBeLessThan(VOWEL_FORMANTS.i.f1.max);
      expect(formants.f2).toBeGreaterThan(VOWEL_FORMANTS.i.f2.min);
      expect(formants.f2).toBeLessThan(VOWEL_FORMANTS.i.f2.max);
    });
  });

  describe('スペクトラル解析', () => {
    it('スペクトラルピークを検出できる', () => {
      const spectrum = createMultiplePeaks([500, 1000, 1500], AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const peaks = extractor.findSpectralPeaks(spectrum, AUDIO_CONFIG.SAMPLE_RATE);

      expect(peaks.length).toBeGreaterThan(0);
      // FFT\u5206\u89e3\u80fd\u306e\u5236\u9650\u3092\u8003\u616e
      expect(peaks.some(p => Math.abs(p - 500) < 50)).toBe(true);
      expect(peaks.some(p => Math.abs(p - 1000) < 50)).toBe(true);
      expect(peaks.some(p => Math.abs(p - 1500) < 50)).toBe(true);
    });

    it('LPC分析でフォルマントを推定できる', () => {
      const samples = generateVowelSound('a', AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const formants = extractor.estimateFormantsLPC(samples, AUDIO_CONFIG.SAMPLE_RATE);

      expect(formants).toBeDefined();
      expect(formants.f1).toBeGreaterThan(0);
      expect(formants.f2).toBeGreaterThan(0);
    });

    it('ケプストラム分析でフォルマントを検出できる', () => {
      const spectrum = createVowelSpectrum('a', AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const formants = extractor.extractFormantsCepstrum(spectrum, AUDIO_CONFIG.SAMPLE_RATE);

      expect(formants).toBeDefined();
      expect(formants.f1).toBeGreaterThan(0);
      expect(formants.f2).toBeGreaterThan(0);
    });
  });

  describe('フォルマント追跡', () => {
    it('時系列でフォルマントを追跡できる', () => {
      const tracker = extractor.createFormantTracker();

      // 複数フレームのフォルマントデータ
      const frame1: FormantData = { f1: 800, f2: 1400 };
      const frame2: FormantData = { f1: 810, f2: 1420 };
      const frame3: FormantData = { f1: 790, f2: 1410 };

      tracker.update(frame1);
      tracker.update(frame2);
      tracker.update(frame3);

      const smoothed = tracker.getSmoothed();

      // スムージングされた値が範囲内
      expect(smoothed.f1).toBeGreaterThan(790);
      expect(smoothed.f1).toBeLessThan(810);
      expect(smoothed.f2).toBeGreaterThan(1400);
      expect(smoothed.f2).toBeLessThan(1420);
    });

    it('フォルマントの急激な変化を検出できる', () => {
      const tracker = extractor.createFormantTracker();

      const frame1: FormantData = { f1: 800, f2: 1400 };
      const frame2: FormantData = { f1: 300, f2: 2500 }; // 急激な変化

      tracker.update(frame1);
      const hasTransition = tracker.detectTransition(frame2);

      expect(hasTransition).toBe(true);
    });
  });

  describe('ノイズフィルタリング', () => {
    it('スペクトルノイズ除去を適用できる', () => {
      const noisySpectrum = createNoisySpectrum(800, 1400, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      const filtered = extractor.applySpectralNoiseReduction(noisySpectrum);

      expect(filtered).toBeDefined();
      expect(filtered.length).toBe(noisySpectrum.length);

      // ノイズフロアが低減されている
      const avgNoise = calculateAverageNoise(filtered);
      const origNoise = calculateAverageNoise(noisySpectrum);
      expect(avgNoise).toBeLessThan(origNoise);
    });

    it('メディアンフィルタでインパルスノイズを除去できる', () => {
      const spectrum = createFormantPeak(1000, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);

      // インパルスノイズを追加
      spectrum[100] = 10.0;
      spectrum[200] = 10.0;

      const filtered = extractor.applyMedianFilter(spectrum, 5);

      // インパルスノイズが除去されている
      expect(filtered[100]).toBeLessThan(1.0);
      expect(filtered[200]).toBeLessThan(1.0);
    });

    it('スペクトル減算法でノイズを低減できる', () => {
      const cleanSpectrum = createDoubleFormantPeaks(800, 1400, AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);
      const noiseProfile = new Float32Array(cleanSpectrum.length).fill(0.1);
      const noisySpectrum = cleanSpectrum.map((v, i) => v + noiseProfile[i]);

      const filtered = extractor.spectralSubtraction(noisySpectrum, noiseProfile);

      // SNR改善を確認
      const snrBefore = calculateSNR(cleanSpectrum, noisySpectrum);
      const snrAfter = calculateSNR(cleanSpectrum, filtered);
      expect(snrAfter).toBeGreaterThan(snrBefore);
    });

    it('ウィーナーフィルタを適用できる', () => {
      const signal = createVowelSpectrum('a', AUDIO_CONFIG.SAMPLE_RATE, AUDIO_CONFIG.FFT_SIZE);
      const noise = new Float32Array(signal.length).fill(0.05);

      const filtered = extractor.wienerFilter(signal, noise);

      expect(filtered).toBeDefined();
      expect(filtered.length).toBe(signal.length);

      // 信号の主要成分が保持されている
      const peakIndices = findPeaks(signal);
      for (const idx of peakIndices) {
        expect(filtered[idx]).toBeGreaterThan(0);
      }
    });

    it('ローパスフィルタで高周波ノイズを除去できる', () => {
      const spectrum = new Float32Array(1024);
      // 低周波信号
      spectrum[10] = 1.0;
      spectrum[20] = 0.8;
      // 高周波ノイズ
      spectrum[500] = 0.5;
      spectrum[600] = 0.5;

      const filtered = extractor.applyLowPassFilter(spectrum, 3000, AUDIO_CONFIG.SAMPLE_RATE);

      // 低周波は保持、高周波は減衰
      expect(filtered[10]).toBeGreaterThan(0.8);
      expect(filtered[20]).toBeGreaterThan(0.6);
      expect(filtered[500]).toBeLessThan(0.1);
      expect(filtered[600]).toBeLessThan(0.1);
    });

    it('適応ノイズキャンセリングができる', () => {
      const tracker = extractor.createAdaptiveNoiseFilter();

      // ノイズプロファイルを学習
      const noiseFrame1 = new Float32Array(512).fill(0.1);
      const noiseFrame2 = new Float32Array(512).fill(0.12);
      tracker.updateNoiseProfile(noiseFrame1);
      tracker.updateNoiseProfile(noiseFrame2);

      // 信号+ノイズを処理
      const signal = createFormantPeak(1000, AUDIO_CONFIG.SAMPLE_RATE, 1024);
      const noisySignal = signal.map(v => v + 0.1);

      const filtered = tracker.process(noisySignal);

      // ノイズが低減されている
      const avgNoise = calculateAverageNoise(filtered);
      expect(avgNoise).toBeLessThan(0.05);
    });
  });

  describe('リソース管理', () => {
    it('正しく初期化される', () => {
      const extractor = new FormantExtractor(fftProcessor);
      expect(extractor).toBeDefined();
    });

    it('破棄後は処理を受け付けない', () => {
      const extractor = new FormantExtractor(fftProcessor);
      extractor.dispose();

      const spectrum = new Float32Array(1024);
      expect(() => extractor.extractFormants(spectrum, AUDIO_CONFIG.SAMPLE_RATE))
        .toThrow('FormantExtractor is disposed');
    });
  });
});

// Helper functions
function createFormantPeak(frequency: number, sampleRate: number, fftSize: number): Float32Array {
  const spectrum = new Float32Array(fftSize / 2);
  const binIndex = Math.round(frequency * fftSize / sampleRate);
  const bandwidth = 5; // ピークの幅

  for (let i = Math.max(0, binIndex - bandwidth); i < Math.min(spectrum.length, binIndex + bandwidth); i++) {
    const distance = Math.abs(i - binIndex);
    spectrum[i] = Math.exp(-distance * distance / (2 * bandwidth));
  }

  return spectrum;
}

function createDoubleFormantPeaks(f1: number, f2: number, sampleRate: number, fftSize: number): Float32Array {
  const spectrum1 = createFormantPeak(f1, sampleRate, fftSize);
  const spectrum2 = createFormantPeak(f2, sampleRate, fftSize);
  const combined = new Float32Array(fftSize / 2);

  for (let i = 0; i < combined.length; i++) {
    combined[i] = spectrum1[i] + spectrum2[i];
  }

  return combined;
}

function createVowelSpectrum(vowel: keyof typeof VOWEL_FORMANTS, sampleRate: number, fftSize: number): Float32Array {
  const formants = VOWEL_FORMANTS[vowel];
  return createDoubleFormantPeaks(
    formants.f1.center,
    formants.f2.center,
    sampleRate,
    fftSize
  );
}

function createMultiplePeaks(frequencies: number[], sampleRate: number, fftSize: number): Float32Array {
  const spectrum = new Float32Array(fftSize / 2);

  for (const freq of frequencies) {
    const peak = createFormantPeak(freq, sampleRate, fftSize);
    for (let i = 0; i < spectrum.length; i++) {
      spectrum[i] += peak[i];
    }
  }

  return spectrum;
}

function generateVowelSound(vowel: keyof typeof VOWEL_FORMANTS, sampleRate: number, length: number): Float32Array {
  const samples = new Float32Array(length);
  const formants = VOWEL_FORMANTS[vowel];

  // 簡単な合成音声（フォルマント周波数の正弦波の合成）
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    samples[i] = 0.5 * Math.sin(2 * Math.PI * formants.f1.center * t) +
                 0.5 * Math.sin(2 * Math.PI * formants.f2.center * t);
  }

  return samples;
}

function createNoisySpectrum(f1: number, f2: number, sampleRate: number, fftSize: number): Float32Array {
  const cleanSpectrum = createDoubleFormantPeaks(f1, f2, sampleRate, fftSize);
  const noisySpectrum = new Float32Array(cleanSpectrum.length);

  // ホワイトノイズを追加
  for (let i = 0; i < noisySpectrum.length; i++) {
    noisySpectrum[i] = cleanSpectrum[i] + (Math.random() - 0.5) * 0.1;
  }

  return noisySpectrum;
}

function calculateAverageNoise(spectrum: Float32Array): number {
  // 全体的なノイズレベルを計算（小さい値の平均）
  const sorted = Array.from(spectrum).sort((a, b) => a - b);
  const percentile = Math.floor(sorted.length * 0.5); // 下位50%

  let sum = 0;
  for (let i = 0; i < percentile; i++) {
    sum += Math.abs(sorted[i]);
  }

  return sum / percentile;
}

function calculateSNR(signal: Float32Array, noisy: Float32Array): number {
  let signalPower = 0;
  let noisePower = 0;

  for (let i = 0; i < signal.length; i++) {
    signalPower += signal[i] * signal[i];
    const noise = noisy[i] - signal[i];
    noisePower += noise * noise;
  }

  return noisePower > 0 ? 10 * Math.log10(signalPower / noisePower) : Infinity;
}

function findPeaks(spectrum: Float32Array): number[] {
  const peaks: number[] = [];

  for (let i = 1; i < spectrum.length - 1; i++) {
    if (spectrum[i] > spectrum[i - 1] && spectrum[i] > spectrum[i + 1] && spectrum[i] > 0.1) {
      peaks.push(i);
    }
  }

  return peaks;
}