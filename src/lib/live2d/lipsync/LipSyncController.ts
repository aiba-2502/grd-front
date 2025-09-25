/**
 * LipSyncController - Live2Dリップシンク制御コンポーネント
 * TDD: Green Phase - Minimal implementation to pass tests
 */

import { AudioAnalyzer } from './AudioAnalyzer';
import { VowelDetector } from './VowelDetector';
import { MOUTH_SHAPES } from './constants';
import type { MouthParameters, LipSyncConfig, AudioFeatures, VowelDetectionResult } from './types';

export class LipSyncController {
  private model: any; // Live2Dモデル
  private audioAnalyzer: AudioAnalyzer;
  private vowelDetector: VowelDetector;
  private config: Required<LipSyncConfig>;
  private currentParams: MouthParameters;
  private targetParams: MouthParameters;
  private mapping: Record<string, MouthParameters>;
  private active: boolean = true;
  private disposed: boolean = false;
  private lastUpdateTime: number = 0;
  private defaultParams: MouthParameters = MOUTH_SHAPES.silent;
  private smoothingTime: number = 100;
  public onUpdate?: (params: MouthParameters) => void;

  constructor(
    model: any,
    audioAnalyzer: AudioAnalyzer,
    vowelDetector: VowelDetector,
    config?: LipSyncConfig
  ) {
    this.model = model;
    this.audioAnalyzer = audioAnalyzer;
    this.vowelDetector = vowelDetector;

    // デフォルト設定
    this.config = {
      smoothingFactor: config?.smoothingFactor ?? 0.8,
      minConfidence: config?.minConfidence ?? 0.3,
      updateInterval: config?.updateInterval ?? 16 // 60FPS
    };

    // デフォルトマッピング
    this.mapping = { ...MOUTH_SHAPES };

    // 初期パラメータ
    this.currentParams = { ...MOUTH_SHAPES.silent };
    this.targetParams = { ...MOUTH_SHAPES.silent };
  }

  /**
   * 母音を口形パラメータに変換
   */
  public vowelToParams(vowel: string): MouthParameters {
    return this.mapping[vowel] || this.mapping.silent;
  }

  /**
   * パラメータを正規化
   */
  public normalizeParams(params: MouthParameters): MouthParameters {
    return {
      ParamMouthOpenY: Math.max(0, Math.min(1, params.ParamMouthOpenY)),
      ParamMouthForm: Math.max(-1, Math.min(1, params.ParamMouthForm)),
      ParamMouthOpenX: params.ParamMouthOpenX !== undefined
        ? Math.max(-1, Math.min(1, params.ParamMouthOpenX))
        : undefined
    };
  }

  /**
   * モデルにパラメータを適用
   */
  public applyParams(params: MouthParameters): void {
    const normalized = this.normalizeParams(params);

    this.model.setParameterValueById('ParamMouthOpenY', normalized.ParamMouthOpenY);
    this.model.setParameterValueById('ParamMouthForm', normalized.ParamMouthForm);

    if (normalized.ParamMouthOpenX !== undefined) {
      this.model.setParameterValueById('ParamMouthOpenX', normalized.ParamMouthOpenX);
    }
  }

  /**
   * カスタムマッピングを設定
   */
  public setCustomMapping(mapping: Partial<Record<string, MouthParameters>>): void {
    this.mapping = { ...this.mapping, ...mapping };
  }

  /**
   * パラメータ遷移をスムージング
   */
  public smooth(from: MouthParameters, to: MouthParameters, deltaTime: number): MouthParameters {
    const alpha = this.calculateSmoothingAlpha(deltaTime * 1000); // ms変換
    return this.lerp(from, to, alpha);
  }

  /**
   * 線形補間
   */
  public lerp(from: MouthParameters, to: MouthParameters, t: number): MouthParameters {
    return {
      ParamMouthOpenY: from.ParamMouthOpenY + (to.ParamMouthOpenY - from.ParamMouthOpenY) * t,
      ParamMouthForm: from.ParamMouthForm + (to.ParamMouthForm - from.ParamMouthForm) * t,
      ParamMouthOpenX: from.ParamMouthOpenX !== undefined && to.ParamMouthOpenX !== undefined
        ? from.ParamMouthOpenX + (to.ParamMouthOpenX - from.ParamMouthOpenX) * t
        : undefined
    };
  }

  /**
   * easeInOutQuad イージング関数
   */
  public easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  /**
   * easeOutExpo イージング関数
   */
  public easeOutExpo(t: number): number {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }

  /**
   * フレームレート非依存のスムージング係数を計算
   */
  public calculateSmoothingAlpha(deltaTime: number): number {
    // デルタタイムに基づいてアルファ値を調整
    const targetFPS = 60;
    const targetDelta = 1000 / targetFPS;
    const ratio = deltaTime / targetDelta;

    // より大きなデルタタイム（低FPS）の場合、より大きなアルファ値
    return Math.min(1, (1 - this.config.smoothingFactor) * ratio);
  }

  /**
   * 設定を更新
   */
  public setConfig(config: Partial<LipSyncConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * スムージング時定数を設定
   */
  public setSmoothingTimeConstant(timeMs: number): void {
    // 時定数をスムージングファクターに変換（0-1の範囲）
    // timeMs が大きいほどスムーズになる
    this.config.smoothingFactor = 1 - Math.exp(-16 / Math.max(1, timeMs));
  }

  /**
   * 音声データを処理
   */
  public async processAudio(audioBuffer: Float32Array): Promise<void> {
    this.checkDisposed();

    if (!this.active) {
      return;
    }

    // 更新間隔チェック
    const now = Date.now();
    if (now - this.lastUpdateTime < this.config.updateInterval) {
      return;
    }

    // 音声解析
    const features = this.audioAnalyzer.processAudioBuffer(audioBuffer);

    // 母音識別
    const vowelResult = this.vowelDetector.identify(features.formants);

    // 信頼度チェック
    if (vowelResult.confidence < this.config.minConfidence) {
      return;
    }

    // ターゲットパラメータを更新
    this.targetParams = this.vowelToParams(vowelResult.vowel);

    // スムージング適用
    const deltaTime = Math.min(100, now - this.lastUpdateTime) / 1000; // 秒変換
    this.currentParams = this.smooth(this.currentParams, this.targetParams, deltaTime);

    // モデルに適用
    this.applyParams(this.currentParams);

    // コールバック実行
    if (this.onUpdate) {
      this.onUpdate(this.currentParams);
    }

    this.lastUpdateTime = now;
  }

  /**
   * アクティブ状態を確認
   */
  public isActive(): boolean {
    return this.active && !this.disposed;
  }

  /**
   * リップシンクを開始
   */
  public start(): void {
    this.active = true;
  }

  /**
   * リップシンクを停止
   */
  public stop(): void {
    this.active = false;
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    this.currentParams = { ...this.defaultParams };
    this.disposed = true;
    this.active = false;
  }

  /**
   * 破棄状態をチェック
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('LipSyncController is disposed');
    }
  }
}