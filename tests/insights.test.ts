// Mock getElement to return fake DOM elements
vi.mock('../src/helpers/shared', () => ({
	getElement: vi.fn(() => document.createElement('div'))
}));

import { recordObservation, clearObservations } from '../src/features/insights';

// Tests for insights.ts
// - recordObservation(): logs pitch + posture data to rolling observation window
// - clearObservations(): resets observation state for test isolation
// Note: analyzeCorrelations() is internal and tested indirectly through updateInsightsUI

describe('Insights Correlation Engine', () =>
{
	beforeEach(() => {
		// Clear observations & reset state before each test
		clearObservations();
	});

	describe('recordObservation', () =>
	{
		it('should not throw when recording valid observation', () => {
			const pitch = { name: 'A', octave: 4, cents: 0 };
			const posture = { wristCollapsed: false, shoulderRaised: false, violinDrooping: false };
			expect(() => recordObservation(pitch, 5, posture)).not.toThrow();
		});
		it('should handle null pitch', () => {
			const posture = { wristCollapsed: false, shoulderRaised: false, violinDrooping: false };
			expect(() => recordObservation(null, 5, posture)).not.toThrow();
		});
	});
});


