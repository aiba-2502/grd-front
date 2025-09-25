import { logger } from '@/utils/logger';

/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

/**
 * Cubism SDKのサンプルで使用するWebGLを管理するクラス
 */

// グローバル変数として管理
export let canvas: HTMLCanvasElement | null = null;
export let gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
export let frameBuffer: WebGLFramebuffer | null = null;

export class LAppGlManager {
  private static s_instance: LAppGlManager = null;

  /**
   * クラスのインスタンス（シングルトン）を返す。
   * インスタンスが生成されていない場合は内部でインスタンスを生成する。
   *
   * @return クラスのインスタンス
   */
  public static getInstance(): LAppGlManager {
    if (s_instance == null) {
      s_instance = new LAppGlManager();
    }

    return s_instance;
  }

  /**
   * クラスのインスタンス（シングルトン）を解放する。
   */
  public static releaseInstance(): void {
    if (s_instance != null) {
      s_instance.release();
    }

    s_instance = null;
  }

  /**
   * canvasを静的に設定する
   */
  public static setCanvas(canvasElement: HTMLCanvasElement): void {
    canvas = canvasElement;
    // glコンテキストを初期化（透明背景対応）
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true }) ||
         canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });

    if (!gl) {
      // gl初期化失敗
      logger.error('Cannot initialize WebGL. This browser does not support.');
      gl = null;
    }
  }

  public constructor() {
    // シングルトンパターンのため、外部からのnewを禁止
  }

  public initialize(canvasElement: HTMLCanvasElement): boolean {
    canvas = canvasElement;
    // glコンテキストを初期化（透明背景対応）
    gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true }) ||
         canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });

    if (!gl) {
      // gl初期化失敗
      logger.error('Cannot initialize WebGL. This browser does not support.');
      gl = null;
      return false;
    }
    return true;
  }

  /**
   * 解放する。
   */
  public release(): void {
    gl = null;
    frameBuffer = null;
    canvas = null;
  }

  public getGl(): WebGLRenderingContext | WebGL2RenderingContext {
    return gl;
  }
}

let s_instance: LAppGlManager = null;