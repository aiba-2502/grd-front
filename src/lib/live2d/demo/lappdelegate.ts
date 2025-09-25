/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { csmVector } from '../framework/type/csmvector';
import { CubismFramework, Option } from '../framework/live2dcubismframework';
import * as LAppDefine from './lappdefine';
import { LAppPal } from './lapppal';
import { LAppSubdelegate } from './lappsubdelegate';
import { LAppGlManager } from './lappglmanager';
import { CubismLogError } from '../framework/utils/cubismdebug';

export let s_instance: LAppDelegate = null;

/**
 * アプリケーションクラス。
 * Cubism SDKの管理を行う。
 */
export class LAppDelegate {
  /**
   * クラスのインスタンス（シングルトン）を返す。
   * インスタンスが生成されていない場合は内部でインスタンスを生成する。
   *
   * @return クラスのインスタンス
   */
  public static getInstance(): LAppDelegate {
    if (s_instance == null) {
      s_instance = new LAppDelegate();
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
   * ポインタがアクティブになるときに呼ばれる。
   */
  private onPointerBegan(e: PointerEvent): void {
    if (!this._subdelegates) return;

    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointBegan(e.pageX, e.pageY);
    }
  }

  /**
   * マウスが動いたら呼ばれる。
   */
  public onMouseMoved(e: MouseEvent): void {
    if (!this._subdelegates) return;

    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onMouseMove(e.pageX, e.pageY);
    }
  }

