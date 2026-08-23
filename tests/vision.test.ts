// Mock all dependencies that vision.ts needs
vi.mock('../src/helpers/shared', () => ({
	getElement: vi.fn((id: string) => {
		if (id === 'overlay') {
			// Return a mock canvas with getContext
			const canvas = document.createElement('canvas');
			(canvas as any).getContext = vi.fn(() => ({
				clearRect: vi.fn(),
				fillStyle: '',
				beginPath: vi.fn(),
				arc: vi.fn(),
				fill: vi.fn()
			}));
			return canvas;
		}
		if (id === 'video') {
			const video = document.createElement('video');
			return video;
		}
		return document.createElement('div');
	})
}));

vi.mock('../src/helpers/posture', () => ({
	analyzePosture: vi.fn(() => ({
		shoulderRaised: false,
		wristCollapsed: false,
		violinDrooping: false
	})),
	updatePostureUI: vi.fn()
}));

vi.mock('../src/helpers/insights', () => ({
	recordObservation: vi.fn(),
	updateInsightsUI: vi.fn()
}));

vi.mock('../src/helpers/audio', () => ({
	freqToNote: vi.fn(() => ({ name: 'A', octave: 4, cents: 0 }))
}));

vi.mock('@mediapipe/tasks-vision', () => ({
	PoseLandmarker: {
		createFromOptions: vi.fn()
	},
	HandLandmarker: {
		createFromOptions: vi.fn(),
		HAND_CONNECTIONS: []
	},
	FilesetResolver: {
		forVisionTasks: vi.fn()
	},
	DrawingUtils: vi.fn(() => ({
		drawConnectors: vi.fn(),
		drawLandmarks: vi.fn()
	}))
}));

import { isVisionRunning, setVisionCallbacks } from '../src/features/vision';

// Tests for vision.ts
// - isVisionRunning(): returns current vision loop state
// - setVisionCallbacks(): accepts callbacks for phase and pitch data from main.ts
// Note: MediaPipe initialization and camera functions are mocked due to external dependencies

describe('Vision Module', () => {
	describe('isVisionRunning', () => {
		it('should return false initially', () => {
			expect(isVisionRunning()).toBe(false);
		});
	});

	describe('setVisionCallbacks', () => {
		it('should accept callback functions', () => {
			const phaseGetter = () => 'pitch';
			const pitchGetter = () => ({
				hasPitch: false,
				lastPitch: 0,
				lastCents: 0,
				a4: 440
			});

			expect(() => setVisionCallbacks(phaseGetter, pitchGetter)).not.toThrow();
		});
	});
});
