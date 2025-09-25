/**
 * Live2D LipSync Type Definitions
 */

export interface AudioFeatures {
  rms: number;
  spectrum: Float32Array;
  formants: FormantData;
  timestamp: number;
}

export interface FormantData {
  f1: number;  // 第1フォルマント
  f2: number;  // 第2フォルマント
  f3?: number; // 第3フォルマント（オプション）
}

export interface VowelDetectionResult {
  vowel: 'a' | 'i' | 'u' | 'e' | 'o' | 'silent';
  confidence: number;
  alternatives: Array<{
    vowel: string;
    confidence: number;
  }>;
}

export interface MouthParameters {
  ParamMouthOpenY: number;  // 口の開き具合（0-1）
  ParamMouthForm: number;    // 口の形状（-1 to 1）
  ParamMouthOpenX?: number;  // 口の横幅（オプション）
}

export interface LipSyncConfig {
  smoothingFactor: number;   // スムージング係数（0-1）
  minConfidence: number;     // 最小信頼度閾値
  updateInterval: number;    // 更新間隔（ms）
}

export interface AudioAnalyzerConfig {
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
  sampleRate?: number;
}

export interface SpectrumData {
  frequencies: Float32Array;
  magnitudes: Float32Array;
  sampleRate: number;
}