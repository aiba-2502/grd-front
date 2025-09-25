/**
 * NaturalMotionController Test Suite
 * Live2Dの自然なモーション制御のテスト
 */

import { NaturalMotionController } from '../NaturalMotionController';

describe('NaturalMotionController', () => {
  let controller: NaturalMotionController;

  beforeEach(() => {
    // Mock browser APIs for Jest environment
    global.requestAnimationFrame = jest.fn((callback) => {
      return setTimeout(callback, 16) as any; // ~60fps
    });
    global.cancelAnimationFrame = jest.fn((id) => {
      clearTimeout(id);
    });
    global.performance = {
      now: jest.fn(() => Date.now()),
    } as any;

    controller = new NaturalMotionController();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Phase 1: Performance Optimization', () => {
    describe('Frame Rate Control', () => {
      it('should maintain 60 FPS target frame rate', () => {
        const targetFPS = 60;
        const targetFrameTime = 1000 / targetFPS;

        expect(controller.getTargetFPS()).toBe(60);
        expect(controller.getTargetFrameTime()).toBe(targetFrameTime);
      });

      it('should calculate current FPS correctly', () => {
        // Simulate 60 FPS
        const frameTime = 1000 / 60;
        for (let i = 0; i < 60; i++) {
          controller.updateFPS(i * frameTime);
        }

        expect(controller.getCurrentFPS()).toBeCloseTo(60, 1);
      });

      it('should handle frame skipping when behind schedule', () => {
        const targetFrameTime = controller.getTargetFrameTime();

        // Simulate lag (3 frames behind)
        const lagTime = targetFrameTime * 3.5;
        const shouldSkip = controller.shouldSkipFrame(lagTime);

        expect(shouldSkip).toBe(true);
      });

      it('should not skip frames when on schedule', () => {
        const targetFrameTime = controller.getTargetFrameTime();

        // Simulate normal frame time
        const normalTime = targetFrameTime * 0.9;
        const shouldSkip = controller.shouldSkipFrame(normalTime);

        expect(shouldSkip).toBe(false);
      });
    });

    describe('Render Loop Optimization', () => {
      it('should use optimized render timing', () => {
        const renderSpy = jest.fn();
        controller.setRenderCallback(renderSpy);

        controller.startRendering();

        // Advance time by 100ms (should render 5-6 frames at 60 FPS)
        jest.advanceTimersByTime(100);

        // At 60 FPS, we expect around 6 frames in 100ms
        // But with timing precision, 5-6 frames is acceptable
        const callCount = renderSpy.mock.calls.length;
        expect(callCount).toBeGreaterThanOrEqual(5);
        expect(callCount).toBeLessThanOrEqual(7);
      });

      it('should stop rendering when requested', () => {
        const renderSpy = jest.fn();
        controller.setRenderCallback(renderSpy);

        controller.startRendering();
        jest.advanceTimersByTime(50);

        controller.stopRendering();
        renderSpy.mockClear();

        jest.advanceTimersByTime(50);
        expect(renderSpy).not.toHaveBeenCalled();
      });
    });
  });

  describe('Phase 2: Natural Motion', () => {
    describe('Smoothing', () => {
      it('should apply smoothing to motion', () => {
        const targetX = 1.0;
        const targetY = 0.5;

        const smoothed = controller.applySmooting(0, 0, targetX, targetY);

        // Should not reach target immediately
        expect(smoothed.x).toBeLessThan(targetX);
        expect(smoothed.y).toBeLessThan(targetY);

        // Should be moving towards target
        expect(smoothed.x).toBeGreaterThan(0);
        expect(smoothed.y).toBeGreaterThan(0);
      });

      it('should use configurable smoothing factor', () => {
        const factor1 = 0.05;
        const factor2 = 0.15;

        controller.setSmoothingFactor(factor1);
        const smooth1 = controller.applySmooting(0, 0, 1, 1);

        controller.setSmoothingFactor(factor2);
        const smooth2 = controller.applySmooting(0, 0, 1, 1);

        // Higher factor should move faster
        expect(smooth2.x).toBeGreaterThan(smooth1.x);
        expect(smooth2.y).toBeGreaterThan(smooth1.y);
      });
    });

    describe('Acceleration-based Motion', () => {
      it('should apply acceleration to movement', () => {
        controller.resetMotion();

        // First update
        const motion1 = controller.updateMotionWithAcceleration(1, 1);

        // Second update (should have more speed)
        const motion2 = controller.updateMotionWithAcceleration(1, 1);

        expect(motion2.speedX).toBeGreaterThan(motion1.speedX);
        expect(motion2.speedY).toBeGreaterThan(motion1.speedY);
      });

      it('should respect maximum speed limit', () => {
        controller.resetMotion();
        const maxSpeed = controller.getMaxSpeed();

        // Apply many updates to reach max speed
        for (let i = 0; i < 100; i++) {
          controller.updateMotionWithAcceleration(1, 1);
        }

        const motion = controller.getCurrentMotion();
        expect(motion.speedX).toBeLessThanOrEqual(maxSpeed);
        expect(motion.speedY).toBeLessThanOrEqual(maxSpeed);
      });

      it('should decelerate when target is reached', () => {
        controller.resetMotion();

        // Move to target
        for (let i = 0; i < 10; i++) {
          controller.updateMotionWithAcceleration(1, 1);
        }
        const speedBefore = controller.getCurrentMotion().speedX;

        // Move to position where delta becomes small (near target)
        const motion = controller.getCurrentMotion();
        controller.updateMotionWithAcceleration(motion.x, motion.y);

        // Now apply multiple updates with very small delta to trigger deceleration
        for (let i = 0; i < 5; i++) {
          const currentMotion = controller.getCurrentMotion();
          controller.updateMotionWithAcceleration(currentMotion.x + 0.001, currentMotion.y + 0.001);
        }
        const speedAfter = controller.getCurrentMotion().speedX;

        // Speed should have decreased due to deceleration
        expect(speedAfter).toBeLessThan(speedBefore);
      });
    });

    describe('Body Motion', () => {
      it('should enable body following with reduced ratio', () => {
        const bodyMotion = controller.calculateBodyMotion(1.0, 0.5);

        // Body should follow but with reduced movement
        expect(bodyMotion.x).toBeLessThan(1.0);
        expect(bodyMotion.y).toBeLessThan(0.5);

        // Default ratio should be 3 (as per plan)
        expect(bodyMotion.x).toBeCloseTo(1.0 * 3 / 10, 2);
        expect(bodyMotion.y).toBeCloseTo(0.5 * 3 / 10, 2);
      });

      it('should allow configurable body follow ratio', () => {
        controller.setBodyFollowRatio(5, 5, -2);

        const bodyMotion = controller.calculateBodyMotion(1.0, 0.5);

        expect(bodyMotion.x).toBeCloseTo(1.0 * 5 / 10, 2);
        expect(bodyMotion.y).toBeCloseTo(0.5 * 5 / 10, 2);
        expect(bodyMotion.z).toBeCloseTo(1.0 * 0.5 * -2 / 10, 2);
      });
    });
  });

  describe('Phase 3: Initial Gaze Fix', () => {
    it('should reset gaze to center on initialization', () => {
      controller.initializeGaze();

      const gaze = controller.getCurrentGaze();

      expect(gaze.x).toBe(0);
      expect(gaze.y).toBe(0);
      expect(gaze.speedX).toBe(0);
      expect(gaze.speedY).toBe(0);
    });

    it('should reset mouse position on model load', () => {
      controller.onModelLoad();

      const position = controller.getMousePosition();

      expect(position.x).toBe(0);
      expect(position.y).toBe(0);
    });
  });

  describe('Phase 4: Idle Micro-movements', () => {
    it('should generate idle movements', () => {
      const time1 = 1000;
      const time2 = 2000;

      const idle1 = controller.calculateIdleMovement(time1);
      const idle2 = controller.calculateIdleMovement(time2);

      // Should produce different values at different times
      expect(idle1.x).not.toBe(idle2.x);
      expect(idle1.y).not.toBe(idle2.y);

      // Should be small movements
      expect(Math.abs(idle1.x)).toBeLessThan(0.1);
      expect(Math.abs(idle1.y)).toBeLessThan(0.1);
    });

    it('should apply idle movements when not actively moving', () => {
      controller.setIdleMode(true);
      controller.setCurrentDrag(0, 0); // Not moving

      const movement = controller.calculateCombinedMovement(Date.now());

      // Should have some idle movement
      expect(movement.x).not.toBe(0);
      expect(movement.y).not.toBe(0);

      // Should be small
      expect(Math.abs(movement.x)).toBeLessThan(0.1);
      expect(Math.abs(movement.y)).toBeLessThan(0.1);
    });

    it('should not apply idle movements when actively moving', () => {
      controller.setIdleMode(true);
      controller.setCurrentDrag(0.5, 0.5); // Actively moving

      const movement = controller.calculateCombinedMovement(Date.now());

      // Should not add idle movement to active movement
      expect(movement.x).toBeCloseTo(0.5, 1);
      expect(movement.y).toBeCloseTo(0.5, 1);
    });

    it('should randomize blink intervals', () => {
      const intervals: number[] = [];

      for (let i = 0; i < 10; i++) {
        intervals.push(controller.getNextBlinkInterval());
      }

      // All should be within range (2-6 seconds)
      intervals.forEach(interval => {
        expect(interval).toBeGreaterThanOrEqual(2000);
        expect(interval).toBeLessThanOrEqual(6000);
      });

      // Should have variation
      const uniqueIntervals = new Set(intervals);
      expect(uniqueIntervals.size).toBeGreaterThan(1);
    });
  });

  describe('Configuration', () => {
    it('should allow configuration of motion parameters', () => {
      const config = {
        smoothingFactor: 0.1,
        acceleration: 0.03,
        maxSpeed: 0.2,
        bodyFollowRatioX: 4,
        bodyFollowRatioY: 4,
        bodyFollowRatioZ: -2,
        idleAmplitudeX: 0.03,
        idleAmplitudeY: 0.03,
        idleFrequencyX: 0.5,
        idleFrequencyY: 0.3,
        blinkIntervalMin: 3000,
        blinkIntervalMax: 7000,
        breathAmplitude: 0.5,
        breathSpeed: 3.5
      };

      controller.setConfig(config);
      const currentConfig = controller.getConfig();

      expect(currentConfig).toEqual(config);
    });

    it('should use default configuration if not set', () => {
      const config = controller.getConfig();

      expect(config.smoothingFactor).toBe(0.08);
      expect(config.acceleration).toBe(0.02);
      expect(config.maxSpeed).toBe(0.15);
      expect(config.bodyFollowRatioX).toBe(3);
      expect(config.bodyFollowRatioY).toBe(3);
      expect(config.bodyFollowRatioZ).toBe(-1.5);
    });
  });

  describe('Integration', () => {
    it('should integrate with render loop for smooth animation', () => {
      const positions: Array<{x: number, y: number}> = [];

      controller.setRenderCallback(() => {
        const motion = controller.getCurrentMotion();
        positions.push({ x: motion.x, y: motion.y });
      });

      controller.startRendering();
      controller.setTargetPosition(1, 1);

      // Simulate 500ms of animation
      jest.advanceTimersByTime(500);

      controller.stopRendering();

      // Should have smooth progression
      expect(positions.length).toBeGreaterThan(0);

      // Check for smooth interpolation
      for (let i = 1; i < positions.length; i++) {
        const delta = {
          x: positions[i].x - positions[i-1].x,
          y: positions[i].y - positions[i-1].y
        };

        // Movement should be gradual
        expect(Math.abs(delta.x)).toBeLessThan(0.1);
        expect(Math.abs(delta.y)).toBeLessThan(0.1);
      }
    });
  });
});