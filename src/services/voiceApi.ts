import axios, { AxiosError } from 'axios';
import { decode as base64ToArrayBuffer } from 'base64-arraybuffer';
import { logger } from '@/utils/logger';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface VoiceGenerationResponse {
  audioUrl?: string;
  audioData?: string;
  error?: string;
}

export class VoiceService {
  private static audioCache = new Map<string, string>();
  private static currentAudio: HTMLAudioElement | null = null;
  private static blobUrls = new Set<string>();  // Blob URLを管理

  /**
   * テキストを音声に変換して再生
   * @param text 読み上げるテキスト
   * @param options オプション設定
   * @returns Audio要素のインスタンス
   */
  static async playVoice(
    text: string,
    options?: {
      volume?: number;
      playbackRate?: number;
      onEnded?: () => void;
      onError?: (error: Error) => void;
      onLipSyncReady?: (audioUrl: string) => void;  // リップシンク用コールバック追加
    }
  ): Promise<HTMLAudioElement> {
    try {
      // 空のテキストは処理しない
      if (!text.trim()) {
        throw new Error('読み上げるテキストが空です');
      }

      // 既存の再生を停止
      if (this.currentAudio) {
        this.currentAudio.pause();
        this.currentAudio = null;
      }

      // キャッシュチェック
      const cacheKey = text;
      let audioUrl: string;

      if (this.audioCache.has(cacheKey)) {
        audioUrl = this.audioCache.get(cacheKey)!;
      } else {
        // 音声生成API呼び出し（バックエンド経由）
        audioUrl = await this.generateVoice(text);

        // キャッシュに保存（最大10件）
        if (this.audioCache.size >= 10) {
          const firstKey = this.audioCache.keys().next().value;
          const oldUrl = this.audioCache.get(firstKey);

          // 古いBlob URLを解放
          if (oldUrl && oldUrl.startsWith('blob:')) {
            URL.revokeObjectURL(oldUrl);
            this.blobUrls.delete(oldUrl);
            logger.log('VoiceService: 古いBlob URL解放', oldUrl);
          }

          this.audioCache.delete(firstKey);
        }
        this.audioCache.set(cacheKey, audioUrl);
      }

      // リップシンク用コールバックを実行（WAVファイルの場合）
      // Blob URL、Base64データURL、通常のWAVファイルURLに対応
      if (options?.onLipSyncReady &&
          (audioUrl.includes('wav') ||
           audioUrl.startsWith('data:audio/wav') ||
           audioUrl.startsWith('blob:'))) {
        logger.log('VoiceService: リップシンクコールバック実行', audioUrl.substring(0, 50) + '...');
        options.onLipSyncReady(audioUrl);
      } else {
        logger.log('VoiceService: リップシンクコールバックスキップ', {
          hasCallback: !!options?.onLipSyncReady,
          isWav: audioUrl.includes('wav') || audioUrl.startsWith('data:audio/wav') || audioUrl.startsWith('blob:'),
          urlPreview: audioUrl.substring(0, 50) + '...'
        });
      }

      // 音声を再生
      this.currentAudio = new Audio(audioUrl);

      // デフォルト値または環境変数から設定値を取得
      const defaultVolume = parseFloat(process.env.NEXT_PUBLIC_VOICE_VOLUME || '0.8');
      const defaultPlaybackRate = parseFloat(process.env.NEXT_PUBLIC_VOICE_PLAYBACK_RATE || '1.0');

      this.currentAudio.volume = options?.volume ?? defaultVolume;
      this.currentAudio.playbackRate = options?.playbackRate ?? defaultPlaybackRate;

      // イベントハンドラの設定
      if (options?.onEnded) {
        this.currentAudio.onended = options.onEnded;
      }

      if (options?.onError) {
        this.currentAudio.onerror = () => {
          options.onError!(new Error('音声再生中にエラーが発生しました'));
        };
      }

      await this.currentAudio.play();
      return this.currentAudio;
    } catch (error) {
      logger.error('音声再生エラー:', error);
      throw error;
    }
  }

