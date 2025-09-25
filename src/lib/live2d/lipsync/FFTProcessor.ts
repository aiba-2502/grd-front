/**
 * FFTProcessor - Fast Fourier Transform処理コンポーネント
 * TDD: Green Phase - Minimal implementation to pass tests
 */

import { AUDIO_CONFIG } from './constants';
import type { SpectrumData } from './types';

export class FFTProcessor {
  private fftSize: number;
  private disposed: boolean = false;
  private hammingWindow: Float32Array;
  private hanningWindow: Float32Array;
  private realBuffer: Float32Array;
  private imagBuffer: Float32Array;

  constructor(fftSize: number = AUDIO_CONFIG.FFT_SIZE) {
    this.fftSize = fftSize;
    this.validateFFTSize(fftSize);

    // 窓関数を事前計算
    this.hammingWindow = this.precomputeHammingWindow();
    this.hanningWindow = this.precomputeHanningWindow();

    // FFT用バッファ
    this.realBuffer = new Float32Array(fftSize);
    this.imagBuffer = new Float32Array(fftSize);
  }

  /**
   * FFT変換を実行
   */
  public forward(samples: Float32Array): Float32Array {
    this.checkDisposed();

    if (samples.length !== this.fftSize) {
      throw new Error(`Input size must be ${this.fftSize}, got ${samples.length}`);
    }

    // 入力をコピー
    this.realBuffer.set(samples);
    this.imagBuffer.fill(0);

    // Cooley-Tukey FFTアルゴリズム
    this.fft(this.realBuffer, this.imagBuffer);

    // マグニチュードを計算
    const spectrum = new Float32Array(this.fftSize / 2);
    for (let i = 0; i < spectrum.length; i++) {
      const real = this.realBuffer[i];
      const imag = this.imagBuffer[i];
      spectrum[i] = Math.sqrt(real * real + imag * imag);
    }

    return spectrum;
  }

  /**
   * ピーク周波数を検出
   */
  public findPeakFrequency(spectrum: Float32Array, sampleRate: number): number {
    let maxValue = 0;
    let maxIndex = 0;

    // DC成分をスキップ
    for (let i = 1; i < spectrum.length; i++) {
      if (spectrum[i] > maxValue) {
        maxValue = spectrum[i];
        maxIndex = i;
      }
    }

    return maxIndex;
  }

  /**
   * 複数のピークを検出
   */
  public findPeaks(spectrum: Float32Array, sampleRate: number, count: number): number[] {
    const peaks: Array<{ index: number; value: number }> = [];

    // ローカルピークを検出
    for (let i = 1; i < spectrum.length - 1; i++) {
      if (spectrum[i] > spectrum[i - 1] && spectrum[i] > spectrum[i + 1]) {
        peaks.push({ index: i, value: spectrum[i] });
      }
    }

    // 値でソートして上位N個を取得
    peaks.sort((a, b) => b.value - a.value);

    return peaks
      .slice(0, count)
      .map(peak => this.binToFrequency(peak.index, sampleRate, this.fftSize));
  }

  /**
   * ハミング窓を適用
   */
  public applyHammingWindow(samples: Float32Array): Float32Array {
    const windowed = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      windowed[i] = samples[i] * this.hammingWindow[i];
    }

