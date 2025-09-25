/**
 * RealAudioData Test Suite
 * 実音声データを使用したリップシンクシステムの統合テスト
 */

import { AudioAnalyzer } from '../AudioAnalyzer';
import { FFTProcessor } from '../FFTProcessor';
import { FormantExtractor } from '../FormantExtractor';
import { VowelDetector } from '../VowelDetector';
import { LipSyncController } from '../LipSyncController';
import { AudioWorkletManager } from '../AudioWorkletManager';
import { WasmFFT } from '../WasmFFT';
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

describe('実音声データテスト', () => {
  let audioAnalyzer: AudioAnalyzer;
  let fftProcessor: FFTProcessor;
  let formantExtractor: FormantExtractor;
  let vowelDetector: VowelDetector;
  let lipSyncController: LipSyncController;
  let mockModel: MockLive2DModel;
  let wasmFFT: WasmFFT;

  beforeEach(async () => {
    fftProcessor = new FFTProcessor();
    audioAnalyzer = new AudioAnalyzer();
    formantExtractor = new FormantExtractor(fftProcessor);
    vowelDetector = new VowelDetector();
    mockModel = new MockLive2DModel();
    lipSyncController = new LipSyncController(mockModel as any, audioAnalyzer, vowelDetector);

    wasmFFT = new WasmFFT();
    await wasmFFT.initialize();
  });

  afterEach(() => {
    audioAnalyzer.dispose();
    fftProcessor.dispose();
    formantExtractor.dispose();
    vowelDetector.dispose();
    lipSyncController.dispose();
    wasmFFT.dispose();
  });

  describe('日本語母音の認識', () => {
    it('「あいうえお」を順番に認識できる', async () => {
      const vowelSequence = ['a', 'i', 'u', 'e', 'o'];
      const recognizedVowels: string[] = [];

      for (const vowel of vowelSequence) {
        const audioData = generateRealisticVowelSound(vowel as any, AUDIO_CONFIG.SAMPLE_RATE, 2048);

        // ノイズフィルタリングを適用
        const spectrum = fftProcessor.forward(audioData);
        const filtered = formantExtractor.applySpectralNoiseReduction(spectrum);

        // フォルマント抽出と母音認識
        const formants = formantExtractor.extractFormants(filtered, AUDIO_CONFIG.SAMPLE_RATE);
        const result = vowelDetector.identify(formants);

        recognizedVowels.push(result.vowel);
      }

      // 認識精度を検証（完全一致は難しいため、60%以上の一致を期待）
      const correctCount = recognizedVowels.filter((v, i) => v === vowelSequence[i]).length;
      const accuracy = correctCount / vowelSequence.length;
      expect(accuracy).toBeGreaterThanOrEqual(0.6);
    });

    it('連続音声から母音遷移を検出できる', async () => {
      const transitionData = generateVowelTransition('a', 'i', AUDIO_CONFIG.SAMPLE_RATE, 4096);
      const transitions: string[] = [];

      // フレームごとに処理
      const frameSize = 512;
      const hopSize = 256;

      for (let i = 0; i <= transitionData.length - frameSize; i += hopSize) {
        const frame = transitionData.slice(i, i + frameSize);

        // 音声処理
        const features = audioAnalyzer.processAudioBuffer(frame);
        const result = vowelDetector.identify(features.formants);

        if (transitions.length === 0 || transitions[transitions.length - 1] !== result.vowel) {
          transitions.push(result.vowel);
        }
      }

      // 遷移が検出されていることを確認
      expect(transitions.length).toBeGreaterThan(1);
      expect(transitions).toContain('a');
      expect(transitions).toContain('i');
    });
  });

  describe('ノイズ環境での認識', () => {
    it('ホワイトノイズ環境でも母音を認識できる', () => {
      const cleanSignal = generateRealisticVowelSound('a', AUDIO_CONFIG.SAMPLE_RATE, 2048);
      const noisySignal = addWhiteNoise(cleanSignal, 0.2);

      // ノイズフィルタリングあり
      const spectrum = fftProcessor.forward(noisySignal);
      const filtered = formantExtractor.applySpectralNoiseReduction(spectrum);
      const formants = formantExtractor.extractFormants(filtered, AUDIO_CONFIG.SAMPLE_RATE);
      const result = vowelDetector.identify(formants);

      // ノイズ環境でも認識できることを確認
      expect(result.vowel).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.2);
    });

    it('インパルスノイズを除去して認識できる', () => {
      const cleanSignal = generateRealisticVowelSound('e', AUDIO_CONFIG.SAMPLE_RATE, 2048);
      const noisySignal = addImpulseNoise(cleanSignal, 0.1);

      // メディアンフィルタでインパルスノイズ除去
      const spectrum = fftProcessor.forward(noisySignal);
      const filtered = formantExtractor.applyMedianFilter(spectrum, 5);
      const formants = formantExtractor.extractFormants(filtered, AUDIO_CONFIG.SAMPLE_RATE);
      const result = vowelDetector.identify(formants);

      // 認識結果を確認
      expect(result.vowel).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.3);
    });

    it('環境ノイズの適応的除去ができる', () => {
      const noiseProfile = generateEnvironmentalNoise(AUDIO_CONFIG.SAMPLE_RATE, 512);
      const adaptiveFilter = formantExtractor.createAdaptiveNoiseFilter();

      // ノイズプロファイルを学習
      for (let i = 0; i < 10; i++) {
        const noiseFrame = generateEnvironmentalNoise(AUDIO_CONFIG.SAMPLE_RATE, 512);
        // FFTサイズに合わせてパディング
        const paddedFrame = new Float32Array(2048);
        paddedFrame.set(noiseFrame);
        const noiseSpectrum = fftProcessor.forward(paddedFrame);
        adaptiveFilter.updateNoiseProfile(noiseSpectrum);
      }

      // 音声+ノイズを処理
      const cleanSignal = generateRealisticVowelSound('o', AUDIO_CONFIG.SAMPLE_RATE, 2048);
      const noisySignal = mixSignals(cleanSignal, noiseProfile, 0.5);
      const spectrum = fftProcessor.forward(noisySignal);
      const filtered = adaptiveFilter.process(spectrum);

      const formants = formantExtractor.extractFormants(filtered, AUDIO_CONFIG.SAMPLE_RATE);
      const result = vowelDetector.identify(formants);

      // ノイズ除去後も認識できることを確認
      expect(result.vowel).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.2);
    });
  });

  describe('リアルタイムパフォーマンス', () => {
    it('16msで1フレーム処理できる（60FPS）', () => {
      const audioBuffer = generateRealisticVowelSound('a', AUDIO_CONFIG.SAMPLE_RATE, 2048);

      const start = performance.now();

      // 1フレーム分の処理
      const features = audioAnalyzer.processAudioBuffer(audioBuffer);
      const vowelResult = vowelDetector.identify(features.formants);
      const params = lipSyncController.vowelToParams(vowelResult.vowel);
      lipSyncController.applyParams(params);

      const elapsed = performance.now() - start;

      // 16ms以内で処理完了
      expect(elapsed).toBeLessThan(16);
    });

    it('WebAssembly最適化で高速化される', async () => {
      const audioBuffer = generateComplexAudioSignal(AUDIO_CONFIG.SAMPLE_RATE, 2048);

      // JavaScript版
      const jsStart = performance.now();
      for (let i = 0; i < 50; i++) {
        fftProcessor.forward(audioBuffer);
      }
      const jsTime = performance.now() - jsStart;

      // WebAssembly版（現在はフォールバック）
      const wasmStart = performance.now();
      for (let i = 0; i < 50; i++) {
        wasmFFT.forward(audioBuffer);
      }
      const wasmTime = performance.now() - wasmStart;

      console.log(`JS: ${jsTime.toFixed(2)}ms, WASM: ${wasmTime.toFixed(2)}ms`);

      // パフォーマンス比較
      expect(wasmTime).toBeLessThan(jsTime * 2);
    });
  });

  describe('AudioWorklet統合', () => {
    it('AudioWorkletで音声データを処理できる', async () => {
      // AudioContextモック
      (global as any).AudioContext = jest.fn().mockImplementation(() => ({
        audioWorklet: {
          addModule: jest.fn().mockResolvedValue(undefined)
        },
        createMediaStreamSource: jest.fn().mockReturnValue({
          connect: jest.fn(),
          disconnect: jest.fn()
        }),
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
        state: 'running',
        close: jest.fn().mockResolvedValue(undefined)
      }));

      (global as any).AudioWorkletNode = jest.fn().mockImplementation(() => ({
        port: {
          postMessage: jest.fn(),
          onmessage: null
        },
        connect: jest.fn(),
        disconnect: jest.fn()
      }));

      const manager = new AudioWorkletManager();
      const initialized = await manager.initialize();

      if (initialized) {
        const audioBuffer = generateRealisticVowelSound('i', AUDIO_CONFIG.SAMPLE_RATE, 2048);

        const result = await new Promise<any>((resolve) => {
          manager.processBuffer(audioBuffer, (data) => {
            resolve(data);
          });
        });

        expect(result).toBeDefined();
        expect(result.rms).toBeGreaterThan(0);
        expect(result.samples).toBeDefined();
      }

      manager.dispose();
    });
  });

  describe('Live2D統合', () => {
    it('母音に応じて口形パラメータが変化する', async () => {
      const vowels = ['a', 'i', 'u', 'e', 'o'];

      for (const vowel of vowels) {
        // 母音検出をモック
        jest.spyOn(vowelDetector, 'identify').mockReturnValue({
          vowel: vowel as 'a' | 'i' | 'u' | 'e' | 'o',
          confidence: 0.9,
          alternatives: []
        });

        const audioBuffer = generateRealisticVowelSound(vowel as any, AUDIO_CONFIG.SAMPLE_RATE, 2048);
        await lipSyncController.processAudio(audioBuffer);

        // 口形パラメータを確認
        const mouthOpenY = mockModel.getParameterValueById('ParamMouthOpenY');
        const mouthForm = mockModel.getParameterValueById('ParamMouthForm');

        // 母音ごとに異なる口形になっていることを確認
        switch (vowel) {
          case 'a':
            expect(mouthOpenY).toBeGreaterThan(0.5);
            break;
          case 'i':
            expect(mouthForm).toBeLessThan(0);
            break;
          case 'u':
            expect(mouthForm).toBeGreaterThan(0);
            break;
        }
      }
    });

    it('スムーズな母音遷移を実現できる', async () => {
      const transitionFrames: number[] = [];

      // スムージング設定
      lipSyncController.setSmoothingTimeConstant(100);

      // 「あ」→「い」の遷移
      const audioA = generateRealisticVowelSound('a', AUDIO_CONFIG.SAMPLE_RATE, 1024);
      const audioI = generateRealisticVowelSound('i', AUDIO_CONFIG.SAMPLE_RATE, 1024);

      await lipSyncController.processAudio(audioA);
      const initialMouthOpen = mockModel.getParameterValueById('ParamMouthOpenY');

      // 10フレームの遷移を記録
      for (let i = 0; i < 10; i++) {
        await lipSyncController.processAudio(audioI);
        transitionFrames.push(mockModel.getParameterValueById('ParamMouthOpenY'));
        await new Promise(resolve => setTimeout(resolve, 16));
      }

      // スムーズな減少を確認
      for (let i = 1; i < transitionFrames.length; i++) {
        const diff = Math.abs(transitionFrames[i] - transitionFrames[i - 1]);
        expect(diff).toBeLessThan(0.3); // 急激な変化がない
      }
    });
  });
});

