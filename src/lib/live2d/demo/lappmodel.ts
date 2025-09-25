/**
 * Copyright(c) Live2D Inc. All rights reserved.
 *
 * Use of this source code is governed by the Live2D Open Software license
 * that can be found at https://www.live2d.com/eula/live2d-open-software-license-agreement_en.html.
 */

import { LAppModelBase } from './lappmodelbase';
import { LAppModelHome } from './models/lappmodel-home';
import { LAppModelChat } from './models/lappmodel-chat';
import { LAppModelHistory } from './models/lappmodel-history';
import { LAppModelReport } from './models/lappmodel-report';
import { logger } from '@/utils/logger';

/**
 * 画面タイプの定義
 */
export enum ScreenType {
  Home = 'home',
  Chat = 'chat',
  History = 'history',
  Report = 'report'
}

/**
 * 画面タイプに応じてLive2Dモデルクラスのインスタンスを作成するファクトリクラス
 */
export class LAppModelFactory {
  /**
   * 画面タイプに応じたモデルインスタンスを作成
   * @param screenType 画面タイプ
   * @returns 画面タイプに対応したLAppModelインスタンス
   */
  public static create(screenType: ScreenType): LAppModelBase {
    switch (screenType) {
      case ScreenType.Home:
        logger.log('Creating Home screen model - Active movements');
        return new LAppModelHome();

      case ScreenType.Chat:
        logger.log('Creating Chat screen model - Calm movements');
        return new LAppModelChat();

      case ScreenType.History:
        logger.log('Creating History screen model - Moderate movements');
        return new LAppModelHistory();

      case ScreenType.Report:
        logger.log('Creating Report screen model - Intellectual movements');
        return new LAppModelReport();

      default:
        logger.log('Creating default model (Home)');
        return new LAppModelHome();
    }
  }
}

// 後方互換性のため、デフォルトのLAppModelクラスをエクスポート
export class LAppModel extends LAppModelBase {}