import { logger } from '@/utils/logger';

/**
 * LipSync Module Export
 * 音声解析とリップシンク機能のエクスポート
 */

export { AudioAnalyzer } from './AudioAnalyzer';
export { FFTProcessor } from './FFTProcessor';
export { FormantExtractor } from './FormantExtractor';
export type { FormantTracker } from './FormantExtractor';
export { VowelDetector } from './VowelDetector';
export type { VowelPattern, Thresholds, SlidingWindow, StateSmoother, Hysteresis, MergedVowel } from './VowelDetector';
export { LipSyncController } from './LipSyncController';

export * from './types';
export * from './constants';

/**
 * LipSync機能の使用例:
 *
 * ```typescript
 * import { AudioAnalyzer } from '@/lib/live2d/lipsync';
 *
 * // 音声解析器の初期化
 * const analyzer = new AudioAnalyzer({
 *   fftSize: 2048,
 *   sampleRate: 48000,
 *   smoothingTimeConstant: 0.8
 * });
 *
 * // Web Audio APIから音声データを取得
 * const audioContext = new AudioContext();
 * const analyser = audioContext.createAnalyser();
 * const dataArray = new Float32Array(analyser.fftSize);
 *
 * // 音声処理
 * analyser.getFloatTimeDomainData(dataArray);
 * const features = analyzer.processAudioBuffer(dataArray);
 *
 * // 音声特徴を使用してリップシンク
 * logger.log('RMS:', features.rms);
 * logger.log('Formants:', features.formants);
 * ```
 */