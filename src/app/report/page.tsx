'use client';

import { useAuth } from '@/contexts/AuthContextOptimized';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import BottomNav from '@/components/BottomNav';
import LoadingSpinner from '@/components/LoadingSpinner';
import { UserReport } from '@/types/report';
import reportService from '@/services/reportService';
import PersonalAdviceSection from '@/components/PersonalAdviceSection';
import dynamic from 'next/dynamic';
import { logger } from '@/utils/logger';

// Live2Dコンポーネントを動的インポート（SSR無効化）- コンテナ内表示版
const Live2DContainedComponent = dynamic(() => import('@/components/Live2DContainedComponent'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <div className="text-gray-400 text-center">
        <div className="animate-pulse">
          <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-2"></div>
          <p className="text-xs">キャラクター準備中...</p>
        </div>
      </div>
    </div>
  ),
});

export default function ReportPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'week' | 'month'>('week');
  const [reportData, setReportData] = useState<UserReport | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [showLive2D, setShowLive2D] = useState(false);
  const [needsAnalysis, setNeedsAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string | null>(null);
  const [analysisMessage, setAnalysisMessage] = useState('');
  const [lastExecutionTime, setLastExecutionTime] = useState<Date | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);


  useEffect(() => {
    // レポートデータを取得
    if (user) {
      fetchReportData();
    }
  }, [user]);

  useEffect(() => {
    // Live2Dを遅延ロード
    if (user) {
      const timer = setTimeout(() => {
        setShowLive2D(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user]);

  // クールダウンタイマー
  useEffect(() => {
    if (!lastExecutionTime) return;

    const updateCooldown = () => {
      const elapsed = Date.now() - lastExecutionTime.getTime();
      const remaining = Math.max(0, 60000 - elapsed); // 60秒 = 60000ms
      setCooldownRemaining(Math.ceil(remaining / 1000)); // 秒単位に変換

      if (remaining > 0) {
        return true; // 継続
      }
      return false; // 終了
    };

    // 初回更新
    if (!updateCooldown()) return;

    // 1秒ごとに更新
    const interval = setInterval(() => {
      if (!updateCooldown()) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastExecutionTime]);

  const fetchReportData = async () => {
    try {
      setIsLoadingData(true);
      logger.log('レポートデータを取得中...');

      // トークンをセット
      const token = localStorage.getItem('access_token');
      if (token) {
        reportService.setToken(token);
      }

      // APIからレポートデータを取得（分析必要性チェック付き）
      const response = await reportService.getReport();

      // needsAnalysisプロパティが存在する場合
      if ('needsAnalysis' in response) {
        setNeedsAnalysis(response.needsAnalysis);

        if ('lastAnalyzedAt' in response) {
          setLastAnalyzedAt(response.lastAnalyzedAt);
        }

        if (response.needsAnalysis === true) {
          // needsAnalysisがtrueの場合
          setAnalysisMessage(response.message);
          // 既存データがあれば表示
          if (response.existingData) {
            setReportData(response.existingData);
          }
        } else if (response.needsAnalysis === false) {
          // needsAnalysisがfalseの場合、responseはUserReportを拡張したもの
          // TypeScript の型ガードで正しく推論させる
          const reportWithoutAnalysis = response;
          const userReport: UserReport = {
            userId: reportWithoutAnalysis.userId,
            userName: reportWithoutAnalysis.userName,
            strengths: reportWithoutAnalysis.strengths,
            thinkingPatterns: reportWithoutAnalysis.thinkingPatterns,
            values: reportWithoutAnalysis.values,
            personalAdvice: reportWithoutAnalysis.personalAdvice,
            conversationReport: reportWithoutAnalysis.conversationReport,
            updatedAt: reportWithoutAnalysis.updatedAt
          };
          setReportData(userReport);
        }
      } else {
        // 通常のレポートデータ（後方互換性のため）
        setReportData(response);
        setNeedsAnalysis(false);
      }
    } catch (error) {
      logger.error('レポートデータの取得に失敗しました:', error);
      setReportData(null);
    } finally {
      setIsLoadingData(false);
    }
  };

  // AI分析を手動実行
  const handleExecuteAnalysis = async () => {
    // クールダウンチェック
    if (cooldownRemaining > 0) {
      alert(`分析は${cooldownRemaining}秒後に実行可能になります。`);
      return;
    }

    try {
      setIsAnalyzing(true);
      logger.log('AI分析を開始します...');

      const startTime = Date.now();
      const data = await reportService.executeAnalysis();
      const endTime = Date.now();
      logger.log(`AI分析が完了しました（${(endTime - startTime) / 1000}秒）`);

      setReportData(data);
      setNeedsAnalysis(false);
      setLastAnalyzedAt(new Date().toISOString());
      setLastExecutionTime(new Date()); // 実行時刻を記録
      setCooldownRemaining(60); // 60秒のクールダウン開始
    } catch (error) {
      logger.error('AI分析に失敗しました:', error);
      alert('分析に失敗しました。しばらくしてから再試行してください。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const currentReport = reportData?.conversationReport[activeTab];

  return (
    <div className="flex flex-col min-h-screen">
      {/* 分析通知バナー（常時表示） */}
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {needsAnalysis && (
              <p className="text-sm text-blue-900 font-medium">
                新しいメッセージが追加されました。AI分析を実行できます。
              </p>
            )}
            {lastAnalyzedAt && (
              <p className={`text-xs text-blue-700 ${needsAnalysis ? 'mt-1' : ''}`}>
                最終分析: {new Date(lastAnalyzedAt).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {needsAnalysis && (
              <>
                {cooldownRemaining > 0 && (
                  <div className="text-sm text-blue-700">
                    <span className="font-medium">{cooldownRemaining}秒</span>後に再実行可能
                  </div>
                )}
                <button
                  onClick={handleExecuteAnalysis}
                  disabled={isAnalyzing || cooldownRemaining > 0}
                  className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    isAnalyzing || cooldownRemaining > 0
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isAnalyzing ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      AI分析中...
                    </span>
                  ) : cooldownRemaining > 0 ? (
                    `待機中 (${cooldownRemaining}秒)`
                  ) : (
                    'AI分析を実行'
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Content - 左右分割レイアウト */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* 左カラム - Live2D Character エリア - 拡大版 */}
        <div className="w-80 lg:w-96 xl:w-[28rem] bg-transparent border-r border-gray-200 flex-shrink-0 relative overflow-hidden">
          {/* Live2Dコンポーネントを配置 - コンテナ全域を表示領域として使用 */}
          {showLive2D ? (
            <div className="absolute inset-0">
              <Live2DContainedComponent screenType="report" />
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-gray-400 text-center">
                <div className="animate-pulse">
                  <div className="w-24 h-24 bg-gray-200 rounded-full mx-auto mb-2"></div>
                  <p className="text-xs">キャラクターを読み込み中...</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右カラム - レポートコンテンツ */}
        <div className="flex-1 overflow-y-auto bg-transparent pb-28 scrollbar-thin">
          <div className="container mx-auto px-4 py-6 max-w-4xl">
            {/* AI分析セクション */}
            <div className="space-y-6 mb-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 強みカード */}
                <div className="bg-white/75 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    {user.name || 'あなた'}の強み
                  </h3>
                  <div className="space-y-3">
                    {isLoadingData ? (
                      <LoadingSpinner message="あなたの強みをAI分析中です" />
                    ) : reportData && reportData.strengths && reportData.strengths.length > 0 ? (
                      reportData.strengths.slice(0, 2).map((strength) => (
                        <div key={strength.id} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
                          <p className="text-sm leading-relaxed text-gray-700">{strength.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">分析結果がありません</p>
                    )}
                  </div>
                </div>

                {/* 思考特徴カード */}
                <div className="bg-white/75 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    {user.name || 'あなた'}の思考特徴
                  </h3>
                  <div className="space-y-3">
                    {isLoadingData ? (
                      <LoadingSpinner message="思考パターンをAI分析中です" />
                    ) : reportData && reportData.thinkingPatterns && reportData.thinkingPatterns.length > 0 ? (
                      reportData.thinkingPatterns.slice(0, 2).map((pattern) => (
                        <div key={pattern.id} className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-100">
                          <p className="text-sm leading-relaxed text-gray-700">{pattern.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">分析結果がありません</p>
                    )}
                  </div>
                </div>

                {/* 価値観カード */}
                <div className="bg-white/75 backdrop-blur-sm border border-gray-200 rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    {user.name || 'あなた'}の価値観
                  </h3>
                  <div className="space-y-3">
                    {isLoadingData ? (
                      <LoadingSpinner message="価値観をAI分析中です" />
                    ) : reportData && reportData.values && reportData.values.length > 0 ? (
                      reportData.values.slice(0, 2).map((value) => (
                        <div key={value.id} className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-3 border border-purple-100">
                          <p className="text-sm leading-relaxed text-gray-700">{value.description}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">分析結果がありません</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 会話分析セクション */}
            <div className="bg-white/75 backdrop-blur-sm rounded-lg shadow-sm">
              {/* タブ */}
              <div className="border-b border-gray-200">
                <div className="flex">
                  <button
                    onClick={() => setActiveTab('week')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'week'
                        ? 'text-blue-600 border-blue-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    今週
                  </button>
                  <button
                    onClick={() => setActiveTab('month')}
                    className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'month'
                        ? 'text-blue-600 border-blue-600'
                        : 'text-gray-500 border-transparent hover:text-gray-700'
                    }`}
                  >
                    今月
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-6">
                {/* セクション1: 会話サマリー */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    {activeTab === 'week' ? '今週' : '今月'}の会話サマリー
                  </h3>
                  {isLoadingData ? (
                    <LoadingSpinner message="会話履歴をAI分析中です" />
                  ) : currentReport?.summary && currentReport.summary !== "この期間の会話履歴はありません。" ? (
                    <p className="text-gray-700 leading-relaxed">
                      {currentReport.summary}
                    </p>
                  ) : (
                    <p className="text-gray-400">
                      この期間の分析可能な会話データがありません。
                      キャラクターとの対話を続けることで、より詳細な分析結果が表示されます。
                    </p>
                  )}
                </div>

                {/* セクション2: パーソナルアドバイス */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    パーソナルアドバイス
                  </h3>
                  <PersonalAdviceSection
                    advice={reportData?.personalAdvice || null}
                    isLoading={isLoadingData}
                  />
                </div>

                {/* セクション3: 感情とキーワードの相関 */}
                <div>
                  <h3 className="text-base font-semibold text-gray-900 mb-3">
                    感情とキーワードの相関
                  </h3>
                  {isLoadingData ? (
                    <LoadingSpinner message="感情分析中です" />
                  ) : currentReport?.emotionKeywords && currentReport.emotionKeywords.length > 0 ? (
                    <div className="space-y-3">
                      {currentReport.emotionKeywords.map((item) => (
                        <div key={item.emotion} className="flex items-start">
                          <span className="font-medium text-gray-700 min-w-[80px]">
                            {item.emotion}
                          </span>
                          <span className="text-gray-500 mx-2">→</span>
                          <span className="text-gray-600">
                            {item.keywords && Array.isArray(item.keywords) ? item.keywords.join('、') : 'キーワードなし'}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-400 text-sm">感情分析に必要なデータがありません</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}