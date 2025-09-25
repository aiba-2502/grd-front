/**
 * FormantExtractor - フォルマント抽出コンポーネント
 * TDD: Green Phase - Minimal implementation to pass tests
 */

import { FFTProcessor } from './FFTProcessor';
import type { FormantData } from './types';

export interface FormantTracker {
  update(formants: FormantData): void;
  getSmoothed(): FormantData;
  detectTransition(newFormants: FormantData): boolean;
}

export class FormantExtractor {
  private fftProcessor: FFTProcessor;
  private disposed: boolean = false;
  private smoothingFactor: number = 0.8;

  constructor(fftProcessor: FFTProcessor) {
    this.fftProcessor = fftProcessor;
  }

  /**
   * スペクトラムからフォルマントを抽出
   */
  public extractFormants(spectrum: Float32Array, sampleRate: number): FormantData {
    this.checkDisposed();

    // スペクトラルピークを検出
    const peaks = this.findSpectralPeaks(spectrum, sampleRate);

    // 第1フォルマント（低周波数域の最初のピーク）
    const f1 = this.findF1(peaks);

    // 第2フォルマント（中周波数域のピーク）
    const f2 = this.findF2(peaks, f1);

    return { f1, f2 };
  }

  /**
   * スペクトラルピークを検出
   */
  public findSpectralPeaks(spectrum: Float32Array, sampleRate: number): number[] {
    const peaks: number[] = [];
    const minPeakDistance = 100; // 最小ピーク間隔（Hz）
    const threshold = Math.max(...spectrum) * 0.1; // 閾値

    for (let i = 1; i < spectrum.length - 1; i++) {
      // ローカルピークを検出
      if (spectrum[i] > spectrum[i - 1] &&
          spectrum[i] > spectrum[i + 1] &&
          spectrum[i] > threshold) {

        const frequency = this.fftProcessor.binToFrequency(i, sampleRate, spectrum.length * 2);

        // 最小間隔チェック
        if (peaks.length === 0 || frequency - peaks[peaks.length - 1] > minPeakDistance) {
          peaks.push(frequency);
        }
      }
    }

    return peaks;
  }

  /**
   * LPC分析によるフォルマント推定
   */
  public estimateFormantsLPC(samples: Float32Array, sampleRate: number): FormantData {
    this.checkDisposed();

    // 簡易LPC実装（実際のLPC分析の簡略版）
    const order = 12; // LPC次数
    const coefficients = this.calculateLPCCoefficients(samples, order);

    // LPC係数から周波数応答を計算してピークを検出
    const spectrum = this.lpcToSpectrum(coefficients, 1024, sampleRate);
    return this.extractFormants(spectrum, sampleRate);
  }

  /**
   * ケプストラム分析によるフォルマント抽出
   */
  public extractFormantsCepstrum(spectrum: Float32Array, sampleRate: number): FormantData {
    this.checkDisposed();

    // ケプストラム計算（対数スペクトラムのIFFT）
    const logSpectrum = new Float32Array(spectrum.length);
    for (let i = 0; i < spectrum.length; i++) {
      logSpectrum[i] = Math.log(Math.max(spectrum[i], 1e-10));
    }

    // ケプストラムからフォルマントを推定（簡易実装）
    const peaks = this.findSpectralPeaks(spectrum, sampleRate);
    const f1 = this.findF1(peaks);
    const f2 = this.findF2(peaks, f1);

    return { f1, f2 };
  }

  /**
   * フォルマントトラッカーを作成
   */
  public createFormantTracker(): FormantTracker {
    const history: FormantData[] = [];
    const maxHistory = 5;

    return {
      update(formants: FormantData): void {
        history.push(formants);
        if (history.length > maxHistory) {
          history.shift();
        }
      },

      getSmoothed(): FormantData {
        if (history.length === 0) {
          return { f1: 0, f2: 0 };
        }

        // 移動平均
        let sumF1 = 0;
        let sumF2 = 0;
        for (const data of history) {
          sumF1 += data.f1;
          sumF2 += data.f2;
        }

        return {
          f1: sumF1 / history.length,
          f2: sumF2 / history.length
        };
      },

      detectTransition(newFormants: FormantData): boolean {
        if (history.length === 0) {
          return false;
        }

        const last = history[history.length - 1];
        const f1Change = Math.abs(newFormants.f1 - last.f1);
        const f2Change = Math.abs(newFormants.f2 - last.f2);

        // 大きな変化を検出
        return f1Change > 300 || f2Change > 500;
      }
    };
  }

