/**
 * RMSProcessor - 安定したRMS値計算のためのプロセッサ
 * 固定ウィンドウサイズと移動平均を使用して安定したRMS値を提供
 */

export class RMSProcessor {
  private windowSize: number;
  private sampleBuffer: Float32Array;
  private bufferIndex: number = 0;
  private bufferFilled: boolean = false;
  private smoothingFactor: number;
  private previousRMS: number = 0;

  constructor(
    windowSize: number = 2048,  // デフォルト2048サンプル（約42ms @ 48kHz）
    smoothingFactor: number = 0.3
  ) {
    this.windowSize = windowSize;
    this.sampleBuffer = new Float32Array(windowSize);
    this.smoothingFactor = smoothingFactor;
  }

  /**
   * サンプルを追加してRMS値を計算
   * @param samples 新しいサンプルデータ
   * @returns 計算されたRMS値
   */
  public processSamples(samples: Float32Array): number {
    // サンプルをリングバッファに追加
    for (let i = 0; i < samples.length; i++) {
      this.sampleBuffer[this.bufferIndex] = samples[i];
      this.bufferIndex = (this.bufferIndex + 1) % this.windowSize;

      // バッファが一巡したらフラグを立てる
      if (this.bufferIndex === 0) {
        this.bufferFilled = true;
      }
    }

    // RMS計算
    const rms = this.calculateRMS();

    // スムージング適用
    const smoothedRMS = this.previousRMS + (rms - this.previousRMS) * this.smoothingFactor;
    this.previousRMS = smoothedRMS;

    return smoothedRMS;
  }

  /**
   * 現在のバッファからRMS値を計算
   */
  private calculateRMS(): number {
    let sum = 0;
    const sampleCount = this.bufferFilled ? this.windowSize : this.bufferIndex;

    if (sampleCount === 0) {
      return 0;
    }

    for (let i = 0; i < sampleCount; i++) {
      const sample = this.sampleBuffer[i];
      sum += sample * sample;
    }

    return Math.sqrt(sum / sampleCount);
  }

  /**
   * 単一ウィンドウのRMS計算（スタティック版）
   */
  public static calculateWindowRMS(
    pcmData: Float32Array,
    startIndex: number,
    windowSize: number
  ): number {
    if (!pcmData || startIndex < 0 || startIndex >= pcmData.length) {
      return 0;
    }

    const endIndex = Math.min(startIndex + windowSize, pcmData.length);
    const actualWindowSize = endIndex - startIndex;

    if (actualWindowSize === 0) {
      return 0;
    }

    let sum = 0;
    for (let i = startIndex; i < endIndex; i++) {
      const sample = pcmData[i];
      sum += sample * sample;
    }

    return Math.sqrt(sum / actualWindowSize);
  }

  /**
   * バッファをリセット
   */
  public reset(): void {
    this.sampleBuffer.fill(0);
    this.bufferIndex = 0;
    this.bufferFilled = false;
    this.previousRMS = 0;
  }
}