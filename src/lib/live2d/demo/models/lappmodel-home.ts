/**
 * ホーム画面用のLive2Dモデルクラス
 * 活発な動きと豊かな表現を特徴とする
 */

import { LAppModelBase, LoadStep } from '../lappmodelbase';
import {
  BreathParameterData,
  CubismBreath
} from '../../framework/effect/cubismbreath';
import { csmVector } from '../../framework/type/csmvector';
import { CubismFramework } from '../../framework/live2dcubismframework';
import { CubismDefaultParameterId } from '../../framework/cubismdefaultparameterid';
import * as LAppDefine from '../lappdefine';
import { LAppPal } from '../lapppal';

export class LAppModelHome extends LAppModelBase {
  /**
   * 呼吸パラメータの設定をオーバーライド（ホーム画面用）
   * より活発な動きを設定
   */
  protected setupBreath(): void {
    this._breath = CubismBreath.create();

    const breathParameters: csmVector<BreathParameterData> = new csmVector();

    // ホーム画面用：活発な呼吸動作（Y軸の動きを抑制）
    breathParameters.pushBack(
      new BreathParameterData(this._idParamAngleX, 0.0, 15.0, 6.5345, 0.5)
    );
    breathParameters.pushBack(
      new BreathParameterData(this._idParamAngleY, 0.0, 0.0, 3.5345, 0.5)  // Y軸の動きを無効化
    );
    breathParameters.pushBack(
      new BreathParameterData(this._idParamAngleZ, 0.0, 10.0, 5.5345, 0.5)
    );
    breathParameters.pushBack(
      new BreathParameterData(this._idParamBodyAngleX, 0.0, 4.0, 15.5345, 0.5)
    );
    breathParameters.pushBack(
      new BreathParameterData(this._idParamBodyAngleY, 0.0, 0.0, 8.5345, 0.5)  // Y軸の動きを無効化
    );
    breathParameters.pushBack(
      new BreathParameterData(
        CubismFramework.getIdManager().getId(
          CubismDefaultParameterId.ParamBreath
        ),
        0.5,
        0.5,
        3.2345,
        1
      )
    );

    this._breath.setParameters(breathParameters);
  }

  /**
   * update関数をオーバーライド（ホーム画面用）
   * アイドルモーションを有効化
   */
  public update(): void {
    if (this._state != LoadStep.CompleteSetup) return;

    const deltaTimeSeconds: number = LAppPal.getDeltaTime();
    this._userTimeSeconds += deltaTimeSeconds;

    this._dragManager.update(deltaTimeSeconds);
    const targetDragX = this._dragManager.getX();
    const targetDragY = this._dragManager.getY();

    // スムージング処理（通常の速さ）
    const smoothingFactor = 0.1;
    this._dragX += (targetDragX - this._dragX) * smoothingFactor;
    this._dragY += (targetDragY - this._dragY) * smoothingFactor;

    let motionUpdated = false;

    this._model.loadParameters();

    // ホーム画面：アイドルモーションを有効化
    if (this._motionManager.isFinished()) {
      this.startRandomMotion(
        LAppDefine.MotionGroupIdle,
        LAppDefine.PriorityIdle
      );
    } else {
      motionUpdated = this._motionManager.updateMotion(
        this._model,
        deltaTimeSeconds
      );
    }

    // まばたき
    if (!motionUpdated) {
      if (this._eyeBlink != null) {
        this._eyeBlink.updateParameters(this._model, deltaTimeSeconds);
      }
    }

    if (this._expressionManager != null) {
      this._expressionManager.updateMotion(this._model, deltaTimeSeconds);
    }

    // マウス追従（活発な反応）
    const baseAngleX = this._model.getParameterValueById(this._idParamAngleX);
    const baseAngleY = this._model.getParameterValueById(this._idParamAngleY);
    const baseAngleZ = this._model.getParameterValueById(this._idParamAngleZ);

    this._model.setParameterValueById(this._idParamAngleX, baseAngleX + this._dragX * 20);
    this._model.setParameterValueById(this._idParamAngleY, baseAngleY + this._dragY * 5);  // Y軸の感度を下げる
    this._model.setParameterValueById(this._idParamAngleZ, baseAngleZ + this._dragX * this._dragY * -10);

    // 体の向きも追従（ホーム画面のみ）
    const baseBodyAngleX = this._model.getParameterValueById(this._idParamBodyAngleX);
    const baseBodyAngleY = this._model.getParameterValueById(this._idParamBodyAngleY);
    const baseBodyAngleZ = this._model.getParameterValueById(this._idParamBodyAngleZ);

    this._model.setParameterValueById(this._idParamBodyAngleX, baseBodyAngleX + this._dragX * 8);
    this._model.setParameterValueById(this._idParamBodyAngleY, baseBodyAngleY + this._dragY * 2);  // Y軸の感度を下げる
    this._model.setParameterValueById(this._idParamBodyAngleZ, baseBodyAngleZ + this._dragX * this._dragY * -4);

    // 目の動き
    const baseEyeBallX = this._model.getParameterValueById(this._idParamEyeBallX);
    const baseEyeBallY = this._model.getParameterValueById(this._idParamEyeBallY);
    this._model.setParameterValueById(this._idParamEyeBallX, baseEyeBallX + this._dragX * 1.5);
    this._model.setParameterValueById(this._idParamEyeBallY, baseEyeBallY + this._dragY * 0.5);  // Y軸の感度を下げる

    // 呼吸
    if (this._breath != null) {
      this._breath.updateParameters(this._model, deltaTimeSeconds);
    }

    // 物理演算
    if (this._physics != null) {
      this._physics.evaluate(this._model, deltaTimeSeconds);
    }

    // リップシンク
    if (this._lipsync) {
      let value = 0.0;
      if (this._lipSyncValue > 0) {
        value = this._lipSyncValue;
      } else {
        this._wavFileHandler.update(deltaTimeSeconds);
        value = this._wavFileHandler.getRms();
      }

      for (let i = 0; i < this._lipSyncIds.getSize(); ++i) {
        this._model.setParameterValueById(this._lipSyncIds.at(i), value, 1.0);
      }
    }

    // ポーズ
    if (this._pose != null) {
      this._pose.updateParameters(this._model, deltaTimeSeconds);
    }

    this._model.saveParameters();
    this._model.update();
  }
}