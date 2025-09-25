// AI Service Factory for multiple AI providers

export type AIProvider = 'openai' | 'anthropic' | 'google';

export interface AIConfig {
  provider: AIProvider;
  apiKey?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIResponse {
  content: string;
  model: string;
  provider: AIProvider;
}

// AI Model configurations
export const AI_MODELS = {
  openai: {
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o-mini',
  },
  anthropic: {
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ],
    defaultModel: 'claude-3-5-sonnet-20241022',
  },
  google: {
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'],
    defaultModel: 'gemini-1.5-flash',
  },
};

class AIService {
  private provider: AIProvider;
  private apiKey: string | undefined;

  constructor(provider: AIProvider = 'openai') {
    this.provider = provider;
    // APIキーはバックエンドで管理するため、フロントエンドでは設定しない
    this.apiKey = undefined;
  }

  // APIキーはバックエンドで管理するため、このメソッドは不要
  // private getApiKey(provider: AIProvider): string | undefined {
  //   // セキュリティのため、APIキーはフロントエンドに露出させない
  //   return undefined;
  // }

  getAvailableModels(): string[] {
    return AI_MODELS[this.provider].models;
  }

  getDefaultModel(): string {
    return AI_MODELS[this.provider].defaultModel;
  }

  async chat(messages: AIMessage[], config: Partial<AIConfig>): Promise<AIResponse> {
    const finalConfig: AIConfig = {
      provider: this.provider,
      apiKey: config.apiKey || this.apiKey,
      model: config.model || this.getDefaultModel(),
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 1000,
      systemPrompt: config.systemPrompt,
    };

    // バックエンドのAPIを呼び出す
    // バックエンド側で各AIプロバイダーのAPIを統一的に処理
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/chats`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify({
        messages,
        config: finalConfig,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI Service Error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      content: data.content,
      model: finalConfig.model,
      provider: this.provider,
    };
  }

  static createService(provider?: AIProvider): AIService {
    const selectedProvider = provider || 
      (process.env.NEXT_PUBLIC_SELECT_AI_SERVICE as AIProvider) || 
      'openai';
    return new AIService(selectedProvider);
  }
}

export default AIService;