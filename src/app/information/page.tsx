'use client';

import { useRouter } from 'next/navigation';

export default function InformationPage() {
  const router = useRouter();

  const steps = [
    {
      number: '1',
      title: 'アカウントを作成する',
      description: '新規登録画面でメールアドレスとパスワードを入力してアカウントを作成します。',
      actions: [
        '新規登録ボタンをクリック',
        'ユーザー名、メールアドレス、パスワードを入力',
        '登録ボタンをクリックして完了'
      ]
    },
    {
      number: '2',
      title: 'AIキャラクターと会話を始める',
      description: 'チャット画面で今日の出来事や気持ちを自由に話してください。',
      actions: [
        'チャット画面を開く',
        'テキスト入力欄にメッセージを入力',
        '送信ボタンをクリックまたはEnterキーで送信',
        'AIキャラクターの返答を待つ'
      ]
    },
    {
      number: '3',
      title: '過去の会話を振り返る',
      description: '履歴画面で過去の会話内容を確認できます。',
      actions: [
        '履歴ボタンをクリック',
        '確認したい日付の会話を選択',
        '会話内容と感情分析結果を確認',
        '必要に応じて削除も可能'
      ]
    },
    {
      number: '4',
      title: 'レポートを確認する',
      description: '定期的にあなたの感情変化をまとめたレポートを確認できます。',
      actions: [
        'レポート画面を開く',
        '期間（日次/週次/月次）を選択',
        '感情の推移グラフを確認',
        'PDFでダウンロード可能'
      ]
    }
  ];

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* 操作手順 */}
        <div className="space-y-8">
          {steps.map((step, index) => (
            <div key={index} className="pb-8">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    {step.number}
                  </div>
                </div>
                <div className="ml-4 flex-grow">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    {step.title}
                  </h2>
                  <p className="text-gray-600 mb-4">
                    {step.description}
                  </p>

                  {/* 具体的な操作手順 */}
                  <div className="bg-white/70 backdrop-blur-sm rounded-lg p-4 mb-4 border border-gray-200">
                    <p className="text-sm font-medium text-gray-700 mb-2">操作手順：</p>
                    <ul className="space-y-1">
                      {step.actions.map((action, actionIndex) => (
                        <li key={actionIndex} className="text-sm text-gray-600 flex items-start">
                          <span className="text-gray-400 mr-2">•</span>
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>

                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 始めるボタン */}
        <div className="mt-16 text-center">
          <p className="text-gray-600 mb-4">
            さっそく、チャットを始めてみましょう
          </p>
          <button
            onClick={() => router.push('/chat')}
            className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            今すぐ始める
          </button>
        </div>
      </div>
    </div>
  );
}