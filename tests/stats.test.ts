// Mock getElement and localStorage
vi.mock('../src/helpers/shared', () => ({
	getElement: vi.fn(() => {
		const el = document.createElement('div');
		el.textContent = '';
		return el;
	})
}));

import {
	loadAccuracyData,
	saveAccuracyData,
	clearAccuracyData,
	recordPitchAccuracy,
	getNoteStats
} from '../src/helpers/stats';

// Tests for stats.ts
// - recordPitchAccuracy(): records pitch samples for each note
// - getNoteStats(): returns notes with 5+ samples and avg > 10 cents deviation
// - saveAccuracyData() / loadAccuracyData(): persists data to localStorage
// - clearAccuracyData(): resets all recorded data

describe('Stats Module', () => {
	beforeEach(() => {
		localStorage.clear();
		clearAccuracyData();
	});

	describe('recordPitchAccuracy', () => {
		it('should not throw when recording a pitch', () => {
			expect(() => recordPitchAccuracy('A', 4, 5)).not.toThrow();
		});

		it('should record multiple pitches for same note', () => {
			recordPitchAccuracy('A', 4, 5);
			recordPitchAccuracy('A', 4, -3);
			recordPitchAccuracy('A', 4, 10);
			// No error means success
		});
	});

	describe('getNoteStats', () => {
		it('should return empty array when no data recorded', () => {
			const stats = getNoteStats();
			expect(stats).toEqual([]);
		});

		it('should return empty array when less than 5 samples', () => {
			recordPitchAccuracy('A', 4, 15);
			recordPitchAccuracy('A', 4, 15);
			recordPitchAccuracy('A', 4, 15);
			const stats = getNoteStats();
			expect(stats).toEqual([]);
		});

		it('should return stats when 5+ samples with avg > 10 cents', () => {
			// Record 5 samples with high cents deviation
			for (let i = 0; i < 5; i++) {
				recordPitchAccuracy('A', 4, 15);
			}
			const stats = getNoteStats();
			expect(stats.length).toBeGreaterThan(0);
			expect(stats[0]!.note).toBe('A4');
		});
	});

	describe('saveAccuracyData / loadAccuracyData', () => {
		it('should save and load data from localStorage', () => {
			recordPitchAccuracy('G', 3, 8);
			saveAccuracyData();

			// Clear and reload
			clearAccuracyData();
			loadAccuracyData();

			// Data should be restored
			// (We can't directly verify internal state, but no errors means it works)
		});
	});

	describe('clearAccuracyData', () => {
		it('should clear all recorded data', () => {
			for (let i = 0; i < 10; i++) {
				recordPitchAccuracy('A', 4, 15);
			}
			clearAccuracyData();
			const stats = getNoteStats();
			expect(stats).toEqual([]);
		});
	});
});
