/**
 * Live2D LipSync Constants
 */

export const AUDIO_CONFIG = {
  SAMPLE_RATE: 48000,
  FFT_SIZE: 2048,
  SMOOTHING_TIME_CONSTANT: 0.8,
  MIN_DECIBELS: -90,
  MAX_DECIBELS: -10
} as const;

export const VOWEL_FORMANTS = {
  a: {
    f1: { min: 700, max: 900, center: 800 },
    f2: { min: 1200, max: 1600, center: 1400 }
  },
  i: {
    f1: { min: 250, max: 350, center: 300 },
    f2: { min: 2200, max: 2800, center: 2500 }
  },
  u: {
    f1: { min: 300, max: 400, center: 350 },
    f2: { min: 700, max: 1000, center: 850 }
  },
  e: {
    f1: { min: 400, max: 600, center: 500 },
    f2: { min: 1800, max: 2400, center: 2100 }
  },
  o: {
    f1: { min: 450, max: 600, center: 525 },
    f2: { min: 800, max: 1200, center: 1000 }
  }
} as const;

export const MOUTH_SHAPES = {
  a: { ParamMouthOpenY: 1.0, ParamMouthForm: 0.0, ParamMouthOpenX: 0.3 },
  i: { ParamMouthOpenY: 0.2, ParamMouthForm: 1.0, ParamMouthOpenX: 0.8 },
  u: { ParamMouthOpenY: 0.3, ParamMouthForm: -1.0, ParamMouthOpenX: -0.5 },
  e: { ParamMouthOpenY: 0.5, ParamMouthForm: 0.5, ParamMouthOpenX: 0.5 },
  o: { ParamMouthOpenY: 0.6, ParamMouthForm: -0.5, ParamMouthOpenX: -0.3 },
  silent: { ParamMouthOpenY: 0.0, ParamMouthForm: 0.0, ParamMouthOpenX: 0.0 }
} as const;

// RMS計算用の定数
export const RMS_CONFIG = {
  MIN_THRESHOLD: 0.01,  // 無音判定の閾値
  MAX_THRESHOLD: 1.0,    // 最大音量
  SMOOTHING_FACTOR: 0.95 // スムージング係数
} as const;