/**
 * AudioWorkletManager Test Suite
 * TDD: Red Phase - Write failing tests first
 */

import { AudioWorkletManager } from '../AudioWorkletManager';
import { AUDIO_CONFIG } from '../constants';

// Mock AudioContext and AudioWorklet
class MockAudioContext {
  public audioWorklet = {
    addModule: jest.fn().mockResolvedValue(undefined)
  };
  public createMediaStreamSource = jest.fn().mockReturnValue({
    connect: jest.fn(),
    disconnect: jest.fn()
  });
  public sampleRate = AUDIO_CONFIG.SAMPLE_RATE;
  public state = 'running';
  public close = jest.fn().mockResolvedValue(undefined);
}

class MockAudioWorkletNode {
  public port = {
    postMessage: jest.fn(),
    onmessage: null as any,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  public connect = jest.fn();
  public disconnect = jest.fn();

  constructor(public context: any, public processorName: string) {}
}

// グローバルにモックを設定
(global as any).AudioContext = MockAudioContext;
(global as any).AudioWorkletNode = MockAudioWorkletNode;

describe('AudioWorkletManager', () => {
  let manager: AudioWorkletManager;
  let mockCallback: jest.Mock;

  beforeEach(() => {
    manager = new AudioWorkletManager();
    mockCallback = jest.fn();
  });

  afterEach(() => {
    if (manager) {
      manager.dispose();
    }
    jest.clearAllMocks();
  });

  describe('初期化', () => {
    it('AudioWorkletを初期化できる', async () => {
      const initialized = await manager.initialize();

      expect(initialized).toBe(true);
      expect(manager.isInitialized()).toBe(true);
    });

    it('AudioWorkletモジュールを読み込む', async () => {
      await manager.initialize();

      const context = manager.getContext();
      expect(context?.audioWorklet.addModule).toHaveBeenCalledWith(
        '/worklets/lipsync-processor.js'
      );
    });

    it('再初期化を防ぐ', async () => {
      await manager.initialize();
      const firstContext = manager.getContext();

      await manager.initialize();
      const secondContext = manager.getContext();

      expect(firstContext).toBe(secondContext);
    });
  });

  describe('音声入力処理', () => {
    it('マイク入力を開始できる', async () => {
      await manager.initialize();

      // MediaStreamをモック
      const mockStream = {
        getTracks: () => [{
          stop: jest.fn()
        }]
      } as any;

      // getUserMediaをモック
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockResolvedValue(mockStream)
        }
      });

      const started = await manager.startMicrophone(mockCallback);

      expect(started).toBe(true);
      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    });

    it('音声データを受信してコールバックを実行する', async () => {
      await manager.initialize();

      const mockStream = {
        getTracks: () => [{ stop: jest.fn() }]
      } as any;

      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockResolvedValue(mockStream)
        }
      });

      await manager.startMicrophone(mockCallback);

      // AudioWorkletからのメッセージをシミュレート
      const workletNode = manager.getWorkletNode();
      const mockData = {
        type: 'audioFeatures',
        data: {
          rms: 0.5,
          samples: new Float32Array(2048),
          timestamp: Date.now()
        }
      };

      // メッセージハンドラを実行
      if (workletNode?.port.onmessage) {
        workletNode.port.onmessage({ data: mockData } as MessageEvent);
      }

