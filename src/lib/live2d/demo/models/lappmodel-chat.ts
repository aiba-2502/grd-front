/**
 * チャット画面用のLive2Dモデルクラス
 * 落ち着いた動きと会話に集中できる表現を特徴とする
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

export class LAppModelChat extends LAppModelBase {
  /**
   * 呼吸パラメータの設定をオーバーライド（チャット画面用）
   * 落ち着いた控えめな動きを設定
   */
  protected setupBreath(): void {
    this._breath = CubismBreath.create();

    const breathParameters: csmVector<BreathParameterData> = new csmVector();

    // チャット画面用：控えめで落ち着いた呼吸動作（Y軸の動きを無効化）
    breathParameters.pushBack(
      new BreathParameterData(this._idParamAngleX, 0.0, 3.0, 6.5345, 0.5)
    );
    breathParameters.pushBack(
      new BreathParameterData(this._idParamAngleY, 0.0, 0.0, 3.5345, 0.5)  // Y軸の動きを無効化
    );
    breathParameters.pushBack(
      new BreathParameterData(this._idParamAngleZ, 0.0, 2.5, 5.5345, 0.5)
    );
    breathParameters.pushBack(
      new BreathParameterData(this._idParamBodyAngleX, 0.0, 1.0, 15.5345, 0.5)
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
   * update関数をオーバーライド（チャット画面用）
   * アイドルモーションを無効化、リップシンクを強調
   */
  public update(): void {
    if (this._state != LoadStep.CompleteSetup) return;

    const deltaTimeSeconds: number = LAppPal.getDeltaTime();
    this._userTimeSeconds += deltaTimeSeconds;

    this._dragManager.update(deltaTimeSeconds);
    const targetDragX = this._dragManager.getX();
    const targetDragY = this._dragManager.getY();

    // スムージング処理（より滑らかに）
    const smoothingFactor = 0.05;
    this._dragX += (targetDragX - this._dragX) * smoothingFactor;
    this._dragY += (targetDragY - this._dragY) * smoothingFactor;

    let motionUpdated = false;

    this._model.loadParameters();

    // チャット画面：アイドルモーションを無効化
    // モーションの再生がある場合のみ更新
    if (!this._motionManager.isFinished()) {
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

    // チャット画面：顔の向きは固定（横を向かない）
    // 音声再生中は完全に正面を向く
    const isPlayingSound = this._lipSyncValue > 0 || this._wavFileHandler.getRms() > 0;

    if (isPlayingSound) {
      // 音声再生時は正面を向く
      const baseAngleX = this._model.getParameterValueById(this._idParamAngleX);
      const baseAngleY = this._model.getParameterValueById(this._idParamAngleY);
      const baseAngleZ = this._model.getParameterValueById(this._idParamAngleZ);

      this._model.setParameterValueById(this._idParamAngleX, baseAngleX);
      this._model.setParameterValueById(this._idParamAngleY, baseAngleY);
      this._model.setParameterValueById(this._idParamAngleZ, baseAngleZ);

      // 目線も正面
      const baseEyeBallX = this._model.getParameterValueById(this._idParamEyeBallX);
      const baseEyeBallY = this._model.getParameterValueById(this._idParamEyeBallY);
      this._model.setParameterValueById(this._idParamEyeBallX, baseEyeBallX);
      this._model.setParameterValueById(this._idParamEyeBallY, baseEyeBallY);
    } else {
      // 音声再生していない時は目線のみマウス追従
      const baseAngleX = this._model.getParameterValueById(this._idParamAngleX);
      const baseAngleY = this._model.getParameterValueById(this._idParamAngleY);
      const baseAngleZ = this._model.getParameterValueById(this._idParamAngleZ);

      // 顔の向きは固定（横を向かない）
      this._model.setParameterValueById(this._idParamAngleX, baseAngleX);
      this._model.setParameterValueById(this._idParamAngleY, baseAngleY);
      this._model.setParameterValueById(this._idParamAngleZ, baseAngleZ);

      // 目の動きのみマウス追従（自然な視線移動）
      const baseEyeBallX = this._model.getParameterValueById(this._idParamEyeBallX);
      const baseEyeBallY = this._model.getParameterValueById(this._idParamEyeBallY);
      this._model.setParameterValueById(this._idParamEyeBallX, baseEyeBallX + this._dragX * 0.8);
      this._model.setParameterValueById(this._idParamEyeBallY, baseEyeBallY + this._dragY * 0.3);  // Y軸の感度を下げる
    }

    // 体の向きは常に固定
    // チャット画面では体の向きを変えない

    // 呼吸
    if (this._breath != null) {
      this._breath.updateParameters(this._model, deltaTimeSeconds);
    }

    // 物理演算
    if (this._physics != null) {
      this._physics.evaluate(this._model, deltaTimeSeconds);
    }

    // リップシンク（強調）
    if (this._lipsync) {
      let value = 0.0;
      if (this._lipSyncValue > 0) {
        value = this._lipSyncValue;
      } else {
        this._wavFileHandler.update(deltaTimeSeconds);
        value = this._wavFileHandler.getRms();
      }

      // チャット画面ではリップシンクを少し強調
      value = Math.min(value * 1.2, 1.0);

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