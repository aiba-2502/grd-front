export interface Emotion {
  name: string;
  label: string;
  intensity: number;
  frequency?: number;
}

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  session_id: string;
  metadata?: Record<string, any>;
  emotions?: Emotion[];
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  session_id: string;
  last_message_at: string;
  message_count: number;
  preview: string;
  emotions?: Emotion[];
}

export interface ChatRequest {
  content: string;
  session_id?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  api_key?: string;
  system_prompt?: string;
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

export interface ChatResponse {
  session_id: string;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
}

export interface ChatSettings {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
  api_key?: string;
}