// Scale definitions and utilities for scale trainer

export interface ScaleNote {
	note: string;      // e.g., "G", "A", "Bb"
	octave: number;
	string: string;    // "G" | "D" | "A" | "E"
	position: number;  // 0-4 (open, 1st finger, 2nd, 3rd, 4th)
}

export interface Scale {
	name: string;
	notes: ScaleNote[];
}

// Common violin scales (1 octave, first position)
export const SCALES: Record<string, Scale> = {
	'G-major': {
		name: 'G Major',
		notes: [
			{ note: 'G', octave: 3, string: 'G', position: 0 },
			{ note: 'A', octave: 3, string: 'G', position: 1 },
			{ note: 'B', octave: 3, string: 'G', position: 2 },
			{ note: 'C', octave: 4, string: 'G', position: 3 },
			{ note: 'D', octave: 4, string: 'D', position: 0 },
			{ note: 'E', octave: 4, string: 'D', position: 1 },
			{ note: 'F#', octave: 4, string: 'D', position: 2 },
			{ note: 'G', octave: 4, string: 'D', position: 3 },
		]
	},
	'D-major': {
		name: 'D Major',
		notes: [
			{ note: 'D', octave: 4, string: 'D', position: 0 },
			{ note: 'E', octave: 4, string: 'D', position: 1 },
			{ note: 'F#', octave: 4, string: 'D', position: 2 },
			{ note: 'G', octave: 4, string: 'D', position: 3 },
			{ note: 'A', octave: 4, string: 'A', position: 0 },
			{ note: 'B', octave: 4, string: 'A', position: 1 },
			{ note: 'C#', octave: 5, string: 'A', position: 2 },
			{ note: 'D', octave: 5, string: 'A', position: 3 },
		]
	},
	'A-major': {
		name: 'A Major',
		notes: [
			{ note: 'A', octave: 4, string: 'A', position: 0 },
			{ note: 'B', octave: 4, string: 'A', position: 1 },
			{ note: 'C#', octave: 5, string: 'A', position: 2 },
			{ note: 'D', octave: 5, string: 'A', position: 3 },
			{ note: 'E', octave: 5, string: 'E', position: 0 },
			{ note: 'F#', octave: 5, string: 'E', position: 1 },
			{ note: 'G#', octave: 5, string: 'E', position: 2 },
			{ note: 'A', octave: 5, string: 'E', position: 3 },
		]
	},
	'A-minor': {
		name: 'A Minor (Natural)',
		notes: [
			{ note: 'A', octave: 3, string: 'G', position: 1 },
			{ note: 'B', octave: 3, string: 'G', position: 2 },
			{ note: 'C', octave: 4, string: 'G', position: 3 },
			{ note: 'D', octave: 4, string: 'D', position: 0 },
			{ note: 'E', octave: 4, string: 'D', position: 1 },
			{ note: 'F', octave: 4, string: 'D', position: 2 },
			{ note: 'G', octave: 4, string: 'D', position: 3 },
			{ note: 'A', octave: 4, string: 'A', position: 0 },
		]
	},
	'E-minor': {
		name: 'E Minor (Natural)',
		notes: [
			{ note: 'E', octave: 4, string: 'D', position: 1 },
			{ note: 'F#', octave: 4, string: 'D', position: 2 },
			{ note: 'G', octave: 4, string: 'D', position: 3 },
			{ note: 'A', octave: 4, string: 'A', position: 0 },
			{ note: 'B', octave: 4, string: 'A', position: 1 },
			{ note: 'C', octave: 5, string: 'A', position: 2 },
			{ note: 'D', octave: 5, string: 'A', position: 3 },
			{ note: 'E', octave: 5, string: 'E', position: 0 },
		]
	},
};

// State
let currentScale: Scale | null = null;
let currentNoteIndex = 0;
let completedNotes: Set<number> = new Set();

export function getAvailableScales(): { id: string; name: string }[] {
	return Object.entries(SCALES).map(([id, scale]) => ({
		id,
		name: scale.name
	}));
}

export function startScale(scaleId: string): Scale | null {
	const scale = SCALES[scaleId];
	if (!scale) return null;

	currentScale = scale;
	currentNoteIndex = 0;
	completedNotes.clear();
	return scale;
}

export function stopScale(): void {
	currentScale = null;
	currentNoteIndex = 0;
	completedNotes.clear();
}

export function getCurrentScale(): Scale | null {
	return currentScale;
}

export function getCurrentTargetNote(): ScaleNote | null {
	if (!currentScale) return null;
	return currentScale.notes[currentNoteIndex] || null;
}

export function markNoteCompleted(): ScaleNote | null {
	if (!currentScale) return null;

	completedNotes.add(currentNoteIndex);
	currentNoteIndex++;

	if (currentNoteIndex >= currentScale.notes.length) {
		// Scale completed - loop back or stop
		return null;
	}

	return currentScale.notes[currentNoteIndex] ?? null;
}

export function getCompletedNotes(): Set<number> {
	return completedNotes;
}

export function getCurrentNoteIndex(): number {
	return currentNoteIndex;
}

export function isScaleComplete(): boolean {
	return currentScale !== null && currentNoteIndex >= currentScale.notes.length;
}

export function resetScale(): void {
	currentNoteIndex = 0;
	completedNotes.clear();
}