  /**
   * 音声生成APIを呼び出し（バックエンド経由）
   */
  private static async generateVoice(text: string): Promise<string> {
    try {
      const response = await axios.post<VoiceGenerationResponse>(
        `${API_URL}/api/v1/voices/generate`,
        { text },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      // レスポンスから音声URLまたはBase64データを取得
      logger.log('VoiceService: API応答', {
        hasAudioUrl: !!response.data.audioUrl,
        hasAudioData: !!response.data.audioData,
        audioUrlPreview: response.data.audioUrl ? response.data.audioUrl.substring(0, 50) : null
      });

      if (response.data.audioUrl) {
        // URLが返される場合
        return response.data.audioUrl;
      } else if (response.data.audioData) {
        // Base64データが返される場合
        try {
          logger.log('VoiceService: Base64データ処理開始');

          // Base64データの先頭を確認
          const base64Data = response.data.audioData;
          let blobUrl: string;

          // NijiVoice APIから返されるWAVファイルは圧縮形式の可能性があるため、
          // 全てのオーディオデータをAudioContext経由でデコードして
          // 線形PCM（フォーマットID=1）のWAVファイルに変換する
          logger.log('VoiceService: AudioContextでデコード処理開始');

          try {
            // まずBase64をArrayBufferに変換
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const originalArrayBuffer = bytes.buffer;

            // AudioContextを使用してデコード
            const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextClass) {
              throw new Error('AudioContext not supported');
            }
            const audioContext = new AudioContextClass();

            // デコード（どんな形式でも対応可能）
            const audioBuffer = await audioContext.decodeAudioData(originalArrayBuffer);

            logger.log('VoiceService: オーディオデコード成功', {
              sampleRate: audioBuffer.sampleRate,
              numberOfChannels: audioBuffer.numberOfChannels,
              length: audioBuffer.length,
              duration: audioBuffer.duration
            });

            // 16ビット線形PCM WAVファイルを生成（フォーマットID=1）
            const encodedWavArrayBuffer = this.createPCMWavFile(audioBuffer);

            // エンコード後のWAVファイルヘッダーを確認
            const encodedBytes = new Uint8Array(encodedWavArrayBuffer);
            const formatId = encodedBytes[20] | (encodedBytes[21] << 8);
            logger.log('VoiceService: WAVエンコード成功', {
              size: encodedWavArrayBuffer.byteLength,
              riff: String.fromCharCode(encodedBytes[0], encodedBytes[1], encodedBytes[2], encodedBytes[3]),
              wave: String.fromCharCode(encodedBytes[8], encodedBytes[9], encodedBytes[10], encodedBytes[11]),
              formatId: formatId,  // これが1でなければならない
              channels: encodedBytes[22] | (encodedBytes[23] << 8),
              sampleRate: encodedBytes[24] | (encodedBytes[25] << 8) | (encodedBytes[26] << 16) | (encodedBytes[27] << 24),
              bitsPerSample: encodedBytes[34] | (encodedBytes[35] << 8)
            });

            // BlobとしてObjectURLを作成
            const blob = new Blob([encodedWavArrayBuffer], { type: 'audio/wav' });
            blobUrl = URL.createObjectURL(blob);

            // AudioContextをクローズ
            await audioContext.close();
          } catch (decodeError) {
            // AudioContextでのデコードに失敗した場合は、base64-arraybufferを使用
            logger.log('VoiceService: AudioContextデコード失敗、base64-arraybufferを使用', decodeError);

            const originalArrayBuffer = base64ToArrayBuffer(base64Data);
            const AudioContextClass = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
            if (!AudioContextClass) {
              throw new Error('AudioContext not supported');
            }
            const audioContext = new AudioContextClass();
            const audioBuffer = await audioContext.decodeAudioData(originalArrayBuffer);

            logger.log('VoiceService: オーディオデコード成功（フォールバック）', {
              sampleRate: audioBuffer.sampleRate,
              numberOfChannels: audioBuffer.numberOfChannels,
              length: audioBuffer.length,
              duration: audioBuffer.duration
            });

            // 16ビット線形PCM WAVファイルを生成
            const encodedWavArrayBuffer = this.createPCMWavFile(audioBuffer);

            const blob = new Blob([encodedWavArrayBuffer], { type: 'audio/wav' });
            blobUrl = URL.createObjectURL(blob);

            await audioContext.close();
          }

          logger.log('VoiceService: Blob URLを生成', blobUrl);

          // Blob URLを管理対象に追加
          this.blobUrls.add(blobUrl);

          return blobUrl;
        } catch (error) {
          logger.error('Base64からWAVへの変換エラー:', error);
          throw new Error('音声データの変換に失敗しました');
        }
      } else if (response.data.error) {
        throw new Error(response.data.error);
      } else {
        throw new Error('音声データが取得できませんでした');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<VoiceGenerationResponse>;

        if (axiosError.response?.data?.error) {
          throw new Error(axiosError.response.data.error);
        } else if (axiosError.response?.status === 500) {
          throw new Error('サーバーエラーが発生しました');
        } else if (axiosError.response?.status === 400) {
          throw new Error('リクエストパラメータが不正です');
        }

        throw new Error(`API呼び出しエラー: ${axiosError.message}`);
      }

      throw error;
    }
  }