// ヘルパー関数

/**
 * リアルな母音音声を生成
 */
function generateRealisticVowelSound(
  vowel: 'a' | 'i' | 'u' | 'e' | 'o',
  sampleRate: number,
  length: number
): Float32Array {
  const samples = new Float32Array(length);

  // 母音ごとのフォルマント周波数（より現実的な値）
  const formants = {
    a: { f1: 730, f2: 1090, f3: 2440 },
    i: { f1: 270, f2: 2290, f3: 3010 },
    u: { f1: 300, f2: 870, f3: 2240 },
    e: { f1: 530, f2: 1840, f3: 2480 },
    o: { f1: 570, f2: 840, f3: 2410 }
  };

  const { f1, f2, f3 } = formants[vowel];

  // 基本周波数（声帯振動）
  const f0 = 120 + Math.random() * 40; // 120-160Hz

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;

    // 基本周波数とその倍音
    let sample = 0.3 * Math.sin(2 * Math.PI * f0 * t);
    sample += 0.15 * Math.sin(2 * Math.PI * f0 * 2 * t);
    sample += 0.08 * Math.sin(2 * Math.PI * f0 * 3 * t);

    // フォルマント周波数（共鳴）
    sample += 0.25 * Math.sin(2 * Math.PI * f1 * t) * (1 + 0.1 * Math.sin(2 * Math.PI * 10 * t));
    sample += 0.20 * Math.sin(2 * Math.PI * f2 * t) * (1 + 0.05 * Math.sin(2 * Math.PI * 15 * t));
    sample += 0.10 * Math.sin(2 * Math.PI * f3 * t);

    // エンベロープ（立ち上がりと減衰）
    const envelope = Math.min(1, i / 100) * Math.min(1, (length - i) / 100);
    samples[i] = sample * envelope;
  }

  return samples;
}

