/**
 * AudioAnalyzer - 音声解析コンポーネント
 * TDD: Green Phase - Minimal implementation to pass tests
 */

import { AUDIO_CONFIG, RMS_CONFIG } from './constants';
import type { AudioFeatures, AudioAnalyzerConfig } from './types';
import { FFTProcessor } from './FFTProcessor';
import { FormantExtractor } from './FormantExtractor';

export class AudioAnalyzer {
  private config: Required<AudioAnalyzerConfig>;
  private initialized: boolean = true;
  private disposed: boolean = false;
  private previousRMS: number = 0;
  private sampleBuffer: Float32Array;
  private bufferIndex: number = 0;
  private fftProcessor: FFTProcessor;
  private formantExtractor: FormantExtractor;

  constructor(config?: AudioAnalyzerConfig) {
    // 設定値の検証とデフォルト値の適用
    this.config = this.validateAndMergeConfig(config);
    this.sampleBuffer = new Float32Array(this.config.fftSize);
    this.fftProcessor = new FFTProcessor(this.config.fftSize);
    this.formantExtractor = new FormantExtractor(this.fftProcessor);
  }

  /**
   * RMS (Root Mean Square) 値を計算
   */
  public calculateRMS(samples: Float32Array): number {
    this.checkDisposed();

    if (samples.length === 0) {
      return 0;
    }

    // 効率的な二乗和計算
    const sum = samples.reduce((acc, sample) => acc + sample * sample, 0);
    const rms = Math.sqrt(sum / samples.length);

    // 閾値以下は無音として扱う
    return rms < RMS_CONFIG.MIN_THRESHOLD ? 0 : rms;
  }

  /**
   * スムージングされたRMS値を計算
   */
  public calculateSmoothedRMS(samples: Float32Array): number {
    this.checkDisposed();

    const currentRMS = this.calculateRMS(samples);
    const smoothingFactor = this.config.smoothingTimeConstant;

    // 指数移動平均によるスムージング
    this.previousRMS = smoothingFactor * this.previousRMS + (1 - smoothingFactor) * currentRMS;

    return this.previousRMS;
  }

  /**
   * 正規化されたRMSレベルを取得（0-1の範囲）
   */
  public getRMSLevel(samples: Float32Array): number {
    this.checkDisposed();

    const rms = this.calculateRMS(samples);
    // 0-1の範囲に正規化
    return Math.min(rms / RMS_CONFIG.MAX_THRESHOLD, 1.0);
  }

  /**
   * 音声バッファを処理
   */
  public processAudioBuffer(buffer: Float32Array): AudioFeatures {
    this.checkDisposed();

    const rms = this.calculateRMS(buffer);

    // FFT処理を実行
    let spectrum: Float32Array;
    if (buffer.length === this.config.fftSize) {
      // 窓関数を適用してFFT
      const windowed = this.fftProcessor.applyHammingWindow(buffer);
      spectrum = this.fftProcessor.forward(windowed);
    } else {
      // サイズ調整が必要な場合
      const resized = this.resizeBuffer(buffer, this.config.fftSize);
      const windowed = this.fftProcessor.applyHammingWindow(resized);
      spectrum = this.fftProcessor.forward(windowed);
    }

    // フォルマント抽出
    const formants = this.formantExtractor.extractFormants(spectrum, this.config.sampleRate);

    return {
      rms,
      spectrum,
      formants,
      timestamp: Date.now()
    };
  }

  /**
   * マルチチャンネル音声バッファを処理
   */
  public processMultiChannelBuffer(channels: Float32Array[]): AudioFeatures {
    this.checkDisposed();

    if (channels.length === 0) {
      throw new Error('No channels provided');
    }

    // 全チャンネルの平均を計算
    const mixedBuffer = this.mixChannels(channels);
    return this.processAudioBuffer(mixedBuffer);
  }

  /**
   * 複数チャンネルをミックス
   */
  private mixChannels(channels: Float32Array[]): Float32Array {
    const length = Math.max(...channels.map(ch => ch.length));
    const mixedBuffer = new Float32Array(length);

    for (let i = 0; i < length; i++) {
      let sum = 0;
      let count = 0;
      for (const channel of channels) {
        if (i < channel.length) {
          sum += channel[i];
          count++;
        }
      }
      mixedBuffer[i] = count > 0 ? sum / count : 0;
    }

    return mixedBuffer;
  }

  /**
   * バッファサイズを取得
   */
  public getBufferSize(): number {
    return this.config.fftSize;
  }

  /**
   * 現在の設定を取得
   */
  public getConfig(): Required<AudioAnalyzerConfig> {
    return { ...this.config };
  }

  /**
   * 初期化状態を確認
   */
  public isInitialized(): boolean {
    return this.initialized && !this.disposed;
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    this.disposed = true;
    this.initialized = false;
    this.previousRMS = 0;
    this.bufferIndex = 0;
    this.fftProcessor.dispose();
    this.formantExtractor.dispose();
  }

  /**
   * 設定値の検証とデフォルト値のマージ
   */
  private validateAndMergeConfig(config?: AudioAnalyzerConfig): Required<AudioAnalyzerConfig> {
    const mergedConfig: Required<AudioAnalyzerConfig> = {
      fftSize: config?.fftSize ?? AUDIO_CONFIG.FFT_SIZE,
      smoothingTimeConstant: config?.smoothingTimeConstant ?? AUDIO_CONFIG.SMOOTHING_TIME_CONSTANT,
      minDecibels: config?.minDecibels ?? AUDIO_CONFIG.MIN_DECIBELS,
      maxDecibels: config?.maxDecibels ?? AUDIO_CONFIG.MAX_DECIBELS,
      sampleRate: config?.sampleRate ?? AUDIO_CONFIG.SAMPLE_RATE
    };

    // 検証
    this.validateFFTSize(mergedConfig.fftSize);
    this.validateSmoothingTimeConstant(mergedConfig.smoothingTimeConstant);
    this.validateSampleRate(mergedConfig.sampleRate);
    this.validateDecibels(mergedConfig.minDecibels, mergedConfig.maxDecibels);

    return mergedConfig;
  }

  /**
   * FFTサイズの検証（2の累乗である必要がある）
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
   * スムージング定数の検証
   */
  private validateSmoothingTimeConstant(value: number): void {
    if (value < 0 || value > 1) {
      throw new Error(`Smoothing time constant must be between 0 and 1, got ${value}`);
    }
  }

  /**
   * サンプルレートの検証
   */
  private validateSampleRate(rate: number): void {
    if (rate <= 0 || rate > 192000) {
      throw new Error(`Sample rate must be between 0 and 192000, got ${rate}`);
    }
  }

  /**
   * デシベル値の検証
   */
  private validateDecibels(min: number, max: number): void {
    if (min >= max) {
      throw new Error(`Min decibels must be less than max decibels, got min=${min}, max=${max}`);
    }
  }

  /**
   * 破棄状態をチェック
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('AudioAnalyzer is disposed');
    }
  }

  /**
   * バッファサイズを調整
   */
  private resizeBuffer(buffer: Float32Array, targetSize: number): Float32Array {
    const resized = new Float32Array(targetSize);
    const copySize = Math.min(buffer.length, targetSize);
    resized.set(buffer.subarray(0, copySize));
    return resized;
  }
}