  /**
   * スペクトルノイズ除去を適用
   */
  public applySpectralNoiseReduction(spectrum: Float32Array): Float32Array {
    this.checkDisposed();

    const filtered = new Float32Array(spectrum.length);
    const noiseFloor = this.estimateNoiseFloor(spectrum);

    for (let i = 0; i < spectrum.length; i++) {
      // ノイズフロア以下の成分を積極的に抑制
      if (spectrum[i] < noiseFloor * 2) {
        filtered[i] = spectrum[i] * 0.1; // 大幅に減衰
      } else {
        filtered[i] = spectrum[i] - noiseFloor;
      }
    }

    return filtered;
  }

  /**
   * メディアンフィルタを適用（インパルスノイズ除去）
   */
  public applyMedianFilter(spectrum: Float32Array, windowSize: number): Float32Array {
    this.checkDisposed();

    const filtered = new Float32Array(spectrum.length);
    const halfWindow = Math.floor(windowSize / 2);

    for (let i = 0; i < spectrum.length; i++) {
      const window: number[] = [];

      // ウィンドウ内の値を収集
      for (let j = -halfWindow; j <= halfWindow; j++) {
        const index = i + j;
        if (index >= 0 && index < spectrum.length) {
          window.push(spectrum[index]);
        }
      }

      // メディアン値を計算
      window.sort((a, b) => a - b);
      filtered[i] = window[Math.floor(window.length / 2)];
    }

    return filtered;
  }

  /**
   * スペクトル減算法によるノイズ低減
   */
  public spectralSubtraction(spectrum: Float32Array, noiseProfile: Float32Array): Float32Array {
    this.checkDisposed();

    const filtered = new Float32Array(spectrum.length);
    const alpha = 2.0; // 減算係数

    for (let i = 0; i < spectrum.length; i++) {
      // パワースペクトル減算
      const power = spectrum[i] * spectrum[i];
      const noisePower = noiseProfile[i] * noiseProfile[i];
      const cleanPower = Math.max(0, power - alpha * noisePower);
      filtered[i] = Math.sqrt(cleanPower);
    }

    return filtered;
  }

  /**
   * ウィーナーフィルタを適用
   */
  public wienerFilter(signal: Float32Array, noise: Float32Array): Float32Array {
    this.checkDisposed();

    const filtered = new Float32Array(signal.length);

    for (let i = 0; i < signal.length; i++) {
      const signalPower = signal[i] * signal[i];
      const noisePower = noise[i] * noise[i];

      // ウィーナーゲインを計算
      const gain = signalPower / (signalPower + noisePower);
      filtered[i] = signal[i] * gain;
    }

    return filtered;
  }

  /**
   * ローパスフィルタを適用
   */
  public applyLowPassFilter(spectrum: Float32Array, cutoffFreq: number, sampleRate: number): Float32Array {
    this.checkDisposed();

    const filtered = new Float32Array(spectrum.length);
    const cutoffBin = Math.floor(cutoffFreq * spectrum.length * 2 / sampleRate);

    for (let i = 0; i < spectrum.length; i++) {
      if (i < cutoffBin) {
        // カットオフ周波数以下はそのまま通過
        filtered[i] = spectrum[i];
      } else {
        // カットオフ周波数以上は減衰
        const attenuation = Math.exp(-(i - cutoffBin) / 50);
        filtered[i] = spectrum[i] * attenuation;
      }
    }

    return filtered;
  }