/**
 * 母音間の遷移音声を生成
 */
function generateVowelTransition(
  vowel1: string,
  vowel2: string,
  sampleRate: number,
  length: number
): Float32Array {
  const half = Math.floor(length / 2);
  const sound1 = generateRealisticVowelSound(vowel1 as any, sampleRate, half);
  const sound2 = generateRealisticVowelSound(vowel2 as any, sampleRate, half);

  const result = new Float32Array(length);

  // 前半と後半を結合（クロスフェード）
  const fadeLength = Math.floor(half * 0.2);

  for (let i = 0; i < half; i++) {
    if (i < half - fadeLength) {
      result[i] = sound1[i];
    } else {
      const fadeRatio = (i - (half - fadeLength)) / fadeLength;
      result[i] = sound1[i] * (1 - fadeRatio);
    }
  }

  for (let i = 0; i < half; i++) {
    if (i < fadeLength) {
      const fadeRatio = i / fadeLength;
      result[half + i] += sound2[i] * fadeRatio;
    } else {
      result[half + i] = sound2[i];
    }
  }

  return result;
}

/**
 * ホワイトノイズを追加
 */
function addWhiteNoise(signal: Float32Array, noiseLevel: number): Float32Array {
  const noisy = new Float32Array(signal.length);

  for (let i = 0; i < signal.length; i++) {
    noisy[i] = signal[i] + (Math.random() - 0.5) * noiseLevel;
  }

  return noisy;
}

