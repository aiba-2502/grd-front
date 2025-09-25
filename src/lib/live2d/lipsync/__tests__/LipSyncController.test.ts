/**
 * LipSyncController Test Suite
 * TDD: Red Phase - Write failing tests first
 */

import { LipSyncController } from '../LipSyncController';
import { AudioAnalyzer } from '../AudioAnalyzer';
import { VowelDetector } from '../VowelDetector';
import { MOUTH_SHAPES } from '../constants';
import type { MouthParameters, LipSyncConfig, AudioFeatures } from '../types';

// Mock Live2D model
class MockLive2DModel {
  public parameters: Record<string, number> = {};

  setParameterValueById(id: string, value: number): void {
    this.parameters[id] = value;
  }

  getParameterValueById(id: string): number {
    return this.parameters[id] || 0;
  }
}

describe('LipSyncController', () => {
  let controller: LipSyncController;
  let mockModel: MockLive2DModel;
  let audioAnalyzer: AudioAnalyzer;
  let vowelDetector: VowelDetector;

  beforeEach(() => {
    mockModel = new MockLive2DModel();
    audioAnalyzer = new AudioAnalyzer();
    vowelDetector = new VowelDetector();
    controller = new LipSyncController(mockModel as any, audioAnalyzer, vowelDetector);
  });

  afterEach(() => {
    controller.dispose();
    audioAnalyzer.dispose();
    vowelDetector.dispose();
  });

  describe('Day 7: パラメータマッピング', () => {
    it('母音を口形パラメータに変換する', () => {
      const params = controller.vowelToParams('a');

      expect(params).toEqual({
        ParamMouthOpenY: 1.0,
        ParamMouthForm: 0.0,
        ParamMouthOpenX: 0.3
      });
    });

    it('各母音に対して正しいパラメータを返す', () => {
      const paramsI = controller.vowelToParams('i');
      expect(paramsI).toEqual(MOUTH_SHAPES.i);

      const paramsU = controller.vowelToParams('u');
      expect(paramsU).toEqual(MOUTH_SHAPES.u);

      const paramsE = controller.vowelToParams('e');
      expect(paramsE).toEqual(MOUTH_SHAPES.e);

      const paramsO = controller.vowelToParams('o');
      expect(paramsO).toEqual(MOUTH_SHAPES.o);

      const paramsSilent = controller.vowelToParams('silent');
      expect(paramsSilent).toEqual(MOUTH_SHAPES.silent);
    });

    it('パラメータを正規化する', () => {
      const params: MouthParameters = {
        ParamMouthOpenY: 2.0, // 範囲外
        ParamMouthForm: -2.0,  // 範囲外
        ParamMouthOpenX: 1.5   // 範囲外
      };

      const normalized = controller.normalizeParams(params);

      expect(normalized.ParamMouthOpenY).toBe(1.0);
      expect(normalized.ParamMouthForm).toBe(-1.0);
      expect(normalized.ParamMouthOpenX).toBe(1.0);
    });

    it('モデルにパラメータを適用する', () => {
      const params: MouthParameters = {
        ParamMouthOpenY: 0.5,
        ParamMouthForm: 0.2,
        ParamMouthOpenX: 0.3
      };

      controller.applyParams(params);

      expect(mockModel.getParameterValueById('ParamMouthOpenY')).toBe(0.5);
      expect(mockModel.getParameterValueById('ParamMouthForm')).toBe(0.2);
      expect(mockModel.getParameterValueById('ParamMouthOpenX')).toBe(0.3);
    });

    it('カスタムマッピングを設定できる', () => {
      const customMapping = {
        a: { ParamMouthOpenY: 0.8, ParamMouthForm: 0.1, ParamMouthOpenX: 0.4 }
      };

      controller.setCustomMapping(customMapping);
      const params = controller.vowelToParams('a');

      expect(params.ParamMouthOpenY).toBe(0.8);
      expect(params.ParamMouthForm).toBe(0.1);
      expect(params.ParamMouthOpenX).toBe(0.4);
    });
  });

  describe('Day 8: スムージング処理', () => {
    it('パラメータ遷移を滑らかにする', () => {
      const from: MouthParameters = { ParamMouthOpenY: 0, ParamMouthForm: 0 };
      const to: MouthParameters = { ParamMouthOpenY: 1, ParamMouthForm: 0 };
      const deltaTime = 0.016; // 60FPSの1フレーム

      const smoothed = controller.smooth(from, to, deltaTime);

      // スムージング係数に応じた値
      expect(smoothed.ParamMouthOpenY).toBeGreaterThan(0);
      expect(smoothed.ParamMouthOpenY).toBeLessThan(1);
    });

    it('線形補間（LERP）が正しく動作する', () => {
      const from: MouthParameters = { ParamMouthOpenY: 0, ParamMouthForm: -1 };
      const to: MouthParameters = { ParamMouthOpenY: 1, ParamMouthForm: 1 };

      const lerped = controller.lerp(from, to, 0.5);

      expect(lerped.ParamMouthOpenY).toBe(0.5);
      expect(lerped.ParamMouthForm).toBe(0);
    });

    it('イージング関数を適用できる', () => {
      // easeInOutQuad
      expect(controller.easeInOutQuad(0)).toBe(0);
      expect(controller.easeInOutQuad(0.5)).toBeCloseTo(0.5, 2);
      expect(controller.easeInOutQuad(1)).toBe(1);

      // easeOutExpo
      expect(controller.easeOutExpo(0)).toBe(0);
      expect(controller.easeOutExpo(1)).toBeCloseTo(1, 2);
    });

    it('フレームレート非依存処理が動作する', () => {
      const config: LipSyncConfig = {
        smoothingFactor: 0.8,
        minConfidence: 0.3,
        updateInterval: 16 // 60FPS
      };

      controller.setConfig(config);

      // 異なるフレームレートでも同じ結果
      const result30fps = controller.calculateSmoothingAlpha(33.33); // 30FPS
      const result60fps = controller.calculateSmoothingAlpha(16.67); // 60FPS

      // 30FPSの方がより大きなアルファ値（より速い変化）
      expect(result30fps).toBeGreaterThan(result60fps);
    });
  });

  describe('リアルタイム処理', () => {
    it('音声データからリップシンクを実行する', async () => {
      const audioBuffer = new Float32Array(2048).fill(0.5);

      await controller.processAudio(audioBuffer);

      // パラメータが更新されている
      expect(mockModel.getParameterValueById('ParamMouthOpenY')).toBeGreaterThan(0);
    });

    it('最小信頼度以下の場合は更新しない', async () => {
      const config: LipSyncConfig = {
        smoothingFactor: 0.8,
        minConfidence: 0.9, // 高い閾値
        updateInterval: 16
      };

      controller.setConfig(config);

      // 初期値を設定
      mockModel.setParameterValueById('ParamMouthOpenY', 0);

      // ノイズデータ（低信頼度）
      const audioBuffer = new Float32Array(2048);
      for (let i = 0; i < audioBuffer.length; i++) {
        audioBuffer[i] = Math.random() * 0.001;
      }

      await controller.processAudio(audioBuffer);

      // パラメータが更新されていない
      expect(mockModel.getParameterValueById('ParamMouthOpenY')).toBe(0);
    });

    it('更新間隔を制御できる', async () => {
      const config: LipSyncConfig = {
        smoothingFactor: 0.8,
        minConfidence: 0.3,
        updateInterval: 100 // 100ms
      };

      controller.setConfig(config);

      let updateCount = 0;
      controller.onUpdate = () => updateCount++;

      const audioBuffer = new Float32Array(2048).fill(0.5);

      // 複数回実行
      await controller.processAudio(audioBuffer);
      await new Promise(resolve => setTimeout(resolve, 50));
      await controller.processAudio(audioBuffer);
      await new Promise(resolve => setTimeout(resolve, 60));
      await controller.processAudio(audioBuffer);

      // 更新間隔により、3回中2回のみ更新
      expect(updateCount).toBe(2);
    });
  });

  describe('統合テスト', () => {
    it('エンドツーエンドのリップシンク処理', async () => {
      // VowelDetectorをモックして確実に「あ」を返すようにする
      jest.spyOn(vowelDetector, 'identify').mockReturnValue({
        vowel: 'a',
        confidence: 0.9,
        alternatives: []
      });

      // 更新間隔を短くして確実に処理されるように
      controller.setConfig({
        smoothingFactor: 0.3,
        minConfidence: 0.1,
        updateInterval: 0
      });

      // 音声データ
      const audioBuffer = new Float32Array(2048).fill(0.5);

      // 処理実行
      await controller.processAudio(audioBuffer);

      // 「あ」の口形パラメータが適用されている
      const mouthOpenY = mockModel.getParameterValueById('ParamMouthOpenY');
      const mouthForm = mockModel.getParameterValueById('ParamMouthForm');

      // パラメータが更新されていることを確認
      expect(mouthOpenY).toBeGreaterThan(0.5); // 「あ」は口が開く
      expect(Math.abs(mouthForm)).toBeLessThan(0.3); // 「あ」は中間的な形
    });

    it('母音遷移を滑らかに処理する', async () => {
      const transitions: number[] = [];

      controller.onUpdate = (params: MouthParameters) => {
        transitions.push(params.ParamMouthOpenY);
      };

      // 「あ」から「い」への遷移
      await controller.processAudio(generateVowelAudio('a'));
      await new Promise(resolve => setTimeout(resolve, 20));
      await controller.processAudio(generateVowelAudio('i'));
      await new Promise(resolve => setTimeout(resolve, 20));
      await controller.processAudio(generateVowelAudio('i'));

      // 遷移が滑らか（急激な変化がない）
      for (let i = 1; i < transitions.length; i++) {
        const diff = Math.abs(transitions[i] - transitions[i - 1]);
        expect(diff).toBeLessThan(0.5); // 急激な変化なし
      }
    });

    it('パフォーマンスが十分である', async () => {
      const audioBuffer = new Float32Array(2048).fill(0.5);

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        await controller.processAudio(audioBuffer);
      }
      const elapsed = performance.now() - start;

      // 100回の処理が1秒以内
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe('リソース管理', () => {
    it('正しく初期化される', () => {
      expect(controller.isActive()).toBe(true);
    });

    it('開始と停止ができる', () => {
      controller.stop();
      expect(controller.isActive()).toBe(false);

      controller.start();
      expect(controller.isActive()).toBe(true);
    });

    it('破棄後は処理を受け付けない', async () => {
      controller.dispose();

      const audioBuffer = new Float32Array(2048);
      await expect(controller.processAudio(audioBuffer))
        .rejects.toThrow('LipSyncController is disposed');
    });
  });
});

// Helper functions
function generateVowelAudio(vowel: 'a' | 'i' | 'u' | 'e' | 'o'): Float32Array {
  const buffer = new Float32Array(2048);

  // より強い信号で母音をシミュレーション
  const formants = {
    a: { f1: 800, f2: 1400 },
    i: { f1: 300, f2: 2500 },
    u: { f1: 350, f2: 850 },
    e: { f1: 500, f2: 2100 },
    o: { f1: 525, f2: 1000 }
  };

  const { f1, f2 } = formants[vowel];
  const sampleRate = 48000;

  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    // 振幅を大きくして確実に検出されるようにする
    buffer[i] = 0.5 * Math.sin(2 * Math.PI * f1 * t) +
                0.5 * Math.sin(2 * Math.PI * f2 * t) +
                0.2 * Math.sin(2 * Math.PI * 200 * t); // 基本周波数
  }

  return buffer;
}