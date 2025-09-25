/**
 * LipSyncProcessor - AudioWorkletProcessor実装
 * 別スレッドで動作する音声処理プロセッサ
 */

class LipSyncProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    // 設定パラメータ
    this.sampleBuffer = [];
    this.bufferSize = 2048;
    this.updateInterval = 128; // samples
    this.sampleCount = 0;
    this.noiseGate = 0.001; // ノイズゲートしきい値

    // パフォーマンス計測
    this.lastProcessTime = 0;
    this.processingTime = 0;

    // メッセージハンドラ設定
    this.port.onmessage = this.handleMessage.bind(this);
  }

  /**
   * メッセージ処理
   */
  handleMessage(event) {
    const { type, parameter, value, buffer } = event.data;

    switch (type) {
      case 'setParameter':
        this.setParameter(parameter, value);
        break;

      case 'processBuffer':
        this.processExternalBuffer(buffer);
        break;

      case 'reset':
        this.reset();
        break;
    }
  }

  /**
   * パラメータ設定
   */
  setParameter(parameter, value) {
    switch (parameter) {
      case 'updateInterval':
        this.updateInterval = Math.max(32, Math.min(512, value));
        break;

      case 'bufferSize':
        this.bufferSize = Math.max(512, Math.min(8192, value));
        break;

      case 'noiseGate':
        this.noiseGate = Math.max(0, Math.min(1, value));
        break;
    }
  }

  /**
   * 外部バッファを処理
   */
  processExternalBuffer(buffer) {
    if (!buffer || buffer.length === 0) return;

    const features = this.extractFeatures(buffer);

    // 音声特徴を送信
    this.port.postMessage({
      type: 'audioFeatures',
      data: features
    });
  }

  /**
   * RMS (Root Mean Square) 値を計算
   */
  calculateRMS(samples) {
    if (samples.length === 0) return 0;

    let sum = 0;
    for (let i = 0; i < samples.length; i++) {
      sum += samples[i] * samples[i];
    }

    const rms = Math.sqrt(sum / samples.length);

    // ノイズゲート適用
    return rms < this.noiseGate ? 0 : rms;
  }

  /**
   * ピーク値を検出
   */
  calculatePeak(samples) {
    let peak = 0;
    for (let i = 0; i < samples.length; i++) {
      peak = Math.max(peak, Math.abs(samples[i]));
    }
    return peak;
  }

  /**
   * ゼロクロッシング率を計算（基本周波数の推定用）
   */
  calculateZeroCrossingRate(samples) {
    let crossings = 0;
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i - 1] >= 0 && samples[i] < 0) ||
          (samples[i - 1] < 0 && samples[i] >= 0)) {
        crossings++;
      }
    }
    return crossings / samples.length;
  }

  /**
   * エネルギーを計算
   */
  calculateEnergy(samples) {
    let energy = 0;
    for (let i = 0; i < samples.length; i++) {
      energy += samples[i] * samples[i];
    }
    return energy;
  }

  /**
   * 音声特徴を抽出
   */
  extractFeatures(samples) {
    const startTime = performance.now();

    const rms = this.calculateRMS(samples);
    const peak = this.calculatePeak(samples);
    const zcr = this.calculateZeroCrossingRate(samples);
    const energy = this.calculateEnergy(samples);

    const processingTime = performance.now() - startTime;

    return {
      rms,
      peak,
      zeroCrossingRate: zcr,
      energy,
      samples: samples.slice(0, this.bufferSize), // 必要な分だけコピー
      timestamp: currentTime,
      processingTime
    };
  }

  /**
   * メインの音声処理
   */
  process(inputs, outputs, parameters) {
    const input = inputs[0];

    // 入力がない場合は処理を継続
    if (!input || !input[0]) {
      return true;
    }

    const samples = input[0];

    // バッファに追加
    this.sampleBuffer.push(...samples);

    // バッファサイズを管理
    if (this.sampleBuffer.length > this.bufferSize) {
      this.sampleBuffer = this.sampleBuffer.slice(-this.bufferSize);
    }

    this.sampleCount += samples.length;

    // 更新間隔ごとに処理
    if (this.sampleCount >= this.updateInterval) {
      const startTime = performance.now();

      // Float32Arrayに変換
      const bufferArray = new Float32Array(this.sampleBuffer);

      // 音声特徴を抽出
      const features = this.extractFeatures(bufferArray);

      // メインスレッドに送信
      this.port.postMessage({
        type: 'audioFeatures',
        data: features
      });

      // パフォーマンス情報を送信
      const processingTime = performance.now() - startTime;
      this.updatePerformanceMetrics(processingTime);

      this.sampleCount = 0;
    }

    // パススルー（オプション）
    const output = outputs[0];
    if (output && output[0]) {
      output[0].set(samples);
    }

    // 処理を継続
    return true;
  }

  /**
   * パフォーマンスメトリクスを更新
   */
  updatePerformanceMetrics(processingTime) {
    // 指数移動平均でスムージング
    this.processingTime = 0.9 * this.processingTime + 0.1 * processingTime;

    // レイテンシを送信（5秒ごと）
    if (currentTime - this.lastProcessTime > 5) {
      this.port.postMessage({
        type: 'latency',
        value: this.processingTime
      });

      // CPU使用率の推定（処理時間 / 利用可能時間）
      const availableTime = (this.updateInterval / sampleRate) * 1000;
      const cpuUsage = (this.processingTime / availableTime) * 100;

      this.port.postMessage({
        type: 'cpuUsage',
        value: Math.min(100, cpuUsage)
      });

      this.lastProcessTime = currentTime;
    }
  }

  /**
   * リセット
   */
  reset() {
    this.sampleBuffer = [];
    this.sampleCount = 0;
    this.processingTime = 0;
    this.lastProcessTime = 0;
  }

  /**
   * 高度な特徴抽出（将来の拡張用）
   */
  extractAdvancedFeatures(samples) {
    // スペクトルセントロイド（音色の明るさ）
    const spectralCentroid = this.calculateSpectralCentroid(samples);

    // スペクトルロールオフ（高周波数成分の分布）
    const spectralRolloff = this.calculateSpectralRolloff(samples);

    // MFCC（メル周波数ケプストラム係数）の簡易版
    const mfcc = this.calculateSimpleMFCC(samples);

    return {
      spectralCentroid,
      spectralRolloff,
      mfcc
    };
  }

  /**
   * スペクトルセントロイドを計算
   */
  calculateSpectralCentroid(samples) {
    // 簡易実装：重み付き平均周波数
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < samples.length; i++) {
      const magnitude = Math.abs(samples[i]);
      weightedSum += i * magnitude;
      magnitudeSum += magnitude;
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * スペクトルロールオフを計算
   */
  calculateSpectralRolloff(samples, threshold = 0.85) {
    const magnitudes = samples.map(s => Math.abs(s));
    const totalEnergy = magnitudes.reduce((sum, m) => sum + m, 0);
    const targetEnergy = totalEnergy * threshold;

    let cumulativeEnergy = 0;
    for (let i = 0; i < magnitudes.length; i++) {
      cumulativeEnergy += magnitudes[i];
      if (cumulativeEnergy >= targetEnergy) {
        return i / samples.length;
      }
    }

    return 1.0;
  }

  /**
   * 簡易MFCC計算
   */
  calculateSimpleMFCC(samples) {
    // 非常に簡略化されたMFCC（実際の実装はより複雑）
    const mfcc = [];
    const numCoefficients = 13;

    for (let i = 0; i < numCoefficients; i++) {
      let coefficient = 0;
      for (let j = 0; j < samples.length; j++) {
        coefficient += samples[j] * Math.cos(Math.PI * i * j / samples.length);
      }
      mfcc.push(coefficient / samples.length);
    }

    return mfcc;
  }
}

// プロセッサを登録
registerProcessor('lipsync-processor', LipSyncProcessor);