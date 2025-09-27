# Frontend リファレンス - 心のログ

## 目次
- [概要](#概要)
- [技術スタック](#技術スタック)
- [プロジェクト構造](#プロジェクト構造)
- [コンポーネント設計](#コンポーネント設計)
- [状態管理](#状態管理)
- [API通信](#api通信)
- [Live2D統合](#live2d統合)
- [音声機能](#音声機能)
- [ルーティング](#ルーティング)
- [スタイリング](#スタイリング)
- [開発ガイド](#開発ガイド)
- [ビルド・デプロイ](#ビルドデプロイ)
- [テスト](#テスト)

## 概要

心のログのフロントエンドは、Next.js 15とReact 19を使用したモダンなWebアプリケーションです。
AI VTuberキャラクターとの自然な対話体験を実現し、Live2Dによるアニメーション、音声合成・認識、感情分析可視化などの高度な機能を提供します。

## 技術スタック

### コア技術
- **Next.js**: 15.5.0 (App Router + Turbopack)
- **React**: 19.1.0
- **TypeScript**: 5.9.2
- **Node.js**: 20.x

### 状態管理
- **Zustand**: 5.0.8 (グローバル状態管理)
- **React Context**: 認証状態管理

### UI/スタイリング
- **TailwindCSS**: v4
- **Heroicons**: 2.2.0 (アイコン)
- **PostCSS**: 最新版

### ユーティリティ
- **Axios**: 1.11.0 (HTTP通信)
- **DOMPurify**: 3.2.6 (XSS対策)
- **UUID**: 11.1.0 (ID生成)

### 開発ツール
- **ESLint**: v9
- **Prettier**: 3.6.2
- **Jest**: 30.1.3 (テスト)
- **ts-jest**: 29.4.3

## プロジェクト構造

```
frontend/
├── src/
│   ├── app/                      # App Router ページ
│   │   ├── layout.tsx            # ルートレイアウト
│   │   ├── page.tsx              # ホームページ
│   │   ├── chat/                 # チャット画面
│   │   ├── history/              # 履歴画面
│   │   ├── report/               # レポート画面
│   │   ├── mypage/               # マイページ
│   │   ├── login/                # ログイン
│   │   ├── signup/               # サインアップ
│   │   └── information/          # 情報ページ
│   ├── components/               # 再利用可能なコンポーネント
│   │   ├── Chat/                 # チャット関連
│   │   │   ├── ChatContainer.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── Live2DCharacter.tsx
│   │   ├── History/              # 履歴関連
│   │   │   ├── HistoryList.tsx
│   │   │   └── SearchBox.tsx
│   │   ├── Modal/                # モーダル
│   │   │   └── DeleteConfirmModal.tsx
│   │   ├── BottomNav.tsx         # ボトムナビゲーション
│   │   ├── Header.tsx            # ヘッダー
│   │   ├── LoadingSpinner.tsx   # ローディング
│   │   └── ErrorBoundary.tsx    # エラーハンドリング
│   ├── contexts/                 # React Context
│   │   ├── AuthContext.tsx
│   │   └── AuthContextOptimized.tsx
│   ├── services/                 # APIサービス層
│   │   ├── aiService.ts          # AI通信
│   │   ├── authService.ts        # 認証
│   │   ├── chatApi.ts            # チャットAPI
│   │   ├── reportService.ts      # レポート
│   │   └── voiceApi.ts           # 音声処理
│   ├── stores/                   # Zustand ストア
│   │   └── chatStore.ts          # チャット状態管理
│   ├── lib/                      # ライブラリコード
│   │   ├── hooks/                # カスタムフック
│   │   │   └── useLipSyncHandler.ts
│   │   └── live2d/               # Live2D関連
│   │       ├── NativeLive2DWrapper.ts
│   │       ├── NaturalMotionController.ts
│   │       ├── PerformanceMonitor.ts
│   │       ├── lipsync/          # リップシンク
│   │       │   ├── AudioAnalyzer.ts
│   │       │   ├── AudioWorkletManager.ts
│   │       │   ├── CascadeAnalyzer.ts
│   │       │   └── LipSyncController.ts
│   │       └── demo/             # Live2Dデモ実装
│   ├── types/                    # TypeScript型定義
│   │   ├── chat.ts
│   │   ├── report.ts
│   │   └── global.d.ts
│   └── utils/                    # ユーティリティ
│       ├── chatAdapter.ts        # データ変換
│       └── logger.ts             # ロギング
├── public/                       # 静的ファイル
│   ├── models/                   # Live2Dモデル
│   └── audio/                    # 音声ファイル
├── docs/                         # ドキュメント
├── package.json                  # 依存関係
├── tsconfig.json                 # TypeScript設定
├── next.config.ts                # Next.js設定
├── tailwind.config.ts            # TailwindCSS設定
├── jest.config.js                # Jest設定
└── eslint.config.mjs            # ESLint設定
```

## コンポーネント設計

### 主要コンポーネント

#### ChatContainer (`components/Chat/ChatContainer.tsx`)
- チャット機能のメインコンテナ
- メッセージ表示、入力、音声機能を統合
- Live2Dキャラクター表示

#### ChatInput (`components/Chat/ChatInput.tsx`)
- メッセージ入力フィールド
- 音声入力対応
- ファイル添付機能

#### Live2DCharacter (`components/Chat/Live2DCharacter.tsx`)
- Live2Dモデルの表示とアニメーション制御
- リップシンク連携
- 感情表現

#### HistoryList (`components/History/HistoryList.tsx`)
- チャット履歴の一覧表示
- ページネーション
- 検索・フィルタリング

#### PersonalAdviceSection (`components/PersonalAdviceSection.tsx`)
- パーソナライズされたアドバイス表示
- AIによる分析結果の可視化

## 状態管理

### Zustand Store (`stores/chatStore.ts`)

```typescript
interface ChatStore {
  messages: ChatMessage[];          // メッセージ配列
  sessionId: string;                 // セッションID
  isLoading: boolean;                // ローディング状態
  error: string | null;              // エラー状態
  settings: ChatSettings;            // チャット設定
  playingMessageId: string | null;  // 再生中メッセージ

  // Actions
  addMessage: (message: ChatMessage) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setSessionId: (sessionId: string) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  updateSettings: (settings: Partial<ChatSettings>) => void;
  clearMessages: () => void;
  newSession: () => void;
  setPlayingMessageId: (messageId: string | null) => void;
}
```

### 認証Context (`contexts/AuthContextOptimized.tsx`)

```typescript
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}
```

## API通信

### サービス層

#### ChatApi Service (`services/chatApi.ts`)
```typescript
class ChatApiService {
  sendMessage(request: ChatRequest): Promise<ChatResponse>
  getMessages(session_id?: string, page?: number): Promise<MessagesResponse>
  getChatSessions(): Promise<{ sessions: ChatSession[] }>
  deleteMessage(messageId: string): Promise<void>
  deleteChatSession(sessionId: string): Promise<void>
}
```

#### AuthService (`services/authService.ts`)
```typescript
class AuthService {
  login(email: string, password: string): Promise<LoginResponse>
  signup(email: string, password: string, name: string): Promise<SignupResponse>
  logout(): Promise<void>
  refreshToken(): Promise<RefreshResponse>
  me(): Promise<UserResponse>
  updateProfile(data: UpdateProfileData): Promise<UserResponse>
}
```

#### VoiceApi Service (`services/voiceApi.ts`)
```typescript
class VoiceApiService {
  generateVoice(text: string, options?: VoiceOptions): Promise<ArrayBuffer>
  transcribeAudio(audioBlob: Blob): Promise<TranscriptionResponse>
  synthesizeSpeech(text: string, voice?: string): Promise<AudioBuffer>
  analyzeEmotion(audioData: ArrayBuffer): Promise<EmotionAnalysis>
}
```

### APIエンドポイント

```typescript
// 認証
POST   /api/v1/auth/signup         // ユーザー登録
POST   /api/v1/auth/login          // ログイン
POST   /api/v1/auth/refresh        // トークン更新
POST   /api/v1/auth/logout         // ログアウト
GET    /api/v1/auth/me             // 現在のユーザー

// チャット
POST   /api/v1/chats               // メッセージ送信
GET    /api/v1/chats               // メッセージ取得
DELETE /api/v1/chats/:id           // メッセージ削除
GET    /api/v1/chats/sessions      // セッション一覧
DELETE /api/v1/chats/sessions/:id  // セッション削除

// 音声
POST   /api/v1/voices/generate     // 音声生成

// レポート
GET    /api/v1/report              // レポート取得
POST   /api/v1/report/analyze      // 分析実行
GET    /api/v1/report/weekly       // 週次レポート
GET    /api/v1/report/monthly      // 月次レポート

// ユーザー
GET    /api/v1/users/me            // プロフィール取得
PATCH  /api/v1/users/me            // プロフィール更新
```

## Live2D統合

### NativeLive2DWrapper
- Live2Dモデルのロードと管理
- パフォーマンス最適化
- 自然なモーション制御

### リップシンク機能
```typescript
// AudioAnalyzer: 音声解析
// CascadeAnalyzer: カスケード解析
// LipSyncController: リップシンク制御
// AudioWorkletManager: Web Audio API管理
```

### モーション制御
- 待機モーション
- 会話モーション
- 感情表現モーション
- まばたき・呼吸の自然な動き

## 音声機能

### 音声再生
- Web Audio APIによる高品質再生
- 再生速度・音量調整
- 再生状態管理

### 音声認識
- Web Speech APIによる音声入力
- リアルタイム文字起こし
- 多言語対応

### 音声合成
- OpenAI TTS統合
- 感情に応じた音声調整
- キャラクター別音声設定

## ルーティング

### 実装済みルート
```
/                     # ホームページ
/login               # ログイン
/signup              # サインアップ
/chat                # チャット画面（メイン）
/history             # 履歴一覧
/report              # 分析レポート
/mypage              # マイページ
/information         # 情報ページ
```

### ルート保護
- 認証が必要なページはAuthContextで保護
- 未認証時は自動的にログインページへリダイレクト

## スタイリング

### TailwindCSS設定

#### カラーパレット
```css
colors: {
  primary: {
    50: '#f0f9ff',
    500: '#3b82f6',
    900: '#1e3a8a'
  },
  emotion: {
    happy: '#fbbf24',    // 黄色
    sad: '#60a5fa',      // 青
    angry: '#f87171',    // 赤
    neutral: '#9ca3af'   // グレー
  }
}
```

### レスポンシブデザイン
- モバイルファースト
- ブレークポイント: sm(640px), md(768px), lg(1024px), xl(1280px)
- タッチフレンドリーなUI

## 開発ガイド

### 環境変数
```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
INTERNAL_API_URL=http://web:3000
NODE_ENV=development
NEXT_PUBLIC_SELECT_AI_SERVICE=openai
NEXT_PUBLIC_SELECT_AI_MODEL=gpt-4o-mini
NEXT_PUBLIC_TEMPERATURE=0.7
NEXT_PUBLIC_MAX_TOKENS=1000
```

### 開発コマンド
```bash
# 開発サーバー起動（Turbopack）
npm run dev

# ビルド
npm run build

# 本番モード起動
npm run start

# 型チェック
npm run type-check

# リント
npm run lint

# フォーマット
npm run format

# テスト
npm run test
npm run test:watch
npm run test:coverage
```

### コーディング規約

#### TypeScript
- strictモードを有効化
- any型の使用禁止
- 型定義は必須
- interfaceを優先

#### React
- 関数コンポーネントを使用
- React.FCは使用しない
- Custom Hooksはuse接頭辞
- メモ化を適切に使用

#### ネーミング
- コンポーネント: PascalCase
- ファイル名: コンポーネントと同名
- hooks: camelCase (useXxx)
- 定数: UPPER_SNAKE_CASE

## ビルド・デプロイ

### ビルド最適化
```javascript
// next.config.ts
const nextConfig = {
  experimental: {
    turbo: true,  // Turbopack有効化
  },
  images: {
    domains: ['localhost'],
  },
  output: 'standalone',  // Docker用
};
```

### Docker設定
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

### パフォーマンス最適化
- 画像の最適化（next/image）
- コード分割（dynamic import）
- SSG/SSRの適切な使い分け
- Web Vitalsの監視
- Live2Dモデルの遅延ロード

## テスト

### テスト戦略
```bash
# Unit Test
npm run test

# Integration Test
npm run test:integration

# E2E Test (今後実装)
npm run test:e2e
```

### テストツール
- Jest: ユニットテスト
- React Testing Library: コンポーネントテスト
- MSW: APIモック (予定)
- Cypress: E2Eテスト (予定)

## トラブルシューティング

### よくある問題

#### 1. ビルドエラー
```bash
# キャッシュクリア
rm -rf .next node_modules
npm install
npm run build
```

#### 2. TypeScriptエラー
```bash
# 型定義の再生成
npm run type-check
```

#### 3. Live2Dモデルが表示されない
- public/models/にモデルファイルが存在するか確認
- ブラウザコンソールでエラーを確認
- WebGLサポートを確認

#### 4. 音声が再生されない
- ブラウザの音声許可設定を確認
- HTTPSまたはlocalhostでアクセスしているか確認

## 実装状況

### 完了済み
- 基本的なページ構造とルーティング
- 認証機能（ログイン、サインアップ、ログアウト）
- チャット機能（送受信、履歴表示）
- Live2D統合とアニメーション
- 音声再生・認識機能
- リップシンク実装
- 状態管理（Zustand）
- API通信層
- レスポンシブデザイン

### 開発中
- パフォーマンス最適化
- テストカバレッジ向上
- エラーハンドリング強化
- オリジナルLive2Dキャラクターの導入
- モバイルファースト思想のUIへ修正

## 関連資料
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Live2D Cubism SDK](https://www.live2d.com/en/sdk)