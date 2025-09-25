/**
 * レポート画面用のLive2Dモデルクラス
 * 知的で落ち着いた表現を特徴とする
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

export class LAppModelReport extends LAppModelBase {
  /**
   * 呼吸パラメータの設定をオーバーライド（レポート画面用）
   * 知的で落ち着いた動きを設定
   */
  protected setupBreath(): void {
    this._breath = CubismBreath.create();

    const breathParameters: csmVector<BreathParameterData> = new csmVector();

    // レポート画面用：静かで落ち着いた呼吸動作（Y軸の動きを無効化）
    breathParameters.pushBack(
      new BreathParameterData(this._idParamAngleX, 0.0, 4.0, 6.5345, 0.5)
    );
    breathParameters.pushBack(
      new BreathParameterData(this._idParamAngleY, 0.0, 0.0, 3.5345, 0.5)  // Y軸の動きを無効化
    );
    breathParameters.pushBack(
      new BreathParameterData(this._idParamAngleZ, 0.0, 3.0, 5.5345, 0.5)
    );
    breathParameters.pushBack(
      new BreathParameterData(this._idParamBodyAngleX, 0.0, 1.5, 15.5345, 0.5)
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
   * update関数をオーバーライド（レポート画面用）
   * 知的な印象を与える控えめな動き
   */
  public update(): void {
    if (this._state != LoadStep.CompleteSetup) return;

    const deltaTimeSeconds: number = LAppPal.getDeltaTime();
    this._userTimeSeconds += deltaTimeSeconds;

    this._dragManager.update(deltaTimeSeconds);
    const targetDragX = this._dragManager.getX();
    const targetDragY = this._dragManager.getY();

    // スムージング処理（ゆっくり）
    const smoothingFactor = 0.06;
    this._dragX += (targetDragX - this._dragX) * smoothingFactor;
    this._dragY += (targetDragY - this._dragY) * smoothingFactor;

    let motionUpdated = false;

    this._model.loadParameters();

    // レポート画面：アイドルモーションはほぼ無効
    if (this._motionManager.isFinished()) {
      // 稀にアイドルモーションを再生（頻度を大幅に下げる）
      if (Math.random() < 0.1) {  // 10%の確率で再生
        this.startRandomMotion(
          LAppDefine.MotionGroupIdle,
          LAppDefine.PriorityIdle
        );
      }
    } else {
      motionUpdated = this._motionManager.updateMotion(
        this._model,
        deltaTimeSeconds
      );
    }

    // まばたき（ゆっくり）
    if (!motionUpdated) {
      if (this._eyeBlink != null) {
        this._eyeBlink.updateParameters(this._model, deltaTimeSeconds);
      }
    }

    if (this._expressionManager != null) {
      this._expressionManager.updateMotion(this._model, deltaTimeSeconds);
    }

    // マウス追従（控えめで知的な反応）
    const baseAngleX = this._model.getParameterValueById(this._idParamAngleX);
    const baseAngleY = this._model.getParameterValueById(this._idParamAngleY);
    const baseAngleZ = this._model.getParameterValueById(this._idParamAngleZ);

    this._model.setParameterValueById(this._idParamAngleX, baseAngleX + this._dragX * 12);
    this._model.setParameterValueById(this._idParamAngleY, baseAngleY + this._dragY * 3);  // Y軸の感度を下げる
    this._model.setParameterValueById(this._idParamAngleZ, baseAngleZ + this._dragX * this._dragY * -6);

    // 体の向きは最小限
    const baseBodyAngleX = this._model.getParameterValueById(this._idParamBodyAngleX);
    const baseBodyAngleY = this._model.getParameterValueById(this._idParamBodyAngleY);

    this._model.setParameterValueById(this._idParamBodyAngleX, baseBodyAngleX + this._dragX * 2);
    this._model.setParameterValueById(this._idParamBodyAngleY, baseBodyAngleY + this._dragY * 0.5);  // Y軸の感度を下げる

    // 目の動き（知的な視線）
    const baseEyeBallX = this._model.getParameterValueById(this._idParamEyeBallX);
    const baseEyeBallY = this._model.getParameterValueById(this._idParamEyeBallY);
    this._model.setParameterValueById(this._idParamEyeBallX, baseEyeBallX + this._dragX * 0.7);
    this._model.setParameterValueById(this._idParamEyeBallY, baseEyeBallY + this._dragY * 0.3);  // Y軸の感度を下げる

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