  /**
   * 現在再生中の音声を停止
   */
  static stopVoice(): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
  }

  /**
   * 16ビットPCM WAVファイルを手動で生成
   */
  private static createPCMWavFile(audioBuffer: AudioBuffer): ArrayBuffer {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const length = audioBuffer.length;

    // 16ビットPCMなので、1サンプルあたり2バイト
    const bytesPerSample = 2;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const fileSize = 44 + dataSize; // 44 = WAVヘッダーサイズ

    // ArrayBufferとDataViewを作成
    const buffer = new ArrayBuffer(fileSize);
    const view = new DataView(buffer);

    // WAVファイルヘッダーを書き込む
    let offset = 0;

    // "RIFF"チャンク
    const writeString = (str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset++, str.charCodeAt(i));
      }
    };

    writeString('RIFF');
    view.setUint32(offset, fileSize - 8, true); offset += 4; // ファイルサイズ - 8
    writeString('WAVE');

    // "fmt "チャンク
    writeString('fmt ');
    view.setUint32(offset, 16, true); offset += 4; // fmt チャンクサイズ
    view.setUint16(offset, 1, true); offset += 2; // フォーマットID (1 = リニアPCM)
    view.setUint16(offset, numberOfChannels, true); offset += 2; // チャンネル数
    view.setUint32(offset, sampleRate, true); offset += 4; // サンプリングレート
    view.setUint32(offset, byteRate, true); offset += 4; // バイトレート
    view.setUint16(offset, blockAlign, true); offset += 2; // ブロックアライン
    view.setUint16(offset, 16, true); offset += 2; // ビット深度 (16ビット)

    // "data"チャンク
    writeString('data');
    view.setUint32(offset, dataSize, true); offset += 4; // データサイズ

    // PCMデータを書き込む
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i];
        // Float32 (-1.0 〜 1.0) を Int16 (-32768 〜 32767) に変換
        const clampedSample = Math.max(-1, Math.min(1, sample));
        const int16Sample = Math.floor(clampedSample * 32767);
        view.setInt16(offset, int16Sample, true);
        offset += 2;
      }
    }

    logger.log('VoiceService: 16ビットPCM WAVファイル生成', {
      formatId: 1,
      channels: numberOfChannels,
      sampleRate: sampleRate,
      bitsPerSample: 16,
      dataSize: dataSize,
      fileSize: fileSize
    });

    return buffer;
  }

  /**
   * キャッシュをクリア
   */
  static clearCache(): void {
    // Blob URLを解放
    this.blobUrls.forEach(blobUrl => {
      URL.revokeObjectURL(blobUrl);
      logger.log('VoiceService: Blob URL解放', blobUrl);
    });
    this.blobUrls.clear();

    this.audioCache.clear();
  }
}