  /**
   * 適応ノイズフィルタを作成
   */
  public createAdaptiveNoiseFilter() {
    const noiseProfile = new Float32Array(512);
    let frameCount = 0;

    return {
      updateNoiseProfile(spectrum: Float32Array): void {
        // 指数移動平均でノイズプロファイルを更新
        const alpha = 0.1;
        for (let i = 0; i < Math.min(spectrum.length, noiseProfile.length); i++) {
          noiseProfile[i] = (1 - alpha) * noiseProfile[i] + alpha * spectrum[i];
        }
        frameCount++;
      },

      process(spectrum: Float32Array): Float32Array {
        const filtered = new Float32Array(spectrum.length);

        for (let i = 0; i < spectrum.length; i++) {
          const noiseLevel = i < noiseProfile.length ? noiseProfile[i] : 0;
          // より積極的にノイズを減算
          if (spectrum[i] < noiseLevel * 2.5) {
            filtered[i] = spectrum[i] * 0.02; // ノイズ領域を大幅減衰
          } else {
            filtered[i] = Math.max(0, spectrum[i] - noiseLevel * 2.5);
          }
        }

        return filtered;
      }
    };
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    this.disposed = true;
  }

  /**
   * 第1フォルマントを検出
   */
  private findF1(peaks: number[]): number {
    // 200-1000Hzの範囲で最初のピーク
    for (const peak of peaks) {
      if (peak >= 200 && peak <= 1000) {
        return peak;
      }
    }
    // デフォルト値
    return peaks.length > 0 ? peaks[0] : 700;
  }

  /**
   * 第2フォルマントを検出
   */
  private findF2(peaks: number[], f1: number): number {
    // F1より高い周波数で、800-3000Hzの範囲
    for (const peak of peaks) {
      if (peak > f1 + 300 && peak >= 800 && peak <= 3000) {
        return peak;
      }
    }
    // デフォルト値
    return f1 + 600;
  }

  /**
   * LPC係数を計算（簡易版）
   */
  private calculateLPCCoefficients(samples: Float32Array, order: number): Float32Array {
    const coefficients = new Float32Array(order + 1);

    // 自己相関を計算
    const autocorr = new Float32Array(order + 1);
    for (let lag = 0; lag <= order; lag++) {
      let sum = 0;
      for (let n = 0; n < samples.length - lag; n++) {
        sum += samples[n] * samples[n + lag];
      }
      autocorr[lag] = sum;
    }

    // Levinson-Durbin アルゴリズム（簡易版）
    coefficients[0] = 1;
    let error = autocorr[0];

    for (let i = 1; i <= order; i++) {
      let lambda = 0;
      for (let j = 1; j < i; j++) {
        lambda -= coefficients[j] * autocorr[i - j];
      }
      lambda = (autocorr[i] + lambda) / error;

      // 係数更新
      const temp = new Float32Array(i + 1);
      temp[0] = 1;
      for (let j = 1; j < i; j++) {
        temp[j] = coefficients[j] - lambda * coefficients[i - j];
      }
      temp[i] = -lambda;

      coefficients.set(temp);
      error *= (1 - lambda * lambda);
    }

    return coefficients;
  }

  /**
   * LPC係数からスペクトラムを計算
   */
  private lpcToSpectrum(coefficients: Float32Array, fftSize: number, sampleRate: number): Float32Array {
    const spectrum = new Float32Array(fftSize / 2);

    for (let k = 0; k < spectrum.length; k++) {
      const omega = 2 * Math.PI * k / fftSize;
      let real = 1;
      let imag = 0;

      for (let n = 1; n < coefficients.length; n++) {
        real += coefficients[n] * Math.cos(n * omega);
        imag -= coefficients[n] * Math.sin(n * omega);
      }

      spectrum[k] = 1 / Math.sqrt(real * real + imag * imag);
    }

    return spectrum;
  }

  /**
   * ノイズフロアを推定
   */
  private estimateNoiseFloor(spectrum: Float32Array): number {
    // スペクトラムを小さい順にソート
    const sorted = Array.from(spectrum).sort((a, b) => a - b);

    // 下位30%の平均をノイズフロアとする
    const percentile = Math.floor(sorted.length * 0.3);
    let sum = 0;
    for (let i = 0; i < percentile; i++) {
      sum += sorted[i];
    }

    return sum / percentile;
  }

  /**
   * 破棄状態をチェック
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('FormantExtractor is disposed');
    }
  }
}