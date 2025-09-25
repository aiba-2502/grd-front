/**
 * PerformanceMonitor Test Suite
 * Live2Dパフォーマンス監視機能のテスト
 */

import { PerformanceMonitor } from './PerformanceMonitor';
import { NativeLive2DWrapper } from './NativeLive2DWrapper';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let mockWrapper: NativeLive2DWrapper;

  beforeEach(() => {
    monitor = new PerformanceMonitor();

    // Mock NativeLive2DWrapper
    mockWrapper = {
      isInitialized: jest.fn().mockReturnValue(true),
      getCurrentFPS: jest.fn().mockReturnValue(60),
    } as any;

    // Mock performance.now()
    jest.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    monitor.stopMonitoring();
    jest.clearAllMocks();
  });

  describe('初期化と基準設定', () => {
    it('デフォルトのパフォーマンス基準で初期化される', () => {
      const criteria = monitor.getCriteria();

      expect(criteria.minFPS).toBe(30);
      expect(criteria.maxMemoryMB).toBe(100);
      expect(criteria.maxCPU).toBe(30);
    });

    it('カスタム基準で初期化できる', () => {
      const customMonitor = new PerformanceMonitor({
        minFPS: 25,
        maxMemoryMB: 150,
        maxCPU: 40,
      });

      const criteria = customMonitor.getCriteria();

      expect(criteria.minFPS).toBe(25);
      expect(criteria.maxMemoryMB).toBe(150);
      expect(criteria.maxCPU).toBe(40);
    });

    it('基準を動的に更新できる', () => {
      monitor.setCriteria({ minFPS: 20 });

      const criteria = monitor.getCriteria();

      expect(criteria.minFPS).toBe(20);
      expect(criteria.maxMemoryMB).toBe(100); // 変更されていない
      expect(criteria.maxCPU).toBe(30); // 変更されていない
    });
  });

  describe('モニタリング制御', () => {
    it('モニタリングを開始できる', () => {
      expect(monitor.isActivelyMonitoring()).toBe(false);

      monitor.startMonitoring(mockWrapper);

      expect(monitor.isActivelyMonitoring()).toBe(true);
    });

    it('モニタリングを停止できる', () => {
      monitor.startMonitoring(mockWrapper);
      expect(monitor.isActivelyMonitoring()).toBe(true);

      monitor.stopMonitoring();

      expect(monitor.isActivelyMonitoring()).toBe(false);
    });

    it('重複したモニタリング開始を防ぐ', () => {
      monitor.startMonitoring(mockWrapper);
      const firstInterval = (monitor as any).monitoringInterval;

      monitor.startMonitoring(mockWrapper);
      const secondInterval = (monitor as any).monitoringInterval;

      expect(firstInterval).toBe(secondInterval);
    });

    it('モニタリング停止時に履歴がクリアされる', () => {
      monitor.startMonitoring(mockWrapper);
      jest.advanceTimersByTime(2000);

      const sizesBefore = monitor.getHistorySizes();
      expect(sizesBefore.fps).toBeGreaterThan(0);

      monitor.stopMonitoring();

      const sizesAfter = monitor.getHistorySizes();
      expect(sizesAfter.fps).toBe(0);
      expect(sizesAfter.memory).toBe(0);
      expect(sizesAfter.frameTime).toBe(0);
    });
  });

  describe('FPS測定', () => {
    it('WrapperからFPSを取得できる', () => {
      const fps = monitor.measureFPS(mockWrapper);

      expect(fps).toBe(60);
      expect(mockWrapper.getCurrentFPS).toHaveBeenCalled();
    });

    it('初期化されていないWrapperでは0を返す', () => {
      const uninitWrapper = {
        isInitialized: jest.fn().mockReturnValue(false),
        getCurrentFPS: jest.fn(),
      } as any;

      const fps = monitor.measureFPS(uninitWrapper);

      expect(fps).toBe(0);
      expect(uninitWrapper.getCurrentFPS).not.toHaveBeenCalled();
    });

    it('nullのWrapperでは0を返す', () => {
      const fps = monitor.measureFPS(null as any);

      expect(fps).toBe(0);
    });
  });

  describe('メモリ測定', () => {
    it('Performance APIが利用可能な場合はメモリ使用量を返す', () => {
      // Mock performance.memory
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 52428800, // 50MB
        },
        configurable: true,
      });

      const memory = monitor.measureMemory();

      expect(memory).toBe(50);
    });

    it('Performance APIが利用できない場合は0を返す', () => {
      // Remove performance.memory
      delete (performance as any).memory;

      const memory = monitor.measureMemory();

      expect(memory).toBe(0);
    });
  });

  describe('CPU使用率推定', () => {
    it('フレーム時間履歴がない場合は0を返す', () => {
      const cpu = monitor.measureCPU();

      expect(cpu).toBe(0);
    });

    it('フレーム時間に基づいてCPU使用率を推定する', () => {
      // フレーム時間履歴を追加
      (monitor as any).frameTimeHistory = [10, 12, 15, 20, 18];

      const cpu = monitor.measureCPU();

      // 平均フレーム時間: (10+12+15+20+18)/5 = 15ms
      // CPU推定: (15/16.67) * 30 ≈ 27%
      expect(cpu).toBeCloseTo(27, 0);
    });

    it('100%を超えないようにキャップされる', () => {
      // 非常に長いフレーム時間
      (monitor as any).frameTimeHistory = [100, 120, 150];

      const cpu = monitor.measureCPU();

      expect(cpu).toBeLessThanOrEqual(100);
    });
  });

  describe('パフォーマンスレポート', () => {
    it('包括的なレポートを生成できる', () => {
      monitor.startMonitoring(mockWrapper);
      jest.advanceTimersByTime(2000);

      const report = monitor.getReport(mockWrapper);

      expect(report).toHaveProperty('averageFPS');
      expect(report).toHaveProperty('currentFPS');
      expect(report).toHaveProperty('currentMemoryMB');
      expect(report).toHaveProperty('peakMemoryMB');
      expect(report).toHaveProperty('estimatedCPU');
      expect(report).toHaveProperty('frameTime');
      expect(report).toHaveProperty('passed');
      expect(report).toHaveProperty('timestamp');

      expect(report.currentFPS).toBe(60);
      expect(report.timestamp).toBeGreaterThan(0);
    });

    it('パフォーマンス基準のチェックが正しく動作する', () => {
      // 低いFPSを返すようにモック
      mockWrapper.getCurrentFPS = jest.fn().mockReturnValue(20);

      monitor.startMonitoring(mockWrapper);
      jest.advanceTimersByTime(2000);

      const report = monitor.getReport(mockWrapper);

      expect(report.passed).toBe(false);
    });

    it('すべての基準を満たす場合はpassedがtrueになる', () => {
      // 良好なパフォーマンスをモック
      mockWrapper.getCurrentFPS = jest.fn().mockReturnValue(60);
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 31457280, // 30MB
        },
        configurable: true,
      });

      monitor.startMonitoring(mockWrapper);
      jest.advanceTimersByTime(2000);

      const report = monitor.getReport(mockWrapper);

      expect(report.passed).toBe(true);
    });
  });

  describe('履歴管理', () => {
    it('履歴サイズが制限される', () => {
      monitor.startMonitoring(mockWrapper);

      // 履歴制限を超えるまでサンプリング
      for (let i = 0; i < 150; i++) {
        jest.advanceTimersByTime(1000);
      }

      const sizes = monitor.getHistorySizes();

      expect(sizes.fps).toBeLessThanOrEqual(100);
      expect(sizes.memory).toBeLessThanOrEqual(100);
      expect(sizes.frameTime).toBeLessThanOrEqual(100);
    });

    it('履歴をクリアできる', () => {
      monitor.startMonitoring(mockWrapper);
      jest.advanceTimersByTime(5000);

      const sizesBefore = monitor.getHistorySizes();
      expect(sizesBefore.fps).toBeGreaterThan(0);

      monitor.clearHistory();

      const sizesAfter = monitor.getHistorySizes();
      expect(sizesAfter.fps).toBe(0);
      expect(sizesAfter.memory).toBe(0);
      expect(sizesAfter.frameTime).toBe(0);
    });
  });

  describe('データエクスポート', () => {
    it('パフォーマンスデータをエクスポートできる', () => {
      monitor.startMonitoring(mockWrapper);
      jest.advanceTimersByTime(3000);

      const data = monitor.exportData();

      expect(data).toHaveProperty('fpsHistory');
      expect(data).toHaveProperty('memoryHistory');
      expect(data).toHaveProperty('frameTimeHistory');
      expect(data).toHaveProperty('peakMemory');
      expect(data).toHaveProperty('criteria');

      expect(Array.isArray(data.fpsHistory)).toBe(true);
      expect(Array.isArray(data.memoryHistory)).toBe(true);
      expect(Array.isArray(data.frameTimeHistory)).toBe(true);
    });

    it('エクスポートされたデータは元の配列のコピーである', () => {
      monitor.startMonitoring(mockWrapper);
      jest.advanceTimersByTime(2000);

      const data1 = monitor.exportData();
      const originalLength = data1.fpsHistory.length;

      // さらにサンプリング
      jest.advanceTimersByTime(2000);

      // 最初のエクスポートデータは変更されない
      expect(data1.fpsHistory.length).toBe(originalLength);

      // 新しいエクスポートには更新されたデータが含まれる
      const data2 = monitor.exportData();
      expect(data2.fpsHistory.length).toBeGreaterThan(originalLength);
    });
  });

  describe('ピークメモリ追跡', () => {
    it('ピークメモリ使用量を追跡する', () => {
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 52428800, // 50MB
        },
        configurable: true,
      });

      monitor.startMonitoring(mockWrapper);
      jest.advanceTimersByTime(1000);

      // メモリを増加させる
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 78643200, // 75MB
        },
        configurable: true,
      });
      jest.advanceTimersByTime(1000);

      // メモリを減少させる
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 62914560, // 60MB
        },
        configurable: true,
      });
      jest.advanceTimersByTime(1000);

      const report = monitor.getReport(mockWrapper);

      expect(report.peakMemoryMB).toBe(75);
      expect(report.currentMemoryMB).toBe(60);
    });
  });
});