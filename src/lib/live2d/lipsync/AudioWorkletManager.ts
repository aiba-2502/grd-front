/**
 * AudioWorkletManager - AudioWorklet管理コンポーネント
 * TDD: Green Phase - Minimal implementation to pass tests
 */

import { AUDIO_CONFIG } from './constants';
import { logger } from '@/utils/logger';

export interface AudioWorkletData {
  rms: number;
  samples: Float32Array;
  timestamp: number;
}

export type AudioWorkletCallback = (data: AudioWorkletData) => void;

export class AudioWorkletManager {
  private context: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private initialized: boolean = false;
  private disposed: boolean = false;
  private latency: number = 0;
  private cpuUsage: number = 0;
  private callback: AudioWorkletCallback | null = null;

  constructor() {}

  /**
   * AudioWorkletを初期化
   */
  public async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      // AudioContextを作成
      this.context = new AudioContext({
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE
      });

      // AudioWorkletモジュールを読み込み
      await this.context.audioWorklet.addModule('/worklets/lipsync-processor.js');

      // AudioWorkletNodeを作成
      this.workletNode = new AudioWorkletNode(this.context, 'lipsync-processor');

      // メッセージハンドラを設定
      this.setupMessageHandler();

      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('Failed to initialize AudioWorklet:', error);
      return false;
    }
  }

  /**
   * マイク入力を開始
   */
  public async startMicrophone(callback: AudioWorkletCallback): Promise<boolean> {
    if (!this.initialized || this.disposed) {
      return false;
    }

    try {
      // マイクアクセスを要求
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // オーディオソースを作成
      this.source = this.context!.createMediaStreamSource(this.stream);

      // WorkletNodeに接続
      this.source.connect(this.workletNode!);

      // コールバックを保存
      this.callback = callback;

      return true;
    } catch (error) {
      logger.error('Failed to start microphone:', error);
      return false;
    }
  }

  /**
   * マイク入力を停止
   */
  public stopMicrophone(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    this.callback = null;
  }

  /**
   * 音声バッファを処理
   */
  public async processBuffer(
    buffer: Float32Array,
    callback: AudioWorkletCallback
  ): Promise<boolean> {
    if (!this.initialized || this.disposed) {
      return false;
    }

    // コールバックを設定
    this.callback = callback;

    // WorkletNodeにバッファを送信
    this.workletNode?.port.postMessage({
      type: 'processBuffer',
      buffer
    });

    return true;
  }

  /**
   * 更新間隔を設定
   */
  public setUpdateInterval(interval: number): void {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({
      type: 'setParameter',
      parameter: 'updateInterval',
      value: interval
    });
  }

  /**
   * バッファサイズを設定
   */
  public setBufferSize(size: number): void {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({
      type: 'setParameter',
      parameter: 'bufferSize',
      value: size
    });
  }

  /**
   * ノイズゲートしきい値を設定
   */
  public setNoiseGate(threshold: number): void {
    if (!this.workletNode) return;

    this.workletNode.port.postMessage({
      type: 'setParameter',
      parameter: 'noiseGate',
      value: threshold
    });
  }

  /**
   * レイテンシを取得
   */
  public getLatency(): number {
    return this.latency;
  }

  /**
   * CPU使用率を取得
   */
  public getCPUUsage(): number {
    return this.cpuUsage;
  }

  /**
   * AudioContextを取得
   */
  public getContext(): AudioContext | null {
    return this.context;
  }

  /**
   * WorkletNodeを取得
   */
  public getWorkletNode(): AudioWorkletNode | null {
    return this.workletNode;
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
    this.stopMicrophone();

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }

    if (this.context && this.context.state !== 'closed') {
      this.context.close();
      this.context = null;
    }

    this.initialized = false;
    this.disposed = true;
    this.callback = null;
  }

  /**
   * メッセージハンドラをセットアップ
   */
  private setupMessageHandler(): void {
    if (!this.workletNode) return;

    this.workletNode.port.onmessage = (event: MessageEvent) => {
      const { type, data, value } = event.data;

      switch (type) {
        case 'audioFeatures':
          // 音声特徴データを受信
          if (this.callback) {
            this.callback(data);
          }
          break;

        case 'latency':
          // レイテンシ情報を更新
          this.latency = value;
          break;

        case 'cpuUsage':
          // CPU使用率を更新
          this.cpuUsage = value;
          break;

        case 'error':
          logger.error('AudioWorklet error:', data);
          break;
      }
    };
  }
}