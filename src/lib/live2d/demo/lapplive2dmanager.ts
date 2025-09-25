/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { CubismMatrix44 } from '../framework/math/cubismmatrix44';
import { ACubismMotion } from '../framework/motion/acubismmotion';
import { csmVector } from '../framework/type/csmvector';
import { logger } from '@/utils/logger';

import * as LAppDefine from './lappdefine';
import { LAppModel, LAppModelFactory, ScreenType } from './lappmodel';
import { LAppModelBase } from './lappmodelbase';
import { LAppPal } from './lapppal';
import { LAppSubdelegate } from './lappsubdelegate';

/**
 * サンプルアプリケーションにおいてCubismModelを管理するクラス
 * モデル生成と破棄、タップイベントの処理、モデル切り替えを行う。
 */
export class LAppLive2DManager {
  /**
   * 現在のシーンで保持しているすべてのモデルを解放する
   */
  private releaseAllModel(): void {
    for (
      let ite = this._models.begin();
      ite.notEqual(this._models.end());
      ite.preIncrement()
    ) {
      const model = ite.ptr();
      if (model) {
        // まず進行中のロードをキャンセル
        model.cancelLoading();
        model.releaseMotions();
        model.releaseExpressions();
        // subdelegateをnullに設定して参照を切る
        model.setSubdelegate(null);
      }
    }
    this._models.clear();
  }

  /**
   * 画面をドラッグした時の処理
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onDrag(x: number, y: number): void {
    const model: LAppModel = this._models.at(0);
    if (model) {
      model.setDragging(x, y);
    }
  }

  /**
   * マウスが画面外に出た時の処理
   */
  public onMouseLeave(): void {
    const model: LAppModel = this._models.at(0);
    if (model) {
      model.resetMousePosition();
    }
  }

  /**
   * 画面をタップした時の処理（廃止）
   * マウスクリック動作は使用しない
   *
   * @param x 画面のX座標
   * @param y 画面のY座標
   */
  public onTap(x: number, y: number): void {
    // クリック動作は廃止
    return;
  }

  /**
   * 画面を更新するときの処理
   * モデルの更新処理及び描画処理を行う
   */
  public onUpdate(): void {
    const { width, height } = this._subdelegate.getCanvas();

    const projection: CubismMatrix44 = new CubismMatrix44();
    const model: LAppModel = this._models.at(0);

    if (model.getModel()) {
      if (model.getModel().getCanvasWidth() > 1.0 && width < height) {
        // 横に長いモデルを縦長ウィンドウに表示する際モデルの横サイズでscaleを算出する
        model.getModelMatrix().setWidth(2.0);
        projection.scale(1.0, width / height);
      } else {
        projection.scale(height / width, 1.0);
      }

      // 必要があればここで乗算
      if (this._viewMatrix != null) {
        projection.multiplyByMatrix(this._viewMatrix);
      }
    }

    model.update();
    model.draw(projection); // 参照渡しなのでprojectionは変質する。
  }

  /**
   * 次のシーンに切りかえる
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   */
  public nextScene(): void {
    const no: number = (this._sceneIndex + 1) % LAppDefine.ModelDirSize;
    this.changeScene(no);
  }

