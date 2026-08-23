import { NoteStats, NoteAccuracyData } from '../types';
import { getElement } from '../shared';

// Functions in this file:
//	 - loadAccuracyData() - exported, loads accuracy data from localStorage
//	 - saveAccuracyData() - exported, saves accuracy data to localStorage
//	 - clearAccuracyData() - exported, clears accuracy data and updates UI
//	 - recordPitchAccuracy() - exported, records a pitch reading for a note
//	 - getNoteStats() - exported, returns stats for notes with enough samples
//	 - updateStatsUI() - exported, updates the stats panel in the DOM

// ---------- Constants ----------
const CENTS_IN_TUNE = 10;
const ACCURACY_STORAGE_KEY = 'resonance_note_accuracy';

// ---------- State ----------
let noteAccuracyData: NoteAccuracyData = {};
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

// ---------- DOM Elements ----------
const noteGrid = getElement<HTMLDivElement>('note-grid');
const statAccuracy = getElement<HTMLDivElement>('stat-accuracy');
const statAvgCents = getElement<HTMLDivElement>('stat-avg-cents');
const statTotal = getElement<HTMLDivElement>('stat-total');
const problemList = getElement<HTMLDivElement>('problem-list');
const statsClear = getElement<HTMLButtonElement>('stats-clear');

// ---------- Data Functions ----------
export function loadAccuracyData(): void {
	try {
		const stored = localStorage.getItem(ACCURACY_STORAGE_KEY);
		if (stored) {
			noteAccuracyData = JSON.parse(stored);
		}
	} catch (e) {
		console.warn('Could not load accuracy data:', e);
	}
}

export function saveAccuracyData(): void {
	try {
		localStorage.setItem(ACCURACY_STORAGE_KEY, JSON.stringify(noteAccuracyData));
	} catch (e) {
		console.warn('Could not save accuracy data:', e);
	}
}

export function clearAccuracyData(): void {
	noteAccuracyData = {};
	saveAccuracyData();
	updateStatsUI();
}

export function recordPitchAccuracy(noteName: string, octave: number, cents: number): void {
	const key = noteName + octave;
	if (!noteAccuracyData[key]) {
		noteAccuracyData[key] = { samples: [] };
	}
	if (noteAccuracyData[key].samples.length >= 500) {
		noteAccuracyData[key].samples.shift();
	}
	noteAccuracyData[key].samples.push({
		cents,
		timestamp: Date.now()
	});
	if (!saveTimeout) {
		saveTimeout = setTimeout(() => {
			saveAccuracyData();
			saveTimeout = null;
		}, 2000);
	}
}

export function getNoteStats(): NoteStats[] {
	const noteStats: NoteStats[] = Object.entries(noteAccuracyData)
		.filter(([, d]) => d.samples.length >= 5)
		.map(([note, d]) => {
			const avg = d.samples.reduce((s, x) => s + Math.abs(x.cents), 0) / d.samples.length;
			const bias = d.samples.reduce((s, x) => s + x.cents, 0) / d.samples.length;
			return { note, avg, bias, count: d.samples.length };
		})
		.filter(x => x.avg > 10)
		.sort((a, b) => b.avg - a.avg)
		.slice(0, 3);

	return noteStats;
}

// ---------- UI Functions ----------
export function updateStatsUI(): void {
	const relevantNotes: string[] = [];
	const noteOrder = ['G', 'G#', 'A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#'];
	for (let oct = 3; oct <= 5; oct++) {
		for (const n of noteOrder) {
			if (oct === 3 && noteOrder.indexOf(n) < noteOrder.indexOf('G')) continue;
			if (oct === 5 && noteOrder.indexOf(n) > noteOrder.indexOf('E')) continue;
			relevantNotes.push(n + oct);
		}
	}
	relevantNotes.push('E6');

	noteGrid.innerHTML = '';
	let totalSamples = 0;
	let totalInTune = 0;
	let totalCentsSum = 0;

	for (const noteKey of relevantNotes) {
		const cell = document.createElement('div');
		cell.className = 'note-cell';

		const data = noteAccuracyData[noteKey];
		const noteName = noteKey.replace(/\d/, '');
		const isSharp = noteName.includes('#');

		cell.innerHTML = `<span class="note-name">${isSharp ? noteName[0] + '♯' : noteName}</span>`;

		if (data && data.samples.length > 0) {
			const samples = data.samples;
			const avgCents = samples.reduce((s, x) => s + Math.abs(x.cents), 0) / samples.length;
			const inTuneCount = samples.filter(x => Math.abs(x.cents) < CENTS_IN_TUNE).length;

			totalSamples += samples.length;
			totalInTune += inTuneCount;
			totalCentsSum += samples.reduce((s, x) => s + Math.abs(x.cents), 0);

			cell.innerHTML += `<span class="note-count">${samples.length}</span>`;

			if (avgCents < 8) {
				cell.classList.add('accurate');
			} else if (avgCents < 18) {
				cell.classList.add('close');
			} else {
				cell.classList.add('off');
			}
		} else {
			cell.classList.add('no-data');
		}

		noteGrid.appendChild(cell);
	}

	if (totalSamples > 0) {
		const overallAccuracy = Math.round(totalInTune / totalSamples * 100);
		const avgOffset = Math.round(totalCentsSum / totalSamples);
		statAccuracy.textContent = overallAccuracy + '%';
		statAvgCents.textContent = avgOffset + '¢';
		statTotal.textContent = String(totalSamples);
	} else {
		statAccuracy.textContent = '—';
		statAvgCents.textContent = '—';
		statTotal.textContent = '0';
	}

	const noteStats = getNoteStats();

	if (noteStats.length > 0) {
		problemList.innerHTML = noteStats.map(({ note, avg, bias }) => {
			const dir = bias > 3 ? 'sharp' : bias < -3 ? 'flat' : 'inconsistent';
			return `<div class="problem-item">
				<span class="note">${note}</span>
				<span class="detail">${Math.round(avg)}¢ avg, tends ${dir}</span>
			</div>`;
		}).join('');
	} else if (totalSamples > 20) {
		problemList.innerHTML = '<div style="font-size: 12px; color: var(--green);">All notes looking good!</div>';
	} else {
		problemList.innerHTML = '<div style="font-size: 12px; color: var(--ink-faint); font-style: italic;">Play more to identify problem areas...</div>';
	}
}

// ---------- Event Listeners ----------
statsClear.onclick = () => {
	if (confirm('Clear all accuracy data?')) {
		clearAccuracyData();
	}
};