    return windowed;
  }

  /**
   * ハニング窓を適用
   */
  public applyHanningWindow(samples: Float32Array): Float32Array {
    const windowed = new Float32Array(samples.length);

    for (let i = 0; i < samples.length; i++) {
      windowed[i] = samples[i] * this.hanningWindow[i];
    }

    return windowed;
  }

  /**
   * スペクトラムデータを取得
   */
  public getSpectrum(samples: Float32Array): SpectrumData {
    const magnitudes = this.forward(samples);
    const frequencies = new Float32Array(magnitudes.length);

    for (let i = 0; i < frequencies.length; i++) {
      frequencies[i] = this.binToFrequency(i, AUDIO_CONFIG.SAMPLE_RATE, this.fftSize);
    }

    return {
      frequencies,
      magnitudes,
      sampleRate: AUDIO_CONFIG.SAMPLE_RATE
    };
  }

  /**
   * パワースペクトラムを計算
   */
  public getPowerSpectrum(samples: Float32Array): Float32Array {
    const spectrum = this.forward(samples);
    const powerSpectrum = new Float32Array(spectrum.length);

    for (let i = 0; i < spectrum.length; i++) {
      powerSpectrum[i] = spectrum[i] * spectrum[i];
    }

    return powerSpectrum;
  }

  /**
   * デシベル変換
   */
  public getSpectrumInDB(samples: Float32Array): Float32Array {
    const spectrum = this.forward(samples);
    const spectrumDB = new Float32Array(spectrum.length);

    for (let i = 0; i < spectrum.length; i++) {
      // 20 * log10(magnitude)
      const db = 20 * Math.log10(Math.max(spectrum[i], 1e-10));
      // クリップ
      spectrumDB[i] = Math.max(AUDIO_CONFIG.MIN_DECIBELS,
                               Math.min(AUDIO_CONFIG.MAX_DECIBELS, db));
    }

    return spectrumDB;
  }

  /**
   * 周波数からビンインデックスを計算
   */
  public frequencyToBin(frequency: number, sampleRate: number, fftSize: number): number {
    return Math.round(frequency * fftSize / sampleRate);
  }

  /**
   * ビンインデックスから周波数を計算
   */
  public binToFrequency(bin: number, sampleRate: number, fftSize: number): number {
    return bin * sampleRate / fftSize;
  }

  /**
   * FFTサイズを取得
   */
  public getFFTSize(): number {
    return this.fftSize;
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    this.disposed = true;
  }

  /**
   * Cooley-Tukey FFT実装
   */
  private fft(real: Float32Array, imag: Float32Array): void {
    const n = real.length;

    // ビットリバース
    this.bitReverse(real, imag);

    // Cooley-Tukey アルゴリズム
    for (let size = 2; size <= n; size *= 2) {
      const halfSize = size / 2;
      const angleStep = -2 * Math.PI / size;

      for (let start = 0; start < n; start += size) {
        for (let i = 0; i < halfSize; i++) {
          const angle = angleStep * i;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);

          const i1 = start + i;
          const i2 = start + i + halfSize;

          const tempReal = real[i2] * cos - imag[i2] * sin;
          const tempImag = real[i2] * sin + imag[i2] * cos;

          real[i2] = real[i1] - tempReal;
          imag[i2] = imag[i1] - tempImag;
          real[i1] = real[i1] + tempReal;
          imag[i1] = imag[i1] + tempImag;
        }
      }
    }
  }

  /**
   * ビットリバース並び替え
   */
  private bitReverse(real: Float32Array, imag: Float32Array): void {
    const n = real.length;
    const halfN = n / 2;

    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        // Swap
        const tempReal = real[i];
        real[i] = real[j];
        real[j] = tempReal;

        const tempImag = imag[i];
        imag[i] = imag[j];
        imag[j] = tempImag;
      }

      let k = halfN;
      while (k <= j) {
        j -= k;
        k /= 2;
      }
      j += k;
    }
  }

  /**
   * ハミング窓を事前計算
   */
  private precomputeHammingWindow(): Float32Array {
    const window = new Float32Array(this.fftSize);

    for (let i = 0; i < this.fftSize; i++) {
      window[i] = 0.54 - 0.46 * Math.cos(2 * Math.PI * i / (this.fftSize - 1));
    }

    return window;
  }

  /**
   * ハニング窓を事前計算
   */
  private precomputeHanningWindow(): Float32Array {
    const window = new Float32Array(this.fftSize);

    for (let i = 0; i < this.fftSize; i++) {
      window[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (this.fftSize - 1));
    }

    return window;
  }

  /**
   * FFTサイズの検証
   */
  private validateFFTSize(size: number): void {
    if (size < 32 || size > 32768) {
      throw new Error(`FFT size must be between 32 and 32768, got ${size}`);
    }

    // 2の累乗チェック
    if ((size & (size - 1)) !== 0) {
      throw new Error(`FFT size must be a power of 2, got ${size}`);
    }
  }

  /**
   * 破棄状態をチェック
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('FFTProcessor is disposed');
    }
  }
}