  /**
   * ポインタが動いたら呼ばれる。
   */
  private onPointerMoved(e: PointerEvent): void {
    if (!this._subdelegates) return;

    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointMoved(e.pageX, e.pageY);
    }
  }

  /**
   * ポインタがアクティブでなくなったときに呼ばれる。
   */
  private onPointerEnded(e: PointerEvent): void {
    if (!this._subdelegates) return;

    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointEnded(e.pageX, e.pageY);
    }
  }

  /**
   * ポインタがキャンセルされると呼ばれる。
   */
  private onPointerCancel(e: PointerEvent): void {
    if (!this._subdelegates) return;

    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onTouchCancel(e.pageX, e.pageY);
    }
  }


  /**
   * Resize canvas and re-initialize view.
   */
  public onResize(): void {
    if (!this._subdelegates) return;

    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onResize();
    }
  }

  /**
   * タッチがキャンセルされると呼ばれる。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onTouchCancel(pointX: number, pointY: number): void {
    if (!this._subdelegates) return;

    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onTouchCancel(pointX, pointY);
    }
  }

  /**
   * タッチが開始されると呼ばれる。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onPointBegan(pointX: number, pointY: number): void {
    if (!this._subdelegates) return;

    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointBegan(pointX, pointY);
    }
  }

  /**
   * タッチポイントが動かされると呼ばれる。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onPointMoved(pointX: number, pointY: number): void {
    if (!this._subdelegates) return;

    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointMoved(pointX, pointY);
    }
  }

  /**
   * タッチが終了されると呼ばれる。
   *
   * @param pointX スクリーンX座標
   * @param pointY スクリーンY座標
   */
  public onPointEnded(pointX: number, pointY: number): void {
    if (!this._subdelegates) return;

    for (
      let ite = this._subdelegates.begin();
      ite.notEqual(this._subdelegates.end());
      ite.preIncrement()
    ) {
      ite.ptr().onPointEnded(pointX, pointY);
    }
  }

  /**
   * APPに必要な物を初期化する。
   */
  public initialize(): boolean {
    // Cubism SDKの初期化
    this.initializeCubism();

    // initializeSubdelegatesは外部から明示的に呼ぶように変更
    // this.initializeSubdelegates();
    this.initializeEventListener();

    return true;
  }

  /**
   * 既存のcanvasでSDKを初期化する
   */
  public initializeWithCanvas(canvas: HTMLCanvasElement): boolean {
    // 既存のリソースをクリーンアップ
    if (this._subdelegates && this._subdelegates.getSize() > 0) {
      for (
        let ite = this._subdelegates.begin();
        ite.notEqual(this._subdelegates.end());
        ite.preIncrement()
      ) {
        ite.ptr().release();
      }
      this._subdelegates.clear();
    }

    if (this._canvases) {
      this._canvases.clear();
    }

    // アニメーションループのフラグをリセット
    this._isRunning = false;
    this._animationFrameId = null;

    // Cubism SDKの初期化
    this.initializeCubism();

    // キャンバスを配列に追加
    this._canvases.prepareCapacity(1);
    this._canvases.pushBack(canvas);

    // Subdelegateを作成して初期化
    this._subdelegates.prepareCapacity(1);
    const subdelegate = new LAppSubdelegate();
    // 動作無効化フラグを伝達
    if (this._disableMotions) {
      (subdelegate as any).setDisableMotions(true);
    }
    if (subdelegate.initialize(canvas)) {
      this._subdelegates.pushBack(subdelegate);
    } else {
      return false;
    }

    this.initializeEventListener();

    return true;
  }

  /**
   * イベントリスナーを設定する。
   */
  private initializeEventListener(): void {
    // 既にイベントリスナーが設定されている場合は削除
    if (this.mouseMovedEventListener) {
      document.removeEventListener('mousemove', this.mouseMovedEventListener);
    }

    this.mouseMovedEventListener = this.onMouseMoved.bind(this);

    // マウスムーブイベントリスナーのみを追加（クリック動作は削除）
    document.addEventListener('mousemove', this.mouseMovedEventListener, {
      passive: true
    });
  }

  /**
   * Cubism SDKの初期化
   */
  private initializeCubism(): void {
    // Live2DCubismCoreが読み込まれていることを確認
    if (!(window as any).Live2DCubismCore) {
      throw new Error('Live2DCubismCore is not loaded. Please load live2dcubismcore.min.js first.');
    }

    LAppPal.updateTime();

    // CubismFrameworkが既に初期化されているかチェック
    if (!CubismFramework.isStarted()) {
      // setup cubism
      this._cubismOption.logFunction = LAppPal.printMessage;
      this._cubismOption.loggingLevel = LAppDefine.CubismLoggingLevel;
      CubismFramework.startUp(this._cubismOption);

      // initialize cubism
      CubismFramework.initialize();
    }
  }

  /**
   * Canvas要素を自動作成して初期化する（元の実装）
   */
  private initializeSubdelegates(): void {
    let width: number = 100;
    let height: number = 100;
    if (LAppDefine.CanvasNum > 3) {
      const widthunit: number = Math.ceil(Math.sqrt(LAppDefine.CanvasNum));
      const heightUnit = Math.ceil(LAppDefine.CanvasNum / widthunit);
      width = 100.0 / widthunit;
      height = 100.0 / heightUnit;
    } else {
      width = 100.0 / LAppDefine.CanvasNum;
    }

    this._canvases.prepareCapacity(LAppDefine.CanvasNum);
    this._subdelegates.prepareCapacity(LAppDefine.CanvasNum);
    for (let i = 0; i < LAppDefine.CanvasNum; i++) {
      const canvas = document.createElement('canvas');
      this._canvases.pushBack(canvas);
      canvas.style.width = `${width}vw`;
      canvas.style.height = `${height}vh`;

      // キャンバスを DOM に追加
      document.body.appendChild(canvas);
    }

    for (let i = 0; i < this._canvases.getSize(); i++) {
      const subdelegate = new LAppSubdelegate();
    // 動作無効化フラグを伝達
    if (this._disableMotions) {
      (subdelegate as any).setDisableMotions(true);
    }
      subdelegate.initialize(this._canvases.at(i));
      this._subdelegates.pushBack(subdelegate);
    }

    for (let i = 0; i < LAppDefine.CanvasNum; i++) {
      if (this._subdelegates.at(i).isContextLost()) {
        CubismLogError(
          `The context for Canvas at index ${i} was lost, possibly because the acquisition limit for WebGLRenderingContext was reached.`
        );
      }
    }
  }

  /**
   * Privateなコンストラクタ
   */
  private constructor() {
    this._cubismOption = new Option();
    this._subdelegates = new csmVector<LAppSubdelegate>();
    this._canvases = new csmVector<HTMLCanvasElement>();
    this._isRunning = false;
    this._animationFrameId = null;
    this._disableMotions = false; // 動作無効化フラグ
  }

  /**
   * 動作無効化フラグを設定
   */
  public setDisableMotions(disable: boolean): void {
    this._disableMotions = disable;
  }

  /**
   * 動作無効化フラグを取得
   */
  public getDisableMotions(): boolean {
    return this._disableMotions;
  }

  /**
   * Cubism SDK Option
   */
  private _cubismOption: Option;

  /**
   * 操作対象のcanvas要素
   */
  private _canvases: csmVector<HTMLCanvasElement>;

  /**
   * LAppSubdelegateの配列
   */
  private _subdelegates: csmVector<LAppSubdelegate>;

  /**
   * アニメーションループが実行中かどうか
   */
  private _isRunning: boolean;

  /**
   * requestAnimationFrameのID
   */
  private _animationFrameId: number | null;

  /**
   * 動作無効化フラグ
   */
  private _disableMotions: boolean;

  /**
   * リスナー関数
   */
  private pointBeganEventListener: (this: Document, ev: PointerEvent) => void;
  /**
   * リスナー関数
   */
  private pointMovedEventListener: (this: Document, ev: PointerEvent) => void;
  /**
   * リスナー関数
   */
  private pointEndedEventListener: (this: Document, ev: PointerEvent) => void;
  /**
   * リスナー関数
   */
  private pointCancelEventListener: (this: Document, ev: PointerEvent) => void;
  /**
   * マウスムーブイベントリスナー関数
   */
  private mouseMovedEventListener: (this: Document, ev: MouseEvent) => void;

  /**
   * 実行処理。
   */
  public run(): void {
    // 既に実行中の場合は何もしない
    if (this._isRunning) {
      return;
    }

    this._isRunning = true;

    // メインループ
    const loop = (): void => {
      // インスタンスの有無の確認またはループ停止フラグ
      if (s_instance == null || !this._isRunning) {
        this._animationFrameId = null;
        return;
      }

      // 時間更新
      LAppPal.updateTime();

      // subdelegatesがnullまたは空の場合は処理をスキップ
      if (!this._subdelegates || this._subdelegates.getSize() === 0) {
        this._animationFrameId = requestAnimationFrame(loop);
        return;
      }

      // 画面の初期化
      for (
        let ite = this._subdelegates.begin();
        ite.notEqual(this._subdelegates.end());
        ite.preIncrement()
      ) {
        const canvas = ite.ptr().getCanvas();
        const gl = ite.ptr().getGlManager().getGl();
        if (gl && !gl.isContextLost()) {
          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.clearColor(0.0, 0.0, 0.0, 0.0);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.clearDepth(1.0);
        }
      }

      // 各キャンバスの描画
      for (
        let ite = this._subdelegates.begin();
        ite.notEqual(this._subdelegates.end());
        ite.preIncrement()
      ) {
        ite.ptr().update();
      }

      // ループのために再帰呼び出し
      this._animationFrameId = requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * 解放する。
   */
  public release(): void {
    // アニメーションループを停止
    this._isRunning = false;
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = null;
    }

    // イベントリスナーの削除
    if (this.pointBeganEventListener) {
      document.removeEventListener('pointerdown', this.pointBeganEventListener);
      this.pointBeganEventListener = null;
    }

    if (this.pointMovedEventListener) {
      document.removeEventListener('pointermove', this.pointMovedEventListener);
      this.pointMovedEventListener = null;
    }

    if (this.pointEndedEventListener) {
      document.removeEventListener('pointerup', this.pointEndedEventListener);
      this.pointEndedEventListener = null;
    }

    if (this.pointCancelEventListener) {
      document.removeEventListener('pointercancel', this.pointCancelEventListener);
      this.pointCancelEventListener = null;
    }

    // subdelegatesの解放
    if (this._subdelegates) {
      for (
        let ite = this._subdelegates.begin();
        ite.notEqual(this._subdelegates.end());
        ite.preIncrement()
      ) {
        ite.ptr().release();
      }
      this._subdelegates.clear();
      this._subdelegates = null;
    }

    if (this._canvases) {
      this._canvases.clear();
      this._canvases = null;
    }

    // LAppGlManagerの解放（シングルトンインスタンス）
    LAppGlManager.releaseInstance();

    // CubismFrameworkの解放は行わない
    // 画面遷移では再利用するため、アプリケーション終了時のみ行う
    // CubismFramework.dispose();
  }
}