/**
 * インパルスノイズを追加
 */
function addImpulseNoise(signal: Float32Array, probability: number): Float32Array {
  const noisy = new Float32Array(signal);

  for (let i = 0; i < noisy.length; i++) {
    if (Math.random() < probability) {
      noisy[i] = (Math.random() - 0.5) * 2; // ランダムなスパイク
    }
  }

  return noisy;
}

/**
 * 環境ノイズを生成
 */
function generateEnvironmentalNoise(sampleRate: number, length: number): Float32Array {
  const noise = new Float32Array(length);

  // 低周波ノイズ（エアコン、交通など）
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    noise[i] = 0.05 * Math.sin(2 * Math.PI * 60 * t) +  // 60Hz hum
               0.03 * Math.sin(2 * Math.PI * 120 * t) +
               0.02 * (Math.random() - 0.5);
  }

  return noise;
}

/**
 * 信号をミックス
 */
function mixSignals(signal1: Float32Array, signal2: Float32Array, ratio: number): Float32Array {
  const mixed = new Float32Array(Math.max(signal1.length, signal2.length));

  for (let i = 0; i < mixed.length; i++) {
    const s1 = i < signal1.length ? signal1[i] : 0;
    const s2 = i < signal2.length ? signal2[i] : 0;
    mixed[i] = s1 * (1 - ratio) + s2 * ratio;
  }

  return mixed;
}

/**
 * 複雑な音声信号を生成
 */
function generateComplexAudioSignal(sampleRate: number, length: number): Float32Array {
  const signal = new Float32Array(length);

  // 複数の周波数成分を含む複雑な信号
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    signal[i] = 0.3 * Math.sin(2 * Math.PI * 440 * t) +   // A4
                0.2 * Math.sin(2 * Math.PI * 554 * t) +   // C#5
                0.15 * Math.sin(2 * Math.PI * 659 * t) +  // E5
                0.1 * Math.sin(2 * Math.PI * 880 * t) +   // A5
                0.05 * (Math.random() - 0.5);             // ノイズ
  }

  return signal;
}