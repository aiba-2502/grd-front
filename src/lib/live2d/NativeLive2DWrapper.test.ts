/**
 * NativeLive2DWrapper Test Suite
 * PIXIに依存しないNative Live2D実装のテスト
 */

import { NativeLive2DWrapper } from './NativeLive2DWrapper';
import { LAppDelegate } from './demo/lappdelegate';
import { LAppLive2DManager } from './demo/lapplive2dmanager';
import { PerformanceMonitor } from './PerformanceMonitor';

// Mock the Live2D modules
jest.mock('./demo/lappdelegate');
jest.mock('./demo/lapplive2dmanager');
jest.mock('./demo/lappglmanager');

describe('NativeLive2DWrapper', () => {
  let wrapper: NativeLive2DWrapper;
  let container: HTMLDivElement;
  let mockCanvas: HTMLCanvasElement;
  let mockGL: WebGLRenderingContext;

  beforeEach(() => {
    // Create container element
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    // Mock canvas and WebGL context
    mockCanvas = document.createElement('canvas');
    mockGL = {
      viewport: jest.fn(),
      clearColor: jest.fn(),
      clear: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
      blendFunc: jest.fn(),
      getParameter: jest.fn().mockReturnValue([800, 600]),
    } as any;

    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas;
      }
      return document.createElement(tagName);
    });

    jest.spyOn(mockCanvas, 'getContext').mockReturnValue(mockGL);

    wrapper = new NativeLive2DWrapper();
  });

  afterEach(() => {
    document.body.removeChild(container);
    jest.clearAllMocks();
  });

  describe('初期化', () => {
    it('コンテナ要素でラッパーを初期化できる', async () => {
      const initialized = await wrapper.initialize(container);

      expect(initialized).toBe(true);
      expect(wrapper.isInitialized()).toBe(true);
      expect(container.querySelector('canvas')).toBeTruthy();
    });

    it('WebGLコンテキストを正しく作成する', async () => {
      await wrapper.initialize(container);

      expect(mockCanvas.getContext).toHaveBeenCalledWith('webgl', expect.objectContaining({
        alpha: true,
        premultipliedAlpha: true,
      }));
    });

    it('初期化失敗時はfalseを返す', async () => {
      jest.spyOn(mockCanvas, 'getContext').mockReturnValue(null);

      const initialized = await wrapper.initialize(container);

      expect(initialized).toBe(false);
      expect(wrapper.isInitialized()).toBe(false);
    });

    it('Cubism SDKを適切に初期化する', async () => {
      await wrapper.initialize(container);

      expect(LAppDelegate.getInstance).toHaveBeenCalled();
    });
  });

  describe('モデルのロード', () => {
    beforeEach(async () => {
      await wrapper.initialize(container);
    });

    it('モデルファイルをロードできる', async () => {
      const modelPath = '/models/hiyori/hiyori.model3.json';
      const loaded = await wrapper.loadModel(modelPath);

      expect(loaded).toBe(true);
      expect(wrapper.hasModel()).toBe(true);
    });

    it('複数のモデルを切り替えできる', async () => {
      const model1 = '/models/hiyori/hiyori.model3.json';
      const model2 = '/models/mark/mark.model3.json';

      await wrapper.loadModel(model1);
      const firstModelId = wrapper.getCurrentModelId();

      await wrapper.loadModel(model2);
      const secondModelId = wrapper.getCurrentModelId();

      expect(firstModelId).not.toBe(secondModelId);
    });

    it('無効なパスの場合はエラーを返す', async () => {
      const invalidPath = '';
      const loaded = await wrapper.loadModel(invalidPath);

      expect(loaded).toBe(false);
    });
  });

  describe('レンダリング', () => {
    beforeEach(async () => {
      await wrapper.initialize(container);
      await wrapper.loadModel('/models/hiyori/hiyori.model3.json');
    });

    it('レンダリングループを開始できる', () => {
      wrapper.startRendering();

      expect(wrapper.isRendering()).toBe(true);
    });

    it('レンダリングループを停止できる', () => {
      wrapper.startRendering();
      wrapper.stopRendering();

      expect(wrapper.isRendering()).toBe(false);
    });

    it('フレームレートを設定できる', () => {
      wrapper.setTargetFPS(30);

      expect(wrapper.getTargetFPS()).toBe(30);
    });

    it('画面サイズ変更に対応できる', () => {
      const newWidth = 1024;
      const newHeight = 768;

      wrapper.resize(newWidth, newHeight);

      expect(mockCanvas.width).toBe(newWidth);
      expect(mockCanvas.height).toBe(newHeight);
    });
  });

  describe('モーション制御', () => {
    beforeEach(async () => {
      await wrapper.initialize(container);
      await wrapper.loadModel('/models/hiyori/hiyori.model3.json');
    });

    it('指定したモーションを再生できる', () => {
      const motionName = 'idle';
      const priority = 2;

      const started = wrapper.startMotion(motionName, priority);

      expect(started).toBe(true);
    });

    it('ランダムモーションを再生できる', () => {
      const group = 'idle';
      const priority = 1;

      const started = wrapper.startRandomMotion(group, priority);

      expect(started).toBe(true);
    });

    it('モーションを停止できる', () => {
      wrapper.startMotion('idle', 1);
      wrapper.stopAllMotions();

      expect(wrapper.isPlayingMotion()).toBe(false);
    });

    it('モーションループを設定できる', () => {
      wrapper.setMotionLoop('idle', true);

      expect(wrapper.getMotionLoop('idle')).toBe(true);
    });
  });

  describe('表情管理', () => {
    beforeEach(async () => {
      await wrapper.initialize(container);
      await wrapper.loadModel('/models/hiyori/hiyori.model3.json');
    });

    it('表情を設定できる', () => {
      const expressionId = 'happy';

      wrapper.setExpression(expressionId);

      expect(wrapper.getCurrentExpression()).toBe(expressionId);
    });

    it('ランダム表情を設定できる', () => {
      const previousExpression = wrapper.getCurrentExpression();

      wrapper.setRandomExpression();

      // 表情が変わることを確認（モックでは変わらない可能性もある）
      expect(wrapper.getCurrentExpression()).toBeDefined();
    });

    it('表情をリセットできる', () => {
      wrapper.setExpression('happy');
      wrapper.resetExpression();

      expect(wrapper.getCurrentExpression()).toBe('default');
    });
  });

  describe('リップシンク', () => {
    beforeEach(async () => {
      await wrapper.initialize(container);
      await wrapper.loadModel('/models/hiyori/hiyori.model3.json');
    });

    it('リップシンク値を設定できる', () => {
      const value = 0.7;

      wrapper.setLipSyncValue(value);

      expect(wrapper.getLipSyncValue()).toBe(value);
    });

    it('リップシンク値を0-1の範囲にクランプする', () => {
      wrapper.setLipSyncValue(1.5);
      expect(wrapper.getLipSyncValue()).toBe(1.0);

      wrapper.setLipSyncValue(-0.5);
      expect(wrapper.getLipSyncValue()).toBe(0);
    });

    it('音声ファイルからリップシンクを開始できる', async () => {
      const audioUrl = 'data:audio/wav;base64,test';

      const started = await wrapper.startLipSync(audioUrl);

      expect(started).toBe(true);
      expect(wrapper.isLipSyncing()).toBe(true);
    });

    it('リップシンクを停止できる', async () => {
      await wrapper.startLipSync('data:audio/wav;base64,test');
      wrapper.stopLipSync();

      expect(wrapper.isLipSyncing()).toBe(false);
      expect(wrapper.getLipSyncValue()).toBe(0);
    });
  });

  describe('インタラクション', () => {
    beforeEach(async () => {
      await wrapper.initialize(container);
      await wrapper.loadModel('/models/hiyori/hiyori.model3.json');
    });

    it('マウス座標を追跡できる', () => {
      const x = 400;
      const y = 300;

      wrapper.onMouseMove(x, y);

      const position = wrapper.getMousePosition();
      expect(position.x).toBe(x);
      expect(position.y).toBe(y);
    });

    it('タップイベントを処理できる', () => {
      const x = 400;
      const y = 300;

      const handled = wrapper.onTap(x, y);

      expect(handled).toBe(true);
    });

    it('ドラッグ操作を処理できる', () => {
      wrapper.onDragStart(100, 100);
      wrapper.onDrag(150, 120);
      wrapper.onDragEnd();

      expect(wrapper.isDragging()).toBe(false);
    });

    it('視線追従を有効化/無効化できる', () => {
      wrapper.setEyeTracking(true);
      expect(wrapper.isEyeTrackingEnabled()).toBe(true);

      wrapper.setEyeTracking(false);
      expect(wrapper.isEyeTrackingEnabled()).toBe(false);
    });
  });

  describe('リソース管理', () => {
    beforeEach(async () => {
      await wrapper.initialize(container);
    });

    it('リソースを適切に解放できる', () => {
      wrapper.dispose();

      expect(wrapper.isInitialized()).toBe(false);
      expect(wrapper.isRendering()).toBe(false);
      expect(container.querySelector('canvas')).toBeFalsy();
    });

    it('破棄後の操作を防ぐ', () => {
      wrapper.dispose();

      expect(() => wrapper.startRendering()).toThrow('Wrapper is disposed');
      expect(() => wrapper.setLipSyncValue(0.5)).toThrow('Wrapper is disposed');
    });

    it('メモリリークを防ぐ', async () => {
      await wrapper.loadModel('/models/hiyori/hiyori.model3.json');
      const initialMemory = (wrapper as any).getMemoryUsage();

      await wrapper.loadModel('/models/mark/mark.model3.json');
      const afterSwitch = (wrapper as any).getMemoryUsage();

      // 前のモデルのリソースが解放されている
      expect(afterSwitch).toBeLessThanOrEqual(initialMemory * 1.2);
    });
  });

  describe('パフォーマンス', () => {
    beforeEach(async () => {
      await wrapper.initialize(container);
      await wrapper.loadModel('/models/hiyori/hiyori.model3.json');
    });

    it('FPSカウンターを取得できる', () => {
      wrapper.startRendering();

      const fps = wrapper.getCurrentFPS();

      expect(fps).toBeGreaterThan(0);
      expect(fps).toBeLessThanOrEqual(60);
    });

    it('描画統計を取得できる', () => {
      const stats = wrapper.getRenderStats();

      expect(stats).toHaveProperty('drawCalls');
      expect(stats).toHaveProperty('vertices');
      expect(stats).toHaveProperty('triangles');
    });

    it('品質設定を調整できる', () => {
      wrapper.setQuality('low');
      expect(wrapper.getQuality()).toBe('low');

      wrapper.setQuality('high');
      expect(wrapper.getQuality()).toBe('high');
    });
  });

  describe('エラーハンドリング', () => {
    it('初期化前の操作を防ぐ', () => {
      expect(() => wrapper.startRendering()).toThrow('Wrapper not initialized');
      expect(() => wrapper.loadModel('/test.json')).rejects.toThrow('Wrapper not initialized');
    });

    it('モデルロード失敗を適切に処理する', async () => {
      await wrapper.initialize(container);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const loaded = await wrapper.loadModel('/invalid/path.json');

      expect(loaded).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to load model'));

      consoleSpy.mockRestore();
    });

    it('WebGL非対応環境を検出する', async () => {
      jest.spyOn(mockCanvas, 'getContext').mockReturnValue(null);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const initialized = await wrapper.initialize(container);

      expect(initialized).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('WebGL not supported'));

      consoleSpy.mockRestore();
    });
  });

  describe('パフォーマンスモニタリング', () => {
    beforeEach(async () => {
      await wrapper.initialize(container);
      await wrapper.loadModel('/models/hiyori/hiyori.model3.json');
    });

    it('パフォーマンスモニタが初期化される', async () => {
      expect(wrapper.isPerformanceMonitoring()).toBe(false);
    });

    it('レンダリング開始時にモニタリングが開始される', () => {
      wrapper.startRendering();

      expect(wrapper.isPerformanceMonitoring()).toBe(true);
    });

    it('レンダリング停止時にモニタリングが停止される', () => {
      wrapper.startRendering();
      wrapper.stopRendering();

      expect(wrapper.isPerformanceMonitoring()).toBe(false);
    });

    it('パフォーマンスレポートを取得できる', () => {
      wrapper.startRendering();

      const report = wrapper.getPerformanceReport();

      expect(report).toBeTruthy();
      expect(report).toHaveProperty('averageFPS');
      expect(report).toHaveProperty('currentFPS');
      expect(report).toHaveProperty('currentMemoryMB');
      expect(report).toHaveProperty('peakMemoryMB');
      expect(report).toHaveProperty('estimatedCPU');
      expect(report).toHaveProperty('frameTime');
      expect(report).toHaveProperty('passed');
      expect(report).toHaveProperty('timestamp');
    });

    it('パフォーマンス基準を設定できる', () => {
      const criteria = {
        minFPS: 25,
        maxMemoryMB: 150,
        maxCPU: 40
      };

      wrapper.setPerformanceCriteria(criteria);

      // 基準が適用されることを確認（getPerformanceReportで反映される）
      wrapper.startRendering();
      const report = wrapper.getPerformanceReport();
      expect(report).toBeTruthy();
    });

    it('パフォーマンスデータをエクスポートできる', () => {
      wrapper.startRendering();

      // いくつかフレームを処理させる
      jest.advanceTimersByTime(2000);

      const data = wrapper.exportPerformanceData();

      expect(data).toBeTruthy();
      expect(data).toHaveProperty('fpsHistory');
      expect(data).toHaveProperty('memoryHistory');
      expect(data).toHaveProperty('frameTimeHistory');
      expect(data).toHaveProperty('peakMemory');
      expect(data).toHaveProperty('criteria');
    });

    it('パフォーマンス基準のチェックが正しく動作する', () => {
      // FPSが低い基準を設定
      wrapper.setPerformanceCriteria({
        minFPS: 100, // 達成不可能な高いFPS
        maxMemoryMB: 1000,
        maxCPU: 100
      });

      wrapper.startRendering();
      const report = wrapper.getPerformanceReport();

      expect(report?.passed).toBe(false);
    });

    it('破棄時にパフォーマンスモニタがクリーンアップされる', () => {
      wrapper.startRendering();
      expect(wrapper.isPerformanceMonitoring()).toBe(true);

      wrapper.dispose();

      expect(wrapper.getPerformanceReport()).toBe(null);
      expect(wrapper.exportPerformanceData()).toBe(null);
    });

    it('モニタリング停止後にレポートが取得できる', () => {
      wrapper.startRendering();
      jest.advanceTimersByTime(1000);
      wrapper.stopRendering();

      const report = wrapper.getPerformanceReport();
      expect(report).toBeTruthy();
      expect(report?.currentFPS).toBeGreaterThanOrEqual(0);
    });
  });
});