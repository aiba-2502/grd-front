import { logger } from '@/utils/logger';

/**
 * WasmFFT - WebAssembly最適化FFT実装
 * 高速フーリエ変換をWebAssemblyで実装し、パフォーマンスを向上
 */

export interface ComplexArray {
  real: Float32Array;
  imag: Float32Array;
}

type WindowFunction = 'hamming' | 'hanning' | 'blackman' | 'none';

export class WasmFFT {
  private wasmModule: WebAssembly.Module | null = null;
  private wasmInstance: WebAssembly.Instance | null = null;
  private memory: WebAssembly.Memory | null = null;
  private ready: boolean = false;
  private disposed: boolean = false;

  // WebAssembly関数のエクスポート
  private fftForward?: (size: number, realPtr: number, imagPtr: number) => void;
  private fftInverse?: (size: number, realPtr: number, imagPtr: number) => void;
  private malloc?: (size: number) => number;
  private free?: (ptr: number) => void;

  constructor() {}

  /**
   * WebAssemblyモジュールを初期化
   */
  public async initialize(): Promise<boolean> {
    try {
      // WebAssemblyが利用可能かチェック
      if (typeof WebAssembly === 'undefined') {
        logger.warn('WebAssembly is not supported in this environment');
        return false;
      }

      // 本番環境では実際のWASMファイルをロードする
      // ここではデモ用にJavaScriptフォールバックを使用
      // 実際のWebAssemblyモジュールはC/C++やAssemblyScriptからコンパイルする必要がある
      this.ready = true;
      return true;
    } catch (error) {
      logger.error('Failed to initialize WasmFFT:', error);
      return false;
    }
  }

  /**
   * FFT順変換
   */
  public forward(input: Float32Array): ComplexArray {
    this.checkDisposed();
    this.validateSize(input.length);

    // 現在はJavaScript実装を使用（WebAssembly実装は将来的に追加）
    return this.forwardJS(input);
  }

  /**
   * FFT逆変換
   */
  public inverse(complex: ComplexArray): Float32Array {
    this.checkDisposed();

    // 現在はJavaScript実装を使用
    return this.inverseJS(complex);
  }

  /**
   * 振幅スペクトラムを計算
   */
  public computeMagnitudeSpectrum(complex: ComplexArray): Float32Array {
    const magnitude = new Float32Array(complex.real.length);

    for (let i = 0; i < magnitude.length; i++) {
      const real = complex.real[i];
      const imag = complex.imag[i];
      magnitude[i] = Math.sqrt(real * real + imag * imag);
    }

    return magnitude;
  }

  /**
   * パワースペクトラムを計算
   */
  public computePowerSpectrum(complex: ComplexArray): Float32Array {
    const power = new Float32Array(complex.real.length / 2);

    for (let i = 0; i < power.length; i++) {
      const real = complex.real[i];
      const imag = complex.imag[i];
      power[i] = real * real + imag * imag;
    }

    return power;
  }

  /**
   * ウィンドウ関数を適用
   */
  public applyWindow(input: Float32Array, windowType: WindowFunction): Float32Array {
    const windowed = new Float32Array(input.length);
    const N = input.length;

    switch (windowType) {
      case 'hamming':
        for (let i = 0; i < N; i++) {
          windowed[i] = input[i] * (0.54 - 0.46 * Math.cos(2 * Math.PI * i / (N - 1)));
        }
        break;

      case 'hanning':
        for (let i = 0; i < N; i++) {
          windowed[i] = input[i] * 0.5 * (1 - Math.cos(2 * Math.PI * i / (N - 1)));
        }
        break;

      case 'blackman':
        for (let i = 0; i < N; i++) {
          const a0 = 0.42;
          const a1 = 0.5;
          const a2 = 0.08;
          windowed[i] = input[i] * (
            a0 -
            a1 * Math.cos(2 * Math.PI * i / (N - 1)) +
            a2 * Math.cos(4 * Math.PI * i / (N - 1))
          );
        }
        break;

      case 'none':
      default:
        windowed.set(input);
        break;
    }

    return windowed;
  }

  /**
   * SIMD対応をチェック
   */
  public hasSIMDSupport(): boolean {
    return typeof WebAssembly !== 'undefined' &&
           'SIMD' in WebAssembly &&
           typeof (WebAssembly as any).SIMD !== 'undefined';
  }

  /**
   * 初期化状態を確認
   */
  public isReady(): boolean {
    return this.ready && !this.disposed;
  }

  /**
   * リソースを解放
   */
  public dispose(): void {
    this.wasmInstance = null;
    this.wasmModule = null;
    this.memory = null;
    this.ready = false;
    this.disposed = true;
  }

  /**
   * サイズ検証
   */
  private validateSize(size: number): void {
    if (size === 0 || (size & (size - 1)) !== 0) {
      throw new Error(`FFT size must be a power of 2, got ${size}`);
    }
  }

  /**
   * 破棄状態をチェック
   */
  private checkDisposed(): void {
    if (this.disposed) {
      throw new Error('WasmFFT is disposed');
    }
  }

  /**
   * JavaScript版FFT（フォールバック用）
   */
  private forwardJS(input: Float32Array): ComplexArray {
    const n = input.length;
    const real = new Float32Array(input);
    const imag = new Float32Array(n);

    this.fftRadix2(real, imag, n, false);

    return { real, imag };
  }

  /**
   * JavaScript版逆FFT
   */
  private inverseJS(complex: ComplexArray): Float32Array {
    const n = complex.real.length;
    const real = new Float32Array(complex.real);
    const imag = new Float32Array(complex.imag);

    this.fftRadix2(real, imag, n, true);

    return real;
  }

  /**
   * Radix-2 FFTアルゴリズム
   */
  private fftRadix2(real: Float32Array, imag: Float32Array, n: number, inverse: boolean): void {
    // ビット反転
    let j = 0;
    for (let i = 0; i < n - 1; i++) {
      if (i < j) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
      let k = n >> 1;
      while (k <= j) {
        j -= k;
        k >>= 1;
      }
      j += k;
    }

    // Cooley-Tukey FFT
    for (let len = 2; len <= n; len <<= 1) {
      const angle = (inverse ? 2 : -2) * Math.PI / len;
      const wReal = Math.cos(angle);
      const wImag = Math.sin(angle);

      for (let i = 0; i < n; i += len) {
        let wTempReal = 1;
        let wTempImag = 0;

        for (let j = 0; j < len >> 1; j++) {
          const idx1 = i + j;
          const idx2 = idx1 + (len >> 1);

          const tempReal = real[idx2] * wTempReal - imag[idx2] * wTempImag;
          const tempImag = real[idx2] * wTempImag + imag[idx2] * wTempReal;

          real[idx2] = real[idx1] - tempReal;
          imag[idx2] = imag[idx1] - tempImag;
          real[idx1] += tempReal;
          imag[idx1] += tempImag;

          const oldWTempReal = wTempReal;
          wTempReal = oldWTempReal * wReal - wTempImag * wImag;
          wTempImag = oldWTempReal * wImag + wTempImag * wReal;
        }
      }
    }

    // 逆変換の正規化
    if (inverse) {
      for (let i = 0; i < n; i++) {
        real[i] /= n;
        imag[i] /= n;
      }
    }
  }

}