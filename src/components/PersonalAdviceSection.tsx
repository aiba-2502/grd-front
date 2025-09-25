import React from 'react';
import { PersonalAdvice } from '@/types/report';

interface PersonalAdviceSectionProps {
  advice: PersonalAdvice | null;
  isLoading?: boolean;
}

const PersonalAdviceSection: React.FC<PersonalAdviceSectionProps> = ({ advice, isLoading }) => {
  if (isLoading) {
    return (
      <div className="text-gray-400 text-center py-8">
        <p>パーソナルアドバイスを生成中...</p>
      </div>
    );
  }

  if (!advice ||
      !advice.personalAxis ||
      (!advice.emotionalPatterns && !advice.coreValues && !advice.actionGuidelines)) {
    return (
      <div className="text-gray-400 text-sm">
        分析データがありません。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* あなたの軸 - 既存のスタイルを流用 */}
      {advice.personalAxis && (
        <div className="bg-blue-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-2">あなたの「軸」</h4>
          <p className="text-lg text-blue-700">{advice.personalAxis}</p>
        </div>
      )}

      {/* 感情パターン - シンプルなテキスト表示 */}
      {advice.emotionalPatterns && (advice.emotionalPatterns.summary || advice.emotionalPatterns.details?.length > 0) && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">感情パターン</h4>
          {advice.emotionalPatterns?.summary && (
            <p className="text-sm text-gray-700 mb-2">{advice.emotionalPatterns.summary}</p>
          )}
          {advice.emotionalPatterns?.details && advice.emotionalPatterns.details.length > 0 && (
            <ul className="list-disc list-inside text-sm text-gray-600">
              {advice.emotionalPatterns.details.map((detail, idx) => (
                <li key={idx}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* 価値観 - 既存のタグスタイルを流用 */}
      {advice.coreValues?.pillars && advice.coreValues.pillars.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">価値観の柱</h4>
          <div className="flex flex-wrap gap-2">
            {advice.coreValues.pillars.map((pillar, idx) => (
              <span key={idx} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                {pillar}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 行動指針 - シンプルなリスト */}
      {advice.actionGuidelines && (advice.actionGuidelines.career || advice.actionGuidelines.relationships || advice.actionGuidelines.lifePhilosophy) && (
        <div>
          <h4 className="font-medium text-gray-900 mb-2">行動指針</h4>
          <div className="space-y-2 text-sm">
            {advice.actionGuidelines?.career && (
              <div>
                <span className="font-medium">キャリア:</span>
                <span className="text-gray-700 ml-2">{advice.actionGuidelines.career}</span>
              </div>
            )}
            {advice.actionGuidelines?.relationships && (
              <div>
                <span className="font-medium">人間関係:</span>
                <span className="text-gray-700 ml-2">{advice.actionGuidelines.relationships}</span>
              </div>
            )}
            {advice.actionGuidelines?.lifePhilosophy && (
              <div>
                <span className="font-medium">生き方:</span>
                <span className="text-gray-700 ml-2">{advice.actionGuidelines.lifePhilosophy}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalAdviceSection;