/**
 * NaturalMotionController
 * Live2Dキャラクターの自然な動きを制御するコントローラー
 *
 * Phase 1: パフォーマンス最適化
 * Phase 2: 自然な動きの実装
 * Phase 3: 初期視線の修正
 * Phase 4: アイドル時の微細動作
 */

export interface MotionConfig {
  smoothingFactor: number;
  acceleration: number;
  maxSpeed: number;
  bodyFollowRatioX: number;
  bodyFollowRatioY: number;
  bodyFollowRatioZ: number;
  idleAmplitudeX: number;
  idleAmplitudeY: number;
  idleFrequencyX: number;
  idleFrequencyY: number;
  blinkIntervalMin: number;
  blinkIntervalMax: number;
  breathAmplitude: number;
  breathSpeed: number;
}

export interface MotionState {
  x: number;
  y: number;
  speedX: number;
  speedY: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface BodyMotion {
  x: number;
  y: number;
  z: number;
}

export class NaturalMotionController {
  // Configuration
  private config: MotionConfig = {
    smoothingFactor: 0.08,
    acceleration: 0.02,
    maxSpeed: 0.15,
    bodyFollowRatioX: 3,
    bodyFollowRatioY: 3,
    bodyFollowRatioZ: -1.5,
    idleAmplitudeX: 0.02,
    idleAmplitudeY: 0.02,
    idleFrequencyX: 0.5,
    idleFrequencyY: 0.3,
    blinkIntervalMin: 2000,
    blinkIntervalMax: 6000,
    breathAmplitude: 0.5,
    breathSpeed: 3.5
  };

  // Phase 1: Performance
  private targetFPS: number = 60;
  private targetFrameTime: number = 1000 / 60;
  private currentFPS: number = 0;
  private fpsHistory: number[] = [];
  private lastFrameTime: number = 0;
  private renderCallback: (() => void) | null = null;
  private animationFrameId: number | null = null;
  private isRendering: boolean = false;

  // Phase 2: Motion State
  private motionState: MotionState = {
    x: 0,
    y: 0,
    speedX: 0,
    speedY: 0
  };
  private targetPosition: Position = { x: 0, y: 0 };
  private currentDrag: Position = { x: 0, y: 0 };

  // Phase 3: Gaze State
  private gazeState: MotionState = {
    x: 0,
    y: 0,
    speedX: 0,
    speedY: 0
  };
  private mousePosition: Position = { x: 0, y: 0 };

  // Phase 4: Idle State
  private isIdleMode: boolean = false;
  private lastBlinkTime: number = 0;

  constructor() {
    this.resetMotion();
  }

  // ============== Phase 1: Performance Optimization ==============

  /**
   * Get target FPS
   */
  public getTargetFPS(): number {
    return this.targetFPS;
  }

  /**
   * Get target frame time in milliseconds
   */
  public getTargetFrameTime(): number {
    return this.targetFrameTime;
  }

  /**
   * Get current FPS
   */
  public getCurrentFPS(): number {
    if (this.fpsHistory.length === 0) return 0;
    const sum = this.fpsHistory.reduce((a, b) => a + b, 0);
    return sum / this.fpsHistory.length;
  }

  /**
   * Update FPS calculation
   */
  public updateFPS(currentTime: number): void {
    if (this.lastFrameTime > 0) {
      const deltaTime = currentTime - this.lastFrameTime;
      const fps = 1000 / deltaTime;

      this.fpsHistory.push(fps);
      if (this.fpsHistory.length > 60) {
        this.fpsHistory.shift();
      }

      this.currentFPS = fps;
    }
    this.lastFrameTime = currentTime;
  }

  /**
   * Check if frame should be skipped due to lag
   */
  public shouldSkipFrame(deltaTime: number): boolean {
    return deltaTime > this.targetFrameTime * 2;
  }

  /**
   * Set render callback
   */
  public setRenderCallback(callback: () => void): void {
    this.renderCallback = callback;
  }

  /**
   * Start optimized rendering loop
   */
  public startRendering(): void {
    if (this.isRendering) return;

    this.isRendering = true;
    this.lastFrameTime = performance.now();
    this.render();
  }

