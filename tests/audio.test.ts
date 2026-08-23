import { freqToNote, noteToFreq } from '../src/features/audio';

// Tests for audio.ts
// - freqToNote(): converts frequency (Hz) to note info (name, octave, cents deviation)
// - noteToFreq(): converts note name (e.g., "A4") to frequency in Hz
// Both functions accept optional a4 calibration parameter (default 440Hz)
describe('freqToNote', () => {
	it('returns A4 for 440Hz', () => {
		const result = freqToNote(440, 440);
		expect(result.name).toBe('A');
		expect(result.octave).toBe(4);
		expect(result.cents).toBeCloseTo(0, 1);
	});

});

// Test noteToFreq function
describe('noteToFreq', () => {
	it('returns 440Hz for A4', () => {
		const result = noteToFreq('A4', 440);
		expect(result).toBeCloseTo(440, 1);
	});
});