import { NoteInfo } from '../types';

// Functions in this file:
// - freqToNote() - exported, converts frequency to note info
// - noteToFreq() - exported, converts note name to frequency

// Note names in chromatic order (C = 0 in MIDI mod 12)
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Convert frequency to note info (name, octave, cents deviation)
export function freqToNote(freq: number, a4: number = 440): NoteInfo {
	const midi = 69 + 12 * Math.log2(freq / a4);
	const nearest = Math.round(midi);

	// MIDI standard - C0 is 12, C1 is 24, etc
	const name = NOTE_NAMES[(nearest % 12 + 12) % 12] ?? 'A';
	const octave = Math.floor(nearest / 12) - 1;
	const cents = (midi - nearest) * 100;

	return { name, octave, cents };
}

// Convert note name (e.g., "A4", "G#3") to frequency
export function noteToFreq(noteName: string, a4: number = 440): number {
	const noteMap: Record<string, number> = {
		'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
		'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
		'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
	};
	const match = noteName.match(/^([A-G][#b]?)(\d)$/);
	if (!match || !match[1] || !match[2]) return a4;
	const note = match[1];
	const octave = parseInt(match[2]);
	const semitones = (noteMap[note] ?? 0) + (octave - 4) * 12 - 9;
	return a4 * Math.pow(2, semitones / 12);
}
