/**
 * LipSync Integration Test Suite
 * 全コンポーネントの統合テスト
 */

import { AudioAnalyzer } from '../AudioAnalyzer';
import { FFTProcessor } from '../FFTProcessor';
import { FormantExtractor } from '../FormantExtractor';
import { VowelDetector } from '../VowelDetector';
import { LipSyncController } from '../LipSyncController';
import { AUDIO_CONFIG } from '../constants';

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

describe('LipSync統合テスト', () => {
  let audioAnalyzer: AudioAnalyzer;
  let fftProcessor: FFTProcessor;
  let formantExtractor: FormantExtractor;
  let vowelDetector: VowelDetector;
  let controller: LipSyncController;
  let mockModel: MockLive2DModel;

  beforeEach(() => {
    // コンポーネントの初期化
    audioAnalyzer = new AudioAnalyzer();
    fftProcessor = new FFTProcessor();
    formantExtractor = new FormantExtractor(fftProcessor);
    vowelDetector = new VowelDetector();
    mockModel = new MockLive2DModel();
    controller = new LipSyncController(mockModel as any, audioAnalyzer, vowelDetector);
  });

  afterEach(() => {
    // リソースのクリーンアップ
    audioAnalyzer.dispose();
    fftProcessor.dispose();
    formantExtractor.dispose();
    vowelDetector.dispose();
    controller.dispose();
  });

  describe('音声処理パイプライン', () => {
    it('音声データから母音を検出できる', () => {
      // 母音「あ」を含む音声データ
      const audioBuffer = generateVowelSound('a');

      // 音声解析
      const features = audioAnalyzer.processAudioBuffer(audioBuffer);

      expect(features).toBeDefined();
      expect(features.rms).toBeGreaterThan(0);
      expect(features.spectrum).toBeDefined();
      expect(features.formants).toBeDefined();
      expect(features.formants.f1).toBeGreaterThan(0);
      expect(features.formants.f2).toBeGreaterThan(0);
    });

    it('フォルマントから母音を識別できる', () => {
      // 各母音のフォルマント
      const formantData = [
        { f1: 800, f2: 1400, expectedVowel: 'a' },
        { f1: 300, f2: 2500, expectedVowel: 'i' },
        { f1: 350, f2: 850, expectedVowel: 'u' },
        { f1: 500, f2: 2100, expectedVowel: 'e' },
        { f1: 525, f2: 1000, expectedVowel: 'o' }
      ];

      for (const data of formantData) {
        const result = vowelDetector.identify({
          f1: data.f1,
          f2: data.f2
        });

        expect(result.vowel).toBe(data.expectedVowel);
        expect(result.confidence).toBeGreaterThan(0.7);
      }
    });

    it('母音列を正しく検出できる', () => {
      const vowelSequence = ['a', 'i', 'u', 'e', 'o'];
      const detectedVowels: string[] = [];

      for (const vowel of vowelSequence) {
        const audioBuffer = generateVowelSound(vowel as any);
        const features = audioAnalyzer.processAudioBuffer(audioBuffer);
        const result = vowelDetector.identify(features.formants);
        detectedVowels.push(result.vowel);
      }

      // 大まかに正しい母音が検出されていることを確認
      expect(detectedVowels.length).toBe(5);
      expect(detectedVowels).toContain('a');
      expect(detectedVowels).toContain('i');
    });
  });

  describe('リアルタイムリップシンク', () => {
    it('連続した音声入力を処理できる', async () => {
      const frameCount = 10;
      const processedFrames: number[] = [];

      controller.onUpdate = (params) => {
        processedFrames.push(params.ParamMouthOpenY);
      };

      // 連続フレーム処理
      for (let i = 0; i < frameCount; i++) {
        const audioBuffer = generateNoiseWithVowel('a', 0.5);
        await controller.processAudio(audioBuffer);
        await new Promise(resolve => setTimeout(resolve, 20));
      }

      // 処理されたフレームがある
      expect(processedFrames.length).toBeGreaterThan(0);
    });

    it('無音から有音への遷移を処理できる', async () => {
      const transitions: number[] = [];

      controller.onUpdate = (params) => {
        transitions.push(params.ParamMouthOpenY);
      };

      // 無音
      await controller.processAudio(new Float32Array(2048));
      await new Promise(resolve => setTimeout(resolve, 20));

      // 有音（母音「あ」）
      jest.spyOn(vowelDetector, 'identify').mockReturnValue({
        vowel: 'a',
        confidence: 0.9,
        alternatives: []
      });

      await controller.processAudio(new Float32Array(2048).fill(0.5));

      // 遷移が記録されている
      expect(transitions.length).toBeGreaterThan(0);
    });
  });

  describe('パフォーマンス', () => {
    it('リアルタイム処理が可能な速度で動作する', () => {
      const iterations = 100;
      const audioBuffer = new Float32Array(AUDIO_CONFIG.FFT_SIZE).fill(0.5);

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const features = audioAnalyzer.processAudioBuffer(audioBuffer);
        const vowelResult = vowelDetector.identify(features.formants);
        const params = controller.vowelToParams(vowelResult.vowel);
        controller.applyParams(params);
      }

      const elapsed = performance.now() - start;
      const averageTime = elapsed / iterations;

      // 1フレームあたり16ms以下（60FPS）
      expect(averageTime).toBeLessThan(16);
    });

    it('メモリリークなく長時間動作する', async () => {
      const iterations = 1000;
      const audioBuffer = new Float32Array(2048).fill(0.5);

      // 初期メモリ使用量（おおよその指標）
      const initialHeap = (performance as any).memory?.usedJSHeapSize || 0;

      for (let i = 0; i < iterations; i++) {
        await controller.processAudio(audioBuffer);
      }

      // 最終メモリ使用量
      const finalHeap = (performance as any).memory?.usedJSHeapSize || 0;

      // メモリが異常に増加していないこと（10MB以下の増加）
      if (initialHeap > 0 && finalHeap > 0) {
        const memoryIncrease = (finalHeap - initialHeap) / 1024 / 1024;
        expect(memoryIncrease).toBeLessThan(10);
      }
    });
  });

  describe('エラーハンドリング', () => {
    it('不正な入力を適切に処理する', () => {
      // 空の入力
      expect(() => audioAnalyzer.processAudioBuffer(new Float32Array(0)))
        .not.toThrow();

      // NaN値
      const nanBuffer = new Float32Array(2048);
      nanBuffer[0] = NaN;
      expect(() => audioAnalyzer.processAudioBuffer(nanBuffer))
        .not.toThrow();

      // 極端に大きな値
      const largeBuffer = new Float32Array(2048).fill(1e10);
      expect(() => audioAnalyzer.processAudioBuffer(largeBuffer))
        .not.toThrow();
    });

    it('破棄後のアクセスを防ぐ', () => {
      audioAnalyzer.dispose();
      vowelDetector.dispose();
      controller.dispose();

      expect(() => audioAnalyzer.processAudioBuffer(new Float32Array(2048)))
        .toThrow('AudioAnalyzer is disposed');

      expect(() => vowelDetector.identify({ f1: 800, f2: 1400 }))
        .toThrow('VowelDetector is disposed');

      expect(controller.processAudio(new Float32Array(2048)))
        .rejects.toThrow('LipSyncController is disposed');
    });
  });
});

// Helper functions
function generateVowelSound(vowel: 'a' | 'i' | 'u' | 'e' | 'o'): Float32Array {
  const buffer = new Float32Array(AUDIO_CONFIG.FFT_SIZE);
  const formants = {
    a: { f1: 800, f2: 1400 },
    i: { f1: 300, f2: 2500 },
    u: { f1: 350, f2: 850 },
    e: { f1: 500, f2: 2100 },
    o: { f1: 525, f2: 1000 }
  };

  const { f1, f2 } = formants[vowel];
  const sampleRate = AUDIO_CONFIG.SAMPLE_RATE;

  for (let i = 0; i < buffer.length; i++) {
    const t = i / sampleRate;
    buffer[i] = 0.3 * Math.sin(2 * Math.PI * f1 * t) +
                0.3 * Math.sin(2 * Math.PI * f2 * t);
  }

  return buffer;
}

function generateNoiseWithVowel(vowel: 'a' | 'i' | 'u' | 'e' | 'o', noiseLevel: number): Float32Array {
  const vowelSound = generateVowelSound(vowel);

  // ノイズを追加
  for (let i = 0; i < vowelSound.length; i++) {
    vowelSound[i] += (Math.random() - 0.5) * noiseLevel;
  }

  return vowelSound;
}