      expect(mockCallback).toHaveBeenCalledWith(mockData.data);
    });

    it('音声入力を停止できる', async () => {
      await manager.initialize();

      const mockTrack = { stop: jest.fn() };
      const mockStream = {
        getTracks: () => [mockTrack]
      } as any;

      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockResolvedValue(mockStream)
        }
      });

      await manager.startMicrophone(mockCallback);
      manager.stopMicrophone();

      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });

  describe('音声バッファ処理', () => {
    it('音声バッファを処理できる', async () => {
      await manager.initialize();

      const audioBuffer = new Float32Array(2048).fill(0.5);
      const processed = await manager.processBuffer(audioBuffer, mockCallback);

      expect(processed).toBe(true);

      // WorkletNodeへのメッセージ送信を確認
      const workletNode = manager.getWorkletNode();
      expect(workletNode?.port.postMessage).toHaveBeenCalledWith({
        type: 'processBuffer',
        buffer: audioBuffer
      });
    });

    it('未初期化時はバッファ処理を拒否する', async () => {
      const audioBuffer = new Float32Array(2048);
      const processed = await manager.processBuffer(audioBuffer, mockCallback);

      expect(processed).toBe(false);
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('パラメータ設定', () => {
    it('更新間隔を設定できる', async () => {
      await manager.initialize();

      manager.setUpdateInterval(256);

      const workletNode = manager.getWorkletNode();
      expect(workletNode?.port.postMessage).toHaveBeenCalledWith({
        type: 'setParameter',
        parameter: 'updateInterval',
        value: 256
      });
    });

    it('バッファサイズを設定できる', async () => {
      await manager.initialize();

      manager.setBufferSize(4096);

      const workletNode = manager.getWorkletNode();
      expect(workletNode?.port.postMessage).toHaveBeenCalledWith({
        type: 'setParameter',
        parameter: 'bufferSize',
        value: 4096
      });
    });

    it('ノイズゲートしきい値を設定できる', async () => {
      await manager.initialize();

      manager.setNoiseGate(0.01);

      const workletNode = manager.getWorkletNode();
      expect(workletNode?.port.postMessage).toHaveBeenCalledWith({
        type: 'setParameter',
        parameter: 'noiseGate',
        value: 0.01
      });
    });
  });

  describe('パフォーマンス監視', () => {
    it('処理レイテンシを測定できる', async () => {
      await manager.initialize();

      const mockStream = {
        getTracks: () => [{ stop: jest.fn() }]
      } as any;

      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockResolvedValue(mockStream)
        }
      });

      await manager.startMicrophone(mockCallback);

      // レイテンシデータを送信
      const workletNode = manager.getWorkletNode();
      if (workletNode?.port.onmessage) {
        workletNode.port.onmessage({
          data: {
            type: 'latency',
            value: 5.2
          }
        } as MessageEvent);
      }

      const latency = manager.getLatency();
      expect(latency).toBe(5.2);
    });

    it('CPU使用率を監視できる', async () => {
      await manager.initialize();

      // CPU使用率データを送信
      const workletNode = manager.getWorkletNode();
      if (workletNode?.port.onmessage) {
        workletNode.port.onmessage({
          data: {
            type: 'cpuUsage',
            value: 2.5
          }
        } as MessageEvent);
      }

      const cpuUsage = manager.getCPUUsage();
      expect(cpuUsage).toBe(2.5);
    });
  });

  describe('エラーハンドリング', () => {
    it('マイクアクセス拒否を処理する', async () => {
      await manager.initialize();

      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockRejectedValue(new Error('Permission denied'))
        }
      });

      const started = await manager.startMicrophone(mockCallback);

      expect(started).toBe(false);
    });

    it('AudioWorklet読み込みエラーを処理する', async () => {
      const context = new MockAudioContext();
      context.audioWorklet.addModule = jest.fn().mockRejectedValue(
        new Error('Failed to load worklet')
      );

      (global as any).AudioContext = jest.fn(() => context);

      const newManager = new AudioWorkletManager();
      const initialized = await newManager.initialize();

      expect(initialized).toBe(false);
      expect(newManager.isInitialized()).toBe(false);
    });
  });

  describe('リソース管理', () => {
    it('リソースを適切に解放する', async () => {
      // マネージャーを新しく作成
      const testManager = new AudioWorkletManager();

      // AudioContext をモック
      const mockContext = {
        audioWorklet: {
          addModule: jest.fn().mockResolvedValue(undefined)
        },
        createMediaStreamSource: jest.fn().mockReturnValue({
          connect: jest.fn(),
          disconnect: jest.fn()
        }),
        sampleRate: AUDIO_CONFIG.SAMPLE_RATE,
        state: 'running',
        close: jest.fn().mockResolvedValue(undefined)
      };

      const mockWorkletNode = {
        port: {
          postMessage: jest.fn(),
          onmessage: null
        },
        connect: jest.fn(),
        disconnect: jest.fn()
      };

      (global as any).AudioContext = jest.fn(() => mockContext);
      (global as any).AudioWorkletNode = jest.fn(() => mockWorkletNode);

      await testManager.initialize();

      const mockTrack = { stop: jest.fn() };
      const mockStream = {
        getTracks: jest.fn().mockReturnValue([mockTrack])
      };

      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        value: {
          getUserMedia: jest.fn().mockResolvedValue(mockStream)
        }
      });

      await testManager.startMicrophone(mockCallback);
      testManager.dispose();

      expect(mockStream.getTracks).toHaveBeenCalled();
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(mockWorkletNode.disconnect).toHaveBeenCalled();
      expect(mockContext.close).toHaveBeenCalled();
      expect(testManager.isInitialized()).toBe(false);

      // グローバルモックをリセット
      (global as any).AudioContext = MockAudioContext;
      (global as any).AudioWorkletNode = MockAudioWorkletNode;
    });

    it('破棄後は操作を受け付けない', async () => {
      await manager.initialize();
      manager.dispose();

      const audioBuffer = new Float32Array(2048);
      const processed = await manager.processBuffer(audioBuffer, mockCallback);

      expect(processed).toBe(false);
    });
  });
});