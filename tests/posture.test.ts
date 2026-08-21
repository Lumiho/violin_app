// Mock getElement to return fake DOM elements
vi.mock('../src/helpers/shared', () => ({
	getElement: vi.fn(() => document.createElement('div'))
}));

import { analyzePosture } from '../src/helpers/posture';

// Tests for posture.ts
// - analyzePosture(): detects shoulder raise, wrist collapse, and violin droop from landmarks
// - Uses POSE indices for body landmarks and HAND indices for hand landmarks

describe('Posture Analysis', () => {
	describe('analyzePosture', () => {
		it('should return all false flags when no landmarks provided', () => {
			const result = analyzePosture(undefined, undefined);
			expect(result.shoulderRaised).toBe(false);
			expect(result.wristCollapsed).toBe(false);
			expect(result.violinDrooping).toBe(false);
		});

		it('should return all false flags for empty landmark arrays', () => {
			const result = analyzePosture([], []);
			expect(result.shoulderRaised).toBe(false);
			expect(result.wristCollapsed).toBe(false);
			expect(result.violinDrooping).toBe(false);
		});

		it('should detect raised shoulder when shoulder diff > 0.04', () => {
			// Create mock pose landmarks with raised left shoulder
			const poseLandmarks = [Array(33).fill({ x: 0, y: 0.5, z: 0 })];
			// LEFT_SHOULDER = 11, RIGHT_SHOULDER = 12, LEFT_EAR = 7
			poseLandmarks[0]![11] = { x: 0.3, y: 0.4, z: 0 };  // left shoulder
			poseLandmarks[0]![12] = { x: 0.6, y: 0.5, z: 0 };  // right shoulder (higher y = lower)
			poseLandmarks[0]![7] = { x: 0.3, y: 0.2, z: 0 };   // left ear

			const result = analyzePosture(poseLandmarks, undefined);
			expect(result.shoulderRaised).toBe(true);
		});

		it('should detect violin drooping when elbow drop > 0.15', () => {
			const poseLandmarks = [Array(33).fill({ x: 0, y: 0.5, z: 0 })];
			// LEFT_SHOULDER = 11, LEFT_ELBOW = 13
			poseLandmarks[0]![11] = { x: 0.3, y: 0.3, z: 0 };  // left shoulder
			poseLandmarks[0]![12] = { x: 0.6, y: 0.3, z: 0 };  // right shoulder
			poseLandmarks[0]![7] = { x: 0.3, y: 0.1, z: 0 };   // left ear
			poseLandmarks[0]![13] = { x: 0.2, y: 0.5, z: 0 };  // left elbow (dropped)

			const result = analyzePosture(poseLandmarks, undefined);
			expect(result.violinDrooping).toBe(true);
		});

		it('should detect collapsed wrist', () => {
			const handLandmarks = [Array(21).fill({ x: 0.5, y: 0.5, z: 0 })];
			// WRIST = 0, INDEX_MCP = 5, PINKY_MCP = 17, MIDDLE_MCP = 9
			handLandmarks[0]![0] = { x: 0.5, y: 0.5, z: 0 };   // wrist
			handLandmarks[0]![5] = { x: 0.51, y: 0.48, z: 0 }; // index mcp
			handLandmarks[0]![17] = { x: 0.52, y: 0.48, z: 0 };// pinky mcp (close spread)
			handLandmarks[0]![9] = { x: 0.5, y: 0.48, z: 0 };  // middle mcp

			const result = analyzePosture(undefined, handLandmarks);
			expect(result.wristCollapsed).toBe(true);
		});
	});
});