  /**
   * Stop rendering loop
   */
  public stopRendering(): void {
    this.isRendering = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  /**
   * Optimized render loop
   */
  private render(): void {
    if (!this.isRendering) return;

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;

    if (deltaTime >= this.targetFrameTime) {
      this.updateFPS(currentTime);

      if (!this.shouldSkipFrame(deltaTime) && this.renderCallback) {
        this.renderCallback();
      }

      this.lastFrameTime = currentTime - (deltaTime % this.targetFrameTime);
    }

    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  // ============== Phase 2: Natural Motion ==============

  /**
   * Apply smoothing to motion
   */
  public applySmooting(currentX: number, currentY: number, targetX: number, targetY: number): Position {
    const deltaX = targetX - currentX;
    const deltaY = targetY - currentY;

    return {
      x: currentX + deltaX * this.config.smoothingFactor,
      y: currentY + deltaY * this.config.smoothingFactor
    };
  }

  /**
   * Set smoothing factor
   */
  public setSmoothingFactor(factor: number): void {
    this.config.smoothingFactor = factor;
  }

  /**
   * Update motion with acceleration
   */
  public updateMotionWithAcceleration(targetX: number, targetY: number): MotionState {
    const deltaX = targetX - this.motionState.x;
    const deltaY = targetY - this.motionState.y;

    // Apply acceleration
    if (Math.abs(deltaX) > 0.01) {
      this.motionState.speedX = Math.min(
        this.config.maxSpeed,
        this.motionState.speedX + this.config.acceleration
      );
    } else {
      // Decelerate when close to target
      this.motionState.speedX *= 0.95;
    }

    if (Math.abs(deltaY) > 0.01) {
      this.motionState.speedY = Math.min(
        this.config.maxSpeed,
        this.motionState.speedY + this.config.acceleration
      );
    } else {
      // Decelerate when close to target
      this.motionState.speedY *= 0.95;
    }

    // Apply motion
    this.motionState.x += deltaX * this.motionState.speedX;
    this.motionState.y += deltaY * this.motionState.speedY;

    return { ...this.motionState };
  }

  /**
   * Get current motion state
   */
  public getCurrentMotion(): MotionState {
    return { ...this.motionState };
  }

  /**
   * Get max speed
   */
  public getMaxSpeed(): number {
    return this.config.maxSpeed;
  }

  /**
   * Reset motion state
   */
  public resetMotion(): void {
    this.motionState = {
      x: 0,
      y: 0,
      speedX: 0,
      speedY: 0
    };
  }

  /**
   * Calculate body motion with reduced ratio
   */
  public calculateBodyMotion(dragX: number, dragY: number): BodyMotion {
    return {
      x: dragX * this.config.bodyFollowRatioX / 10,
      y: dragY * this.config.bodyFollowRatioY / 10,
      z: dragX * dragY * this.config.bodyFollowRatioZ / 10
    };
  }

  /**
   * Set body follow ratio
   */
  public setBodyFollowRatio(x: number, y: number, z: number): void {
    this.config.bodyFollowRatioX = x;
    this.config.bodyFollowRatioY = y;
    this.config.bodyFollowRatioZ = z;
  }

  /**
   * Set target position for motion
   */
  public setTargetPosition(x: number, y: number): void {
    this.targetPosition = { x, y };
  }

  // ============== Phase 3: Initial Gaze Fix ==============

  /**
   * Initialize gaze to center
   */
  public initializeGaze(): void {
    this.gazeState = {
      x: 0,
      y: 0,
      speedX: 0,
      speedY: 0
    };
  }

  /**
   * Get current gaze state
   */
  public getCurrentGaze(): MotionState {
    return { ...this.gazeState };
  }

  /**
   * Handle model load event
   */
  public onModelLoad(): void {
    this.initializeGaze();
    this.resetMotion();
    this.mousePosition = { x: 0, y: 0 };
  }

  /**
   * Get mouse position
   */
  public getMousePosition(): Position {
    return { ...this.mousePosition };
  }

  // ============== Phase 4: Idle Micro-movements ==============

  /**
   * Calculate idle movement based on time
   */
  public calculateIdleMovement(time: number): Position {
    const timeInSeconds = time * 0.001;

    return {
      x: Math.sin(timeInSeconds * this.config.idleFrequencyX) * this.config.idleAmplitudeX,
      y: Math.cos(timeInSeconds * this.config.idleFrequencyY) * this.config.idleAmplitudeY
    };
  }

  /**
   * Set idle mode
   */
  public setIdleMode(idle: boolean): void {
    this.isIdleMode = idle;
  }

  /**
   * Set current drag position
   */
  public setCurrentDrag(x: number, y: number): void {
    this.currentDrag = { x, y };
  }

  /**
   * Calculate combined movement with idle
   */
  public calculateCombinedMovement(time: number): Position {
    const isActive = Math.abs(this.currentDrag.x) > 0.1 || Math.abs(this.currentDrag.y) > 0.1;

    if (!isActive && this.isIdleMode) {
      const idle = this.calculateIdleMovement(time);
      return {
        x: this.currentDrag.x + idle.x,
        y: this.currentDrag.y + idle.y
      };
    }

    return this.currentDrag;
  }

  /**
   * Get next blink interval (randomized)
   */
  public getNextBlinkInterval(): number {
    const range = this.config.blinkIntervalMax - this.config.blinkIntervalMin;
    return Math.random() * range + this.config.blinkIntervalMin;
  }

  /**
   * Check if should blink
   */
  public shouldBlink(currentTime: number): boolean {
    if (currentTime - this.lastBlinkTime > this.getNextBlinkInterval()) {
      this.lastBlinkTime = currentTime;
      return true;
    }
    return false;
  }

  // ============== Configuration ==============

  /**
   * Set configuration
   */
  public setConfig(config: Partial<MotionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get configuration
   */
  public getConfig(): MotionConfig {
    return { ...this.config };
  }
}