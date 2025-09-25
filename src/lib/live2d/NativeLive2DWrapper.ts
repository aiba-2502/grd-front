/**
 * NativeLive2DWrapper
 * PIXIに依存しないNative Live2D実装
 * Cubism SDKを直接使用してLive2Dモデルを制御
 */

import { LAppDelegate } from './demo/lappdelegate';
import { LAppLive2DManager } from './demo/lapplive2dmanager';
import { LAppGlManager } from './demo/lappglmanager';
import { LAppWavFileHandler } from './demo/lappwavfilehandler';
import { CubismFramework } from './framework/live2dcubismframework';
import * as LAppDefine from './demo/lappdefine';
import { AudioAnalyzer } from './lipsync/AudioAnalyzer';
import { VowelDetector } from './lipsync/VowelDetector';
import { LipSyncController } from './lipsync/LipSyncController';
import { RMSProcessor } from './lipsync/RMSProcessor';
import { PerformanceMonitor, PerformanceReport } from './PerformanceMonitor';
import { NaturalMotionController } from './NaturalMotionController';
import { logger } from '@/utils/logger';

export interface MousePosition {
  x: number;
  y: number;
}

export interface RenderStats {
  drawCalls: number;
  vertices: number;
  triangles: number;
}

export type Quality = 'low' | 'medium' | 'high';

export class NativeLive2DWrapper {
  private container: HTMLElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private gl: WebGLRenderingContext | null = null;
  private delegate: LAppDelegate | null = null;
  private manager: LAppLive2DManager | null = null;
  private glManager: LAppGlManager | null = null;

  private initialized: boolean = false;
  private disposed: boolean = false;
  private rendering: boolean = false;
  private frameId: number | null = null;

  // Model state
  private currentModelId: string | null = null;
  private modelLoaded: boolean = false;

  // Motion state
  private playingMotion: boolean = false;
  private motionLoops: Map<string, boolean> = new Map();

  // Expression state
  private currentExpression: string = 'default';

  // Lip sync state
  private lipSyncValue: number = 0;
  private lipSyncing: boolean = false;
  private wavFileHandler: LAppWavFileHandler | null = null;

  // Advanced lip sync components
  private audioAnalyzer: AudioAnalyzer | null = null;
  private vowelDetector: VowelDetector | null = null;
  private lipSyncController: LipSyncController | null = null;
  private rmsProcessor: RMSProcessor | null = null;

  // Interaction state
  private mousePosition: MousePosition = { x: 0, y: 0 };
  private dragging: boolean = false;
  private eyeTrackingEnabled: boolean = true;

  // Performance
  private targetFPS: number = 60;
  private currentFPS: number = 0;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private fpsUpdateTime: number = 0;
  private quality: Quality = 'medium';
  private performanceMonitor: PerformanceMonitor | null = null;
  private naturalMotionController: NaturalMotionController | null = null;

  constructor() {}

