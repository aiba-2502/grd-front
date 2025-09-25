/**
 * Performance monitoring for Native Live2D implementation
 * Tracks FPS, memory usage, and estimated CPU utilization
 */

import { NativeLive2DWrapper } from './NativeLive2DWrapper';

export interface PerformanceReport {
  averageFPS: number;
  currentFPS: number;
  currentMemoryMB: number;
  peakMemoryMB: number;
  estimatedCPU: number;
  frameTime: number;
  passed: boolean;
  timestamp: number;
}

export interface PerformanceCriteria {
  minFPS: number;
  maxMemoryMB: number;
  maxCPU: number;
}

export class PerformanceMonitor {
  private fpsHistory: number[] = [];
  private memoryHistory: number[] = [];
  private frameTimeHistory: number[] = [];
  private lastFrameTime: number = 0;
  private peakMemory: number = 0;
  private isMonitoring: boolean = false;
  private monitoringInterval: number | null = null;

  // Default performance criteria
  private criteria: PerformanceCriteria = {
    minFPS: 30,
    maxMemoryMB: 100,
    maxCPU: 30,
  };

  // History configuration
  private readonly maxHistorySize = 100;
  private readonly samplingIntervalMs = 1000; // Sample every second

  constructor(criteria?: Partial<PerformanceCriteria>) {
    if (criteria) {
      this.criteria = { ...this.criteria, ...criteria };
    }
  }

  /**
   * Start performance monitoring
   */
  public startMonitoring(wrapper: NativeLive2DWrapper): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    this.lastFrameTime = performance.now();

    // Set up periodic sampling
    this.monitoringInterval = window.setInterval(() => {
      if (wrapper && wrapper.isInitialized()) {
        this.sample(wrapper);
      }
    }, this.samplingIntervalMs);
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;

    if (this.monitoringInterval !== null) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    // Clear history
    this.clearHistory();
  }

  /**
   * Take a performance sample
   */
  private sample(wrapper: NativeLive2DWrapper): void {
    const now = performance.now();
    const frameTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // FPS measurement
    const fps = this.measureFPS(wrapper);
    this.addToHistory(this.fpsHistory, fps);

    // Memory measurement
    const memory = this.measureMemory();
    this.addToHistory(this.memoryHistory, memory);
    this.peakMemory = Math.max(this.peakMemory, memory);

    // Frame time tracking
    this.addToHistory(this.frameTimeHistory, frameTime);
  }

  /**
   * Measure current FPS from wrapper
   */
  public measureFPS(wrapper: NativeLive2DWrapper): number {
    if (!wrapper || !wrapper.isInitialized()) {
      return 0;
    }
    return wrapper.getCurrentFPS();
  }

  /**
   * Measure current memory usage in MB
   */
  public measureMemory(): number {
    // Use Performance API if available (Chrome/Edge)
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / 1048576; // Convert bytes to MB
    }

    // Fallback: estimate based on canvas and model data
    // This is a rough estimation when Performance API is not available
    return 0;
  }

  /**
   * Estimate CPU usage based on frame processing time
   */
  public measureCPU(): number {
    if (this.frameTimeHistory.length === 0) {
      return 0;
    }

    // Estimate CPU based on frame time
    // Assuming 60 FPS target = 16.67ms per frame
    const targetFrameTime = 16.67;
    const avgFrameTime = this.calculateAverage(this.frameTimeHistory);

    // Calculate percentage of time spent processing
    // Cap at 100% for frames that take longer than target
    const cpuEstimate = Math.min(100, (avgFrameTime / targetFrameTime) * 30);

    return Math.round(cpuEstimate);
  }

  /**
   * Get comprehensive performance report
   */
  public getReport(wrapper?: NativeLive2DWrapper): PerformanceReport {
    const currentFPS = wrapper ? this.measureFPS(wrapper) : 0;
    const currentMemory = this.measureMemory();
    const avgFPS = this.calculateAverage(this.fpsHistory);
    const estimatedCPU = this.measureCPU();
    const avgFrameTime = this.calculateAverage(this.frameTimeHistory);

    return {
      averageFPS: Math.round(avgFPS),
      currentFPS: Math.round(currentFPS),
      currentMemoryMB: Math.round(currentMemory * 10) / 10,
      peakMemoryMB: Math.round(this.peakMemory * 10) / 10,
      estimatedCPU: estimatedCPU,
      frameTime: Math.round(avgFrameTime * 100) / 100,
      passed: this.checkPerformanceCriteria(avgFPS, currentMemory, estimatedCPU),
      timestamp: Date.now(),
    };
  }

  /**
   * Check if performance meets criteria
   */
  private checkPerformanceCriteria(
    avgFPS: number,
    memory: number,
    cpu: number
  ): boolean {
    return (
      avgFPS >= this.criteria.minFPS &&
      memory <= this.criteria.maxMemoryMB &&
      cpu <= this.criteria.maxCPU
    );
  }

  /**
   * Calculate average of numeric array
   */
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Add value to history array with size limit
   */
  private addToHistory(history: number[], value: number): void {
    history.push(value);
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Clear all history
   */
  public clearHistory(): void {
    this.fpsHistory = [];
    this.memoryHistory = [];
    this.frameTimeHistory = [];
    this.peakMemory = 0;
  }

  /**
   * Get performance criteria
   */
  public getCriteria(): PerformanceCriteria {
    return { ...this.criteria };
  }

  /**
   * Update performance criteria
   */
  public setCriteria(criteria: Partial<PerformanceCriteria>): void {
    this.criteria = { ...this.criteria, ...criteria };
  }

  /**
   * Get monitoring status
   */
  public isActivelyMonitoring(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get current history sizes
   */
  public getHistorySizes(): {
    fps: number;
    memory: number;
    frameTime: number;
  } {
    return {
      fps: this.fpsHistory.length,
      memory: this.memoryHistory.length,
      frameTime: this.frameTimeHistory.length,
    };
  }

  /**
   * Export performance data for analysis
   */
  public exportData(): {
    fpsHistory: number[];
    memoryHistory: number[];
    frameTimeHistory: number[];
    peakMemory: number;
    criteria: PerformanceCriteria;
  } {
    return {
      fpsHistory: [...this.fpsHistory],
      memoryHistory: [...this.memoryHistory],
      frameTimeHistory: [...this.frameTimeHistory],
      peakMemory: this.peakMemory,
      criteria: { ...this.criteria },
    };
  }
}