  /**
   * シーンを切り替える
   * サンプルアプリケーションではモデルセットの切り替えを行う。
   * @param index
   */
  private changeScene(index: number): void {
    this._sceneIndex = index;

    if (LAppDefine.DebugLogEnable) {
      LAppPal.printMessage(`[APP]model index: ${this._sceneIndex}`);
    }

    // ModelDir[]に保持したディレクトリ名から
    // model3.jsonのパスを決定する。
    // ディレクトリ名とmodel3.jsonの名前を一致させておくこと。
    const model: string = LAppDefine.ModelDir[index];
    const modelPath: string = LAppDefine.ResourcesPath + model + '/';
    let modelJsonName: string = LAppDefine.ModelDir[index];
    modelJsonName += '.model3.json';

    this.releaseAllModel();

    // subdelegateが設定されていることを確認
    if (!this._subdelegate) {
      logger.error('LAppLive2DManager: subdelegate is not set');
      return;
    }

    const instance = new LAppModel();
    instance.setSubdelegate(this._subdelegate);
    // disableMotionsフラグを新しいモデルに設定
    if (this._disableMotions) {
      instance.setDisableMotions(this._disableMotions);
    }
    instance.loadAssets(modelPath, modelJsonName);
    this._models.pushBack(instance);

    // モデル読み込み完了後にアイドルモーションを開始
    setTimeout(() => {
      // Phase 3: Ensure initial gaze is reset
      const model = this._models.at(0);
      if (model) {
        model.resetMousePosition();
      }
      this.startIdleMotion();
    }, 1000);
  }

  public setViewMatrix(m: CubismMatrix44) {
    for (let i = 0; i < 16; i++) {
      this._viewMatrix.getArray()[i] = m.getArray()[i];
    }
  }

  /**
   * モデルの追加
   */
  public addModel(sceneIndex: number = 0): void {
    this._sceneIndex = sceneIndex;
    this.changeScene(this._sceneIndex);
  }

  /**
   * コンストラクタ
   */
  public constructor() {
    this._subdelegate = null;
    this._viewMatrix = new CubismMatrix44();
    this._models = new csmVector<LAppModel>();
    this._sceneIndex = 0;
  }

  /**
   * 解放する。
   */
  public release(): void {
    this.releaseAllModel();
    this._viewMatrix = null;
    this._subdelegate = null;
  }

  /**
   * 初期化する。
   * @param subdelegate
   */
  public initialize(subdelegate: LAppSubdelegate): void {
    this._subdelegate = subdelegate;
    this.changeScene(this._sceneIndex);
  }

  /**
   * モデル読み込み後にアイドルモーションを開始
   */
  public startIdleMotion(): void {
    const model: LAppModel = this._models.at(0);
    if (model) {
      // Phase 3: Reset initial gaze position
      model.resetMousePosition();

      // アイドルモーションをループ再生（ランダム間隔で）
      model.startRandomMotion(
        LAppDefine.MotionGroupIdle,
        LAppDefine.PriorityIdle,
        () => {
          // モーション終了後、ランダム間隔で次のアイドルモーションを再生
          setTimeout(() => {
            this.startIdleMotion();
          }, Math.random() * 3000 + 2000);
        }
      );
    }
  }

  /**
   * 指定されたインデックスのモデルを取得
   * @param index モデルのインデックス（デフォルト: 0）
   * @returns LAppModelのインスタンス（存在しない場合はnull）
   */
  public getModel(index: number = 0): LAppModel | null {
    if (index < 0 || index >= this._models.getSize()) {
      return null;
    }
    return this._models.at(index);
  }

  public setDisableMotions(disable: boolean): void {
    this._disableMotions = disable;
    // 全モデルに伝播
    for (let i = 0; i < this._models.getSize(); i++) {
      const model = this._models.at(i);
      if (model) {
        model.setDisableMotions(disable);
      }
    }
  }

  public getDisableMotions(): boolean {
    return this._disableMotions;
  }

  /**
   * 自身が所属するSubdelegate
   */
  private _subdelegate: LAppSubdelegate;

  _viewMatrix: CubismMatrix44; // モデル描画に用いるview行列
  _models: csmVector<LAppModel>; // モデルインスタンスのコンテナ
  private _sceneIndex: number; // 表示するシーンのインデックス値
  private _disableMotions: boolean = false;

  // モーション再生開始のコールバック関数
  beganMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage('Motion Began:');
    logger.log(self);
  };
  // モーション再生終了のコールバック関数
  finishedMotion = (self: ACubismMotion): void => {
    LAppPal.printMessage('Motion Finished:');
    logger.log(self);
  };
}