  /**
   * 初期化
   */
  public async initialize(container: HTMLElement): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    try {
      this.container = container;

      // Create canvas
      this.canvas = document.createElement('canvas');
      this.canvas.width = container.offsetWidth;
      this.canvas.height = container.offsetHeight;
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      container.appendChild(this.canvas);

      // Get WebGL context
      this.gl = this.canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        stencil: false,
        depth: false,
      }) as WebGLRenderingContext;

      if (!this.gl) {
        logger.error('WebGL not supported');
        return false;
      }

      // Initialize Cubism Framework
      const cubismOption = {
        logFunction: LAppDefine.DebugLogEnable ? logger.log : null,
        loggingLevel: LAppDefine.DebugLogEnable
          ? LAppDefine.CubismLoggingLevel
          : 0, // LogLevel_Off
      };

      if (!CubismFramework.isStarted()) {
        if (!CubismFramework.startUp(cubismOption)) {
          logger.error('Failed to start Cubism Framework');
          return false;
        }
        CubismFramework.initialize();
      }

      // Initialize delegate and manager
      this.delegate = LAppDelegate.getInstance();
      await this.delegate.initialize();

      this.manager = new LAppLive2DManager();
      this.glManager = new LAppGlManager();

      // Initialize performance monitoring
      this.performanceMonitor = new PerformanceMonitor({
        minFPS: 30,
        maxMemoryMB: 100,
        maxCPU: 30
      });

      // Initialize natural motion controller
      this.naturalMotionController = new NaturalMotionController();

      this.initialized = true;
      return true;
    } catch (error) {
      logger.error('Failed to initialize NativeLive2DWrapper:', error);
      return false;
    }
  }

  /**
   * モデルのロード
   */
  public async loadModel(modelPath: string): Promise<boolean> {
    this.checkDisposed();

    if (!this.initialized) {
      throw new Error('Wrapper not initialized');
    }

    if (!modelPath) {
      return false;
    }

    try {
      // 既存モデルがあれば解放
      if (this.modelLoaded && this.manager) {
        // Since releaseAllModel is private, we clear models manually
        const model = this.manager.getModel(0);
        if (model) {
          model.releaseMotions();
          model.releaseExpressions();
        }
      }

      // Load new model using addModel and changeScene
      if (this.manager) {
        // Set the model path in LAppDefine (if needed)
        // For now, use addModel with default scene
        this.manager.addModel(0);

        // Wait for model to load
        await new Promise(resolve => setTimeout(resolve, 1000));

        const model = this.manager.getModel(0);
        if (model) {
          this.currentModelId = modelPath;
          this.modelLoaded = true;
          return true;
        }
      }

      return false;
    } catch (error) {
      logger.error('Failed to load model:', error);
      return false;
    }
  }

  /**
   * レンダリング開始
   */
  public startRendering(): void {
    this.checkDisposed();
    this.checkInitialized();

    if (this.rendering) {
      return;
    }

    this.rendering = true;
    this.lastFrameTime = performance.now();
    this.fpsUpdateTime = this.lastFrameTime;
    this.frameCount = 0;

    // Start performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.startMonitoring(this);
    }

    // Phase 1: Optimized render loop with 60 FPS target
    const render = () => {
      if (!this.rendering) {
        return;
      }

      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastFrameTime;
      const targetFrameTime = 1000 / this.targetFPS;

      // Only render if enough time has passed (60 FPS cap)
      if (deltaTime >= targetFrameTime) {
        // Update FPS calculation
        if (this.naturalMotionController) {
          this.naturalMotionController.updateFPS(currentTime);
        }

        this.frameCount++;
        if (currentTime - this.fpsUpdateTime >= 1000) {
          this.currentFPS = this.frameCount;
          this.frameCount = 0;
          this.fpsUpdateTime = currentTime;
        }

        // Check for frame skipping
        const shouldSkip = this.naturalMotionController?.shouldSkipFrame(deltaTime) ?? false;

        if (!shouldSkip && this.delegate && this.gl && this.canvas) {
          // Clear with depth buffer for better performance
          this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
          this.gl.clearColor(0, 0, 0, 0);
          this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

          // Update
          this.delegate.run();
        }

        // Adjust frame time to maintain stable 60 FPS
        this.lastFrameTime = currentTime - (deltaTime % targetFrameTime);
      }

      // Use requestAnimationFrame directly for V-Sync
      this.frameId = requestAnimationFrame(render) as unknown as number;
    };

    render();
  }

  /**
   * レンダリング停止
   */
  public stopRendering(): void {
    this.rendering = false;
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    // Stop performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.stopMonitoring();
    }

    // Stop natural motion controller rendering
    if (this.naturalMotionController) {
      this.naturalMotionController.stopRendering();
    }
  }

  /**
   * モーション再生
   */
  public startMotion(motionName: string, priority: number): boolean {
    this.checkDisposed();
    this.checkInitialized();

    if (!this.modelLoaded || !this.manager) {
      return false;
    }

    try {
      const model = this.manager.getModel(0);
      if (model) {
        model.startMotion(motionName, 0, priority);
        this.playingMotion = true;
        return true;
      }
    } catch (error) {
      logger.error('Failed to start motion:', error);
    }

    return false;
  }

  /**
   * ランダムモーション再生
   */
  public startRandomMotion(group: string, priority: number): boolean {
    this.checkDisposed();
    this.checkInitialized();

    if (!this.modelLoaded || !this.manager) {
      return false;
    }

    try {
      const model = this.manager.getModel(0);
      if (model) {
        model.startRandomMotion(group, priority);
        this.playingMotion = true;
        return true;
      }
    } catch (error) {
      logger.error('Failed to start random motion:', error);
    }

    return false;
  }

  /**
   * モーション停止
   */
  public stopAllMotions(): void {
    this.checkDisposed();
    this.checkInitialized();

    if (!this.modelLoaded || !this.manager) {
      return;
    }

    const model = this.manager.getModel(0);
    if (model) {
      // Stop motions by starting a null motion
      model.startMotion('', 0, 0);
      this.playingMotion = false;
    }
  }

  /**
   * 表情設定
   */
  public setExpression(expressionId: string): void {
    this.checkDisposed();
    this.checkInitialized();

    if (!this.modelLoaded || !this.manager) {
      return;
    }

    const model = this.manager.getModel(0);
    if (model) {
      model.setExpression(expressionId);
      this.currentExpression = expressionId;
    }
  }

  /**
   * ランダム表情設定
   */
  public setRandomExpression(): void {
    this.checkDisposed();
    this.checkInitialized();

    if (!this.modelLoaded || !this.manager) {
      return;
    }

    const model = this.manager.getModel(0);
    if (model) {
      model.setRandomExpression();
      // Note: 実際の表情名は取得できない場合がある
      this.currentExpression = 'random';
    }
  }

  /**
   * 表情リセット
   */
  public resetExpression(): void {
    this.setExpression('default');
  }

  /**
   * リップシンク値設定
   */
  public setLipSyncValue(value: number): void {
    this.checkDisposed();
    this.checkInitialized();

    // Clamp value
    this.lipSyncValue = Math.max(0, Math.min(1, value));

    if (!this.modelLoaded || !this.manager) {
      return;
    }

    const model = this.manager.getModel(0);
    if (model) {
      model.setLipSyncValue(this.lipSyncValue);
    }
  }

  /**
   * リップシンク開始
   */
  public async startLipSync(audioUrl: string): Promise<boolean> {
    this.checkDisposed();
    this.checkInitialized();

    try {
      // Initialize advanced lip sync components if not already done
      if (!this.audioAnalyzer) {
        this.audioAnalyzer = new AudioAnalyzer();
      }
      if (!this.vowelDetector) {
        this.vowelDetector = new VowelDetector();
      }
      if (!this.rmsProcessor) {
        this.rmsProcessor = new RMSProcessor(2048, 0.3);
      }

      if (!this.wavFileHandler) {
        this.wavFileHandler = new LAppWavFileHandler();
      }

      const success = await this.wavFileHandler.loadWavFile(audioUrl);
      if (success) {
        // Initialize LipSyncController with model
        const model = this.manager?.getModel(0);
        if (model && this.audioAnalyzer && this.vowelDetector) {
          this.lipSyncController = new LipSyncController(
            model,
            this.audioAnalyzer,
            this.vowelDetector,
            {
              smoothingFactor: 0.8,
              minConfidence: 0.3,
              updateInterval: 16,
            }
          );
        }

        this.lipSyncing = true;
        this.startLipSyncUpdate();
        return true;
      }
    } catch (error) {
      logger.error('Failed to start lip sync:', error);
    }

    return false;
  }

  /**
   * リップシンク更新ループ
   */
  private startLipSyncUpdate(): void {
    if (!this.lipSyncing || !this.wavFileHandler) {
      return;
    }

    let lastSampleOffset = 0;

    const update = () => {
      if (!this.lipSyncing || !this.wavFileHandler) {
        return;
      }

      // Update WAV handler
      const deltaTime = 0.016; // 60fps assumed
      const hasData = this.wavFileHandler.update(deltaTime);

      if (!hasData) {
        this.stopLipSync();
        return;
      }

      // Use RMSProcessor for more stable lip sync
      if (this.rmsProcessor && this.wavFileHandler._pcmData) {
        const currentSampleOffset = this.wavFileHandler._sampleOffset;
        const pcmData = this.wavFileHandler._pcmData[0]; // First channel
        const samplesPerChannel = this.wavFileHandler._wavFileInfo?._samplesPerChannel || 0;

        if (pcmData && currentSampleOffset < samplesPerChannel) {
          // Calculate RMS using fixed window
          const windowSize = 2048;
          const windowStart = Math.max(0, currentSampleOffset - windowSize);
          const windowEnd = currentSampleOffset;

          let rms = 0;
          let sampleCount = 0;
          for (let i = windowStart; i < windowEnd && i < samplesPerChannel; i++) {
            const sample = pcmData[i];
            rms += sample * sample;
            sampleCount++;
          }

          if (sampleCount > 0) {
            rms = Math.sqrt(rms / sampleCount);
          }

          // Apply scaling and smoothing
          const scaleFactor = 8;
          let targetRms = Math.min(Math.abs(rms) * scaleFactor, 1);

          // Threshold for minimum value
          if (targetRms < 0.02) {
            targetRms = 0;
          }

          this.setLipSyncValue(targetRms);
          lastSampleOffset = currentSampleOffset;
        }
      } else {
        // Fallback to simple RMS
        const rms = this.wavFileHandler.getRms();
        this.setLipSyncValue(rms * 8);
      }

      requestAnimationFrame(update);
    };

    update();
  }

  /**
   * リップシンク停止
   */
  public stopLipSync(): void {
    this.lipSyncing = false;
    this.setLipSyncValue(0);

    if (this.wavFileHandler) {
      this.wavFileHandler.releasePcmData();
    }
  }

  /**
   * マウス移動処理
   */
  public onMouseMove(x: number, y: number): void {
    this.checkDisposed();
    this.checkInitialized();

    this.mousePosition = { x, y };

    if (this.delegate) {
      this.delegate.onMouseMoved({ pageX: x, pageY: y } as MouseEvent);
    }
  }

  /**
   * タップ処理
   */
  public onTap(x: number, y: number): boolean {
    this.checkDisposed();
    this.checkInitialized();

    if (!this.modelLoaded || !this.manager) {
      return false;
    }

    this.manager.onTap(x, y);
    return true;
  }

  /**
   * ドラッグ開始
   */
  public onDragStart(x: number, y: number): void {
    this.checkDisposed();
    this.checkInitialized();

    this.dragging = true;
    if (this.manager) {
      this.manager.onDrag(x, y);
    }
  }

  /**
   * ドラッグ中
   */
  public onDrag(x: number, y: number): void {
    this.checkDisposed();
    this.checkInitialized();

    if (this.dragging && this.manager) {
      this.manager.onDrag(x, y);
    }
  }

  /**
   * ドラッグ終了
   */
  public onDragEnd(): void {
    this.dragging = false;
  }

  /**
   * サイズ変更
   */
  public resize(width: number, height: number): void {
    this.checkDisposed();
    this.checkInitialized();

    if (this.canvas) {
      this.canvas.width = width;
      this.canvas.height = height;
    }

    if (this.gl) {
      this.gl.viewport(0, 0, width, height);
    }

    if (this.delegate) {
      this.delegate.onResize();
    }
  }

  /**
   * リソース解放
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.stopRendering();
    this.stopLipSync();

    // Dispose performance monitor
    if (this.performanceMonitor) {
      this.performanceMonitor.stopMonitoring();
      this.performanceMonitor = null;
    }

    // Dispose natural motion controller
    if (this.naturalMotionController) {
      this.naturalMotionController.stopRendering();
      this.naturalMotionController = null;
    }

    // Dispose lip sync components
    if (this.lipSyncController) {
      this.lipSyncController.dispose();
      this.lipSyncController = null;
    }

    if (this.rmsProcessor) {
      this.rmsProcessor.reset();
      this.rmsProcessor = null;
    }

    this.audioAnalyzer = null;
    this.vowelDetector = null;

    if (this.manager) {
      // Release models manually since releaseAllModel is private
      const model = this.manager.getModel(0);
      if (model) {
        model.releaseMotions();
        model.releaseExpressions();
      }
    }

    if (this.delegate) {
      this.delegate.release();
    }

    if (this.canvas && this.container) {
      this.container.removeChild(this.canvas);
    }

    this.container = null;
    this.canvas = null;
    this.gl = null;
    this.delegate = null;
    this.manager = null;
    this.glManager = null;
    this.wavFileHandler = null;

    this.initialized = false;
    this.disposed = true;
  }

  // Getters
  public isInitialized(): boolean { return this.initialized; }
  public isRendering(): boolean { return this.rendering; }
  public hasModel(): boolean { return this.modelLoaded; }
  public getCurrentModelId(): string | null { return this.currentModelId; }
  public isPlayingMotion(): boolean { return this.playingMotion; }
  public getCurrentExpression(): string { return this.currentExpression; }
  public getLipSyncValue(): number { return this.lipSyncValue; }
  public isLipSyncing(): boolean { return this.lipSyncing; }
  public getMousePosition(): MousePosition { return this.mousePosition; }
  public isDragging(): boolean { return this.dragging; }
  public isEyeTrackingEnabled(): boolean { return this.eyeTrackingEnabled; }
  public getTargetFPS(): number { return this.targetFPS; }
  public getCurrentFPS(): number { return this.currentFPS; }
  public getQuality(): Quality { return this.quality; }

  // Setters
  public setTargetFPS(fps: number): void { this.targetFPS = Math.max(1, Math.min(60, fps)); }
  public setEyeTracking(enabled: boolean): void { this.eyeTrackingEnabled = enabled; }
  public setQuality(quality: Quality): void { this.quality = quality; }
  public setMotionLoop(motionName: string, loop: boolean): void { this.motionLoops.set(motionName, loop); }
  public getMotionLoop(motionName: string): boolean { return this.motionLoops.get(motionName) ?? false; }

  /**
   * 描画統計取得
   */
  public getRenderStats(): RenderStats {
    // Note: 実際の統計は WebGL から取得する必要がある
    return {
      drawCalls: 10,
      vertices: 1000,
      triangles: 500,
    };
  }

  /**
   * Performance monitoring methods
   */
  public getPerformanceReport(): PerformanceReport | null {
    if (!this.performanceMonitor) {
      return null;
    }
    return this.performanceMonitor.getReport(this);
  }

  public isPerformanceMonitoring(): boolean {
    return this.performanceMonitor?.isActivelyMonitoring() ?? false;
  }

  public setPerformanceCriteria(criteria: { minFPS?: number; maxMemoryMB?: number; maxCPU?: number }): void {
    if (this.performanceMonitor) {
      this.performanceMonitor.setCriteria(criteria);
    }
  }

  public exportPerformanceData(): any {
    if (!this.performanceMonitor) {
      return null;
    }
    return this.performanceMonitor.exportData();
  }

  /**
   * メモリ使用量取得（プライベート）
   */
  private getMemoryUsage(): number {
    // Note: 実装は環境依存
    return 50 * 1024 * 1024; // 50MB dummy
  }

  /**
   * 破棄チェック
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('Wrapper is disposed');
    }
  }

  /**
   * 初期化チェック
   */
  private checkInitialized(): void {
    if (!this.initialized) {
      throw new Error('Wrapper not initialized');
    }
  }
}