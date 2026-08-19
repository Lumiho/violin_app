import './styles.css';
import { PitchDetector } from 'pitchy';
import { PoseLandmarker, HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import {
  NoteInfo, NoteStats, PitchReading, PostureFlags, Observation,
  Insight, NoteAccuracyData, FingerPosition, DroneOscillator, Landmark
} from './types'

// ---------- accuracy thresholds (cents) ----------
const CENTS_PERFECT = 5;    // Perfect intonation (green glow)
const CENTS_IN_TUNE = 10;   // Acceptable intonation
const CENTS_CLOSE = 18;     // Close but needs work (amber)
// Above CENTS_CLOSE = off/red

// ---------- Helper to get elements with null checks ----------
function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

function getElements<T extends HTMLElement>(selector: string): T[] {
  return [...document.querySelectorAll<T>(selector)];
}

// ---------- elements ----------
const canvas = getElement<HTMLCanvasElement>('meter');
const ctx = canvas.getContext('2d')!;
const noteEl = getElement<HTMLDivElement>('note');
const centsEl = getElement<HTMLDivElement>('cents');
const freqEl = getElement<HTMLDivElement>('freq');
const readout = getElement<HTMLDivElement>('readout');
const toggle = getElement<HTMLButtonElement>('toggle');
const hint = getElement<HTMLParagraphElement>('hint');
const aVal = getElement<HTMLSpanElement>('a-val');
const strings = getElements<HTMLSpanElement>('#strings .tag');

// Phase 2 elements
const cameraPanel = getElement<HTMLDivElement>('camera-panel');
const video = getElement<HTMLVideoElement>('video');
const overlayCanvas = getElement<HTMLCanvasElement>('overlay');
const overlayCtx = overlayCanvas.getContext('2d')!;
const postureFlags = getElement<HTMLDivElement>('posture-flags');
const flagShoulder = getElement<HTMLSpanElement>('flag-shoulder');
const flagWrist = getElement<HTMLSpanElement>('flag-wrist');
const flagViolin = getElement<HTMLSpanElement>('flag-violin');
const meterShell = getElement<HTMLDivElement>('meter-shell');

// Insights elements (shown on posture tab)
const insightsPanel = getElement<HTMLDivElement>('insights-panel');
const insightMain = getElement<HTMLDivElement>('insight-main');

// Phase tabs
const phaseTabs = getElements<HTMLButtonElement>('.phase-tab');

// Stats elements
const statsPanel = getElement<HTMLDivElement>('stats-panel');
const noteGrid = getElement<HTMLDivElement>('note-grid');
const statAccuracy = getElement<HTMLDivElement>('stat-accuracy');
const statAvgCents = getElement<HTMLDivElement>('stat-avg-cents');
const statTotal = getElement<HTMLDivElement>('stat-total');
const problemList = getElement<HTMLDivElement>('problem-list');
const statsClear = getElement<HTMLButtonElement>('stats-clear');

// Drone elements
const droneToggle = getElement<HTMLButtonElement>('drone-toggle');
const droneNoteSelect = getElement<HTMLSelectElement>('drone-note');
const droneVolumeInput = getElement<HTMLInputElement>('drone-volume');

// Tips elements
const tipsToggleEl = getElement<HTMLAnchorElement>('tips-toggle');
const tipsPanelEl = getElement<HTMLDivElement>('tips-panel');

// Fingerboard elements
const fingerboardWrap = getElement<HTMLDivElement>('fingerboard-wrap');
const fingerboard = getElement<HTMLDivElement>('fingerboard');
const fbMarker = getElement<HTMLDivElement>('fb-marker');
const fbFingerNum = getElement<HTMLSpanElement>('fb-finger-num');
const fbStrings = getElements<HTMLDivElement>('.fb-string');
const fbNoteLabels = getElement<HTMLDivElement>('fb-note-labels');
const fbLabelsToggle = getElement<HTMLButtonElement>('fb-labels-toggle');

// ---------- state ----------
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let detector: ReturnType<typeof PitchDetector.forFloat32Array> | null = null;
let rafId: number = 0;
let audioStream: MediaStream | null = null;
let buf: Float32Array<ArrayBuffer> | null = null;
let running = false;
let a4 = 440;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Needle smoothing
let displayCents = 0;
let targetCents = 0;
let hasPitch = false;

// Pitch buffer for stability
const pitchBuffer: PitchReading[] = [];
const PITCH_BUFFER_SIZE = 6;
let stableNote: string | null = null;
let stableOctave: number | null = null;
let lastNoteChangeTime = 0;

// Current phase: "pitch" | "posture" | "stats"
let currentPhase = 'pitch';

// ---------- Drone generator state ----------
let droneCtx: AudioContext | null = null;
let droneOscillators: DroneOscillator[] = [];
let droneGain: GainNode | null = null;
let droneActive = false;
let selectedDroneNote = 'A4';

// Note frequencies (equal temperament, A4 = 440 adjustable)
function noteToFreq(noteName: string): number {
  const noteMap: Record<string, number> = {
	'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
	'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
	'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
  };
  const match = noteName.match(/^([A-G][#b]?)(\d)$/);
  if (!match || !match[1] || !match[2]) return 440;
  const note = match[1];
  const octave = parseInt(match[2]);
  const semitones = (noteMap[note] ?? 0) + (octave - 4) * 12 - 9;
  return a4 * Math.pow(2, semitones / 12);
}

// ---------- Note accuracy tracking ----------
let noteAccuracyData: NoteAccuracyData = {};
const ACCURACY_STORAGE_KEY = 'resonance_note_accuracy';
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function loadAccuracyData(): void {
  try {
	const stored = localStorage.getItem(ACCURACY_STORAGE_KEY);
	if (stored) {
	  noteAccuracyData = JSON.parse(stored);
	}
  } catch (e) {
	console.warn('Could not load accuracy data:', e);
  }
}

function saveAccuracyData(): void {
  try {
	localStorage.setItem(ACCURACY_STORAGE_KEY, JSON.stringify(noteAccuracyData));
  } catch (e) {
	console.warn('Could not save accuracy data:', e);
  }
}

function recordPitchAccuracy(noteName: string, octave: number, cents: number): void {
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

function clearAccuracyData(): void {
  noteAccuracyData = {};
  saveAccuracyData();
  updateStatsUI();
}

// MediaPipe detectors
let poseLandmarker: PoseLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;
let videoStream: MediaStream | null = null;
let visionRunning = false;
let lastVideoTime = -1;

// Posture state
const postureState = {
  shoulderRaised: false,
  wristCollapsed: false,
  violinDrooping: false,
  lastUpdate: 0
};

// ---------- Phase 3: Correlation Engine ----------
const correlationWindow = 5000;
const observations: Observation[] = [];

let currentInsight: Insight | null = null;
let insightCooldown = 0;

function recordObservation(pitch: NoteInfo | null, cents: number, posture: PostureFlags): void {
  const now = Date.now();
  observations.push({ time: now, pitch, cents, ...posture });
  while (observations.length > 0 && observations[0]!.time < now - correlationWindow) {
	observations.shift();
  }
}

function analyzeCorrelations(): Insight | null {
  if (observations.length < 10) return null;

  const now = Date.now();
  if (insightCooldown > now) return currentInsight;

  const noteGroups: Record<string, Observation[]> = {};
  for (const obs of observations) {
	if (!obs.pitch) continue;
	const key = obs.pitch.name + obs.pitch.octave;
	if (!noteGroups[key]) noteGroups[key] = [];
	noteGroups[key].push(obs);
  }

  for (const [note, group] of Object.entries(noteGroups)) {
	if (group.length < 3) continue;

	const avgCents = group.reduce((s, o) => s + o.cents, 0) / group.length;
	const wristIssues = group.filter(o => o.wristCollapsed).length / group.length;
	const shoulderIssues = group.filter(o => o.shoulderRaised).length / group.length;
	const violinIssues = group.filter(o => o.violinDrooping).length / group.length;

	if (Math.abs(avgCents) > 12) {
	  const direction = avgCents > 0 ? 'sharp' : 'flat';

	  if (wristIssues > 0.5) {
		currentInsight = {
		  type: 'wrist-pitch',
		  note,
		  direction,
		  cents: Math.abs(Math.round(avgCents)),
		  message: `Your <span class="highlight">${note}</span> tends ${Math.round(Math.abs(avgCents))}¢ ${direction} when your wrist collapses.`,
		  advice: 'Try keeping your left wrist straighter — it affects finger placement.'
		};
		insightCooldown = now + 8000;
		return currentInsight;
	  }

	  if (shoulderIssues > 0.5) {
		currentInsight = {
		  type: 'shoulder-pitch',
		  note,
		  direction,
		  cents: Math.abs(Math.round(avgCents)),
		  message: `Your <span class="highlight">${note}</span> goes ${direction} when your shoulder rises.`,
		  advice: 'Relax your shoulder — tension travels down to your fingers.'
		};
		insightCooldown = now + 8000;
		return currentInsight;
	  }

	  if (violinIssues > 0.5) {
		currentInsight = {
		  type: 'violin-pitch',
		  note,
		  direction,
		  cents: Math.abs(Math.round(avgCents)),
		  message: `<span class="highlight">${note}</span> drifts ${direction} when your violin droops.`,
		  advice: 'Keep the scroll up — it changes the angle of attack for your fingers.'
		};
		insightCooldown = now + 8000;
		return currentInsight;
	  }
	}
  }

  const recent = observations.slice(-20);
  const recentWrist = recent.filter(o => o.wristCollapsed).length / recent.length;
  const recentShoulder = recent.filter(o => o.shoulderRaised).length / recent.length;
  const recentViolin = recent.filter(o => o.violinDrooping).length / recent.length;

  if (recentWrist > 0.6 && (!currentInsight || currentInsight.type !== 'wrist-general')) {
	currentInsight = {
	  type: 'wrist-general',
	  message: 'Your left wrist is consistently <span class="highlight">collapsed</span>.',
	  advice: 'Imagine holding a small ball in your palm to maintain the curve.'
	};
	insightCooldown = now + 6000;
	return currentInsight;
  }

  if (recentShoulder > 0.6 && (!currentInsight || currentInsight.type !== 'shoulder-general')) {
	currentInsight = {
	  type: 'shoulder-general',
	  message: 'Your left shoulder keeps <span class="highlight">rising</span>.',
	  advice: 'Take a breath and let it drop — the violin rests on your collarbone, not your shoulder.'
	};
	insightCooldown = now + 6000;
	return currentInsight;
  }

  if (recentViolin > 0.6 && (!currentInsight || currentInsight.type !== 'violin-general')) {
	currentInsight = {
	  type: 'violin-general',
	  message: 'Your violin is <span class="highlight">drooping</span>.',
	  advice: 'Keep the scroll at eye level or slightly above.'
	};
	insightCooldown = now + 6000;
	return currentInsight;
  }

  return currentInsight;
}

function updateInsightsUI(): void {
  const insight = analyzeCorrelations();
  if (insight) {
	insightMain.innerHTML = `
	  <div class="correlation">${insight.message}</div>
	  <div style="margin-top: 8px; font-size: 12px; color: var(--ink-faint);">${insight.advice}</div>
	`;
	insightMain.className = 'insight-card' + (insight.type.includes('pitch') ? ' warning' : '');
  } else if (observations.length < 10) {
	insightMain.innerHTML = '<span class="correlation">Keep playing — gathering data...</span>';
	insightMain.className = 'insight-card';
  } else {
	insightMain.innerHTML = '<span class="correlation">Looking good! No issues detected.</span>';
	insightMain.className = 'insight-card';
  }
}

// ---------- A4 calibration ----------
getElement('a-up').onclick = () => { a4 = Math.min(446, a4 + 1); aVal.textContent = String(a4); updateDroneFreq(); };
getElement('a-down').onclick = () => { a4 = Math.max(432, a4 - 1); aVal.textContent = String(a4); updateDroneFreq(); };

// ---------- BPM / Tempo ----------
let bpm = 60;
const bpmVal = getElement<HTMLSpanElement>('bpm-val');

function updateBeatDuration(): void {
  const beatDuration = 60 / bpm;
  document.documentElement.style.setProperty('--beat-duration', beatDuration + 's');
}

getElement('bpm-up').onclick = () => {
  bpm = Math.min(208, bpm + 4);
  bpmVal.textContent = String(bpm);
  updateBeatDuration();
  restartBeatLoop();
};
getElement('bpm-down').onclick = () => {
  bpm = Math.max(40, bpm - 4);
  bpmVal.textContent = String(bpm);
  updateBeatDuration();
  restartBeatLoop();
};

updateBeatDuration();

// ---------- Beat system ----------
let metronomeOn = false;
let beatInterval: ReturnType<typeof setInterval> | null = null;
let metroCtx: AudioContext | null = null;
const metroToggle = getElement<HTMLButtonElement>('metro-toggle');
const fbOrb = document.querySelector<HTMLDivElement>('.fb-orb')!;
const fbRing = document.querySelector<HTMLDivElement>('.fb-pulse-ring')!;

function playClick(): void {
  if (!metroCtx) metroCtx = new AudioContext();

  const osc = metroCtx.createOscillator();
  const gain = metroCtx.createGain();

  osc.type = 'sine';
  osc.frequency.value = 1000;
  gain.gain.setValueAtTime(0.3, metroCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, metroCtx.currentTime + 0.05);

  osc.connect(gain);
  gain.connect(metroCtx.destination);

  osc.start(metroCtx.currentTime);
  osc.stop(metroCtx.currentTime + 0.05);
}

function triggerBeat(): void {
  fbRing.classList.remove('animate');
  void fbRing.offsetWidth;
  fbRing.classList.add('animate');

  const beatMs = (60 / bpm) * 1000;
  const flashDelay = beatMs * 0.9;
  setTimeout(() => {
	fbOrb.classList.add('flash');
	if (metronomeOn) playClick();
	setTimeout(() => fbOrb.classList.remove('flash'), 80);
  }, flashDelay);
}

function startBeatLoop(): void {
  if (beatInterval) clearInterval(beatInterval);
  const beatMs = (60 / bpm) * 1000;
  triggerBeat();
  beatInterval = setInterval(triggerBeat, beatMs);
}

function stopBeatLoop(): void {
  if (beatInterval) {
	clearInterval(beatInterval);
	beatInterval = null;
  }
  fbRing.classList.remove('animate');
  fbOrb.classList.remove('flash');
}

function restartBeatLoop(): void {
  stopBeatLoop();
  startBeatLoop();
}

startBeatLoop();

metroToggle.onclick = () => {
  metronomeOn = !metronomeOn;
  metroToggle.classList.toggle('active', metronomeOn);
};

// ---------- Drone generator ----------
function startDrone(): void {
  if (droneActive) return;

  droneCtx = new AudioContext();
  droneGain = droneCtx.createGain();
  droneGain.gain.value = parseInt(droneVolumeInput.value) / 100 * 0.3;
  droneGain.connect(droneCtx.destination);

  const freq = noteToFreq(selectedDroneNote);

  const harmonics = [
	{ ratio: 1, gain: 1.0 },
	{ ratio: 2, gain: 0.5 },
	{ ratio: 3, gain: 0.25 },
	{ ratio: 4, gain: 0.125 },
  ];

  droneOscillators = harmonics.map(h => {
	const osc = droneCtx!.createOscillator();
	const oscGain = droneCtx!.createGain();
	osc.type = 'sine';
	osc.frequency.value = freq * h.ratio;
	oscGain.gain.value = h.gain;
	osc.connect(oscGain);
	oscGain.connect(droneGain!);
	osc.start();
	return { osc, gain: oscGain, ratio: h.ratio };
  });

  droneActive = true;
  droneToggle.textContent = 'On';
  droneToggle.classList.add('active');
}

function stopDrone(): void {
  if (!droneActive) return;

  droneOscillators.forEach(({ osc }) => {
	osc.stop();
	osc.disconnect();
  });
  droneOscillators = [];

  if (droneGain) droneGain.disconnect();
  if (droneCtx) droneCtx.close();
  droneCtx = null;
  droneGain = null;

  droneActive = false;
  droneToggle.textContent = 'Off';
  droneToggle.classList.remove('active');
}

function updateDroneFreq(): void {
	if (!droneActive || !droneCtx) return;
		const freq = noteToFreq(selectedDroneNote);
		droneOscillators.forEach(({ osc, ratio }) => {
		osc.frequency.setValueAtTime(freq * ratio, droneCtx!.currentTime);
	});
}

droneToggle.onclick = () => droneActive ? stopDrone() : startDrone();

droneNoteSelect.onchange = () => {
  selectedDroneNote = droneNoteSelect.value;
  updateDroneFreq();
};

droneVolumeInput.oninput = () => {
  if (droneGain) {
	droneGain.gain.value = parseInt(droneVolumeInput.value) / 100 * 0.3;
  }
};

// Tips toggle
tipsToggleEl.onclick = () => {
  tipsPanelEl.classList.toggle('open');
  tipsToggleEl.classList.toggle('open');
};

// ---------- Fingerboard visualization ----------
const noteToPosition: Record<string, FingerPosition> = {
  'G3': { string: 0, finger: 0 },
  'G#3': { string: 0, finger: 0.5 },
  'A3': { string: 0, finger: 1 },
  'A#3': { string: 0, finger: 1.5 },
  'B3': { string: 0, finger: 2 },
  'C4': { string: 0, finger: 3 },
  'C#4': { string: 0, finger: 4 },
  'D4': { string: 1, finger: 0 },
  'D#4': { string: 1, finger: 0.5 },
  'E4': { string: 1, finger: 1 },
  'F4': { string: 1, finger: 1.5 },
  'F#4': { string: 1, finger: 2 },
  'G4': { string: 1, finger: 3 },
  'G#4': { string: 1, finger: 4 },
  'A4': { string: 2, finger: 0 },
  'A#4': { string: 2, finger: 0.5 },
  'B4': { string: 2, finger: 1 },
  'C5': { string: 2, finger: 1.5 },
  'C#5': { string: 2, finger: 2 },
  'D5': { string: 2, finger: 3 },
  'D#5': { string: 2, finger: 4 },
  'E5': { string: 3, finger: 0 },
  'F5': { string: 3, finger: 0.5 },
  'F#5': { string: 3, finger: 1 },
  'G5': { string: 3, finger: 1.5 },
  'G#5': { string: 3, finger: 2 },
  'A5': { string: 3, finger: 3 },
  'A#5': { string: 3, finger: 4 },
  'B5': { string: 3, finger: 4.5 },
};

function updateFingerboard(noteName: string | null, octave: number, cents: number): void {
  fbStrings.forEach(s => s.classList.remove('active-string'));

  if (!noteName) {
	fbMarker.classList.remove('visible', 'in-tune', 'off');
	return;
  }

  const noteKey = noteName + octave;
  const pos = noteToPosition[noteKey];

  if (!pos) {
	fbMarker.classList.remove('visible', 'in-tune', 'off');
	return;
  }

  const fbRect = fingerboard.getBoundingClientRect();
  const targetString = fbStrings[pos.string];
  if (!targetString) return;

  targetString.classList.add('active-string');

  const stringRect = targetString.getBoundingClientRect();
  const stringCenterX = stringRect.left + stringRect.width / 2 - fbRect.left;

  const guidesEl = document.querySelector('.fb-position-guides')!;
  const guideDivs = guidesEl.querySelectorAll('.fb-guide');
  const guidesRect = guidesEl.getBoundingClientRect();

  const linePositions: number[] = [];
  guideDivs.forEach((div) => {
	const divRect = div.getBoundingClientRect();
	linePositions.push(divRect.top - guidesRect.top);
  });
  linePositions.push(guidesRect.height);

  function getFingerY(finger: number): number {
	const floor = Math.floor(finger);
	const frac = finger - floor;
	const y1 = linePositions[floor] ?? 0;
	const y2 = linePositions[floor + 1] ?? linePositions[linePositions.length - 1] ?? 0;
	return y1 + frac * (y2 - y1);
  }

  const topPadding = guidesRect.top - fbRect.top;
  let baseY = topPadding + getFingerY(pos.finger);

  const nextY = topPadding + getFingerY(pos.finger + 1);
  const localSpacing = nextY - baseY;
  const centsOffset = (cents / 50) * (localSpacing * 0.5);
  const finalY = baseY + centsOffset;

  const clampedY = Math.max(topPadding, Math.min(fbRect.height - 15, finalY));

  fbMarker.style.left = stringCenterX + 'px';
  fbMarker.style.top = clampedY + 'px';
  fbMarker.classList.add('visible');

  const fingerNum = Math.round(pos.finger);
  fbFingerNum.textContent = String(fingerNum);

  const absCents = Math.abs(cents);
  fbMarker.classList.remove('in-tune', 'off');

  if (absCents < CENTS_IN_TUNE) {
	fbMarker.classList.add('in-tune');
  } else if (absCents > CENTS_CLOSE) {
	fbMarker.classList.add('off');
  }
}

function clearFingerboard(): void {
  fbMarker.classList.remove('visible', 'in-tune', 'off');
  fbStrings.forEach(s => s.classList.remove('active-string'));
}

// ---------- Note labels on fingerboard ----------
const stringNotes = [
  [{ f: 0.5, n: 'G♯' }, { f: 1, n: 'A' }, { f: 1.5, n: 'A♯' }, { f: 2, n: 'B' }, { f: 3, n: 'C' }, { f: 3.5, n: 'C♯' }, { f: 4, n: 'D' }],
  [{ f: 0.5, n: 'D♯' }, { f: 1, n: 'E' }, { f: 1.5, n: 'F' }, { f: 2, n: 'F♯' }, { f: 3, n: 'G' }, { f: 3.5, n: 'G♯' }, { f: 4, n: 'A' }],
  [{ f: 0.5, n: 'A♯' }, { f: 1, n: 'B' }, { f: 1.5, n: 'C' }, { f: 2, n: 'C♯' }, { f: 3, n: 'D' }, { f: 3.5, n: 'D♯' }, { f: 4, n: 'E' }],
  [{ f: 0.5, n: 'F' }, { f: 1, n: 'F♯' }, { f: 1.5, n: 'G' }, { f: 2, n: 'G♯' }, { f: 3, n: 'A' }, { f: 3.5, n: 'A♯' }, { f: 4, n: 'B' }],
];

function generateNoteLabels(): void {
  fbNoteLabels.innerHTML = '';

  const guidesEl = document.querySelector('.fb-position-guides')!;
  const guideDivs = guidesEl.querySelectorAll('.fb-guide');
  const labelsRect = fbNoteLabels.getBoundingClientRect();

  const linePositions: number[] = [];
  guideDivs.forEach((div) => {
	const divRect = div.getBoundingClientRect();
	linePositions.push(divRect.top - labelsRect.top);
  });
  linePositions.push(labelsRect.height);

  function getY(finger: number): number {
	const floor = Math.floor(finger);
	const frac = finger - floor;
	const y1 = linePositions[floor] ?? 0;
	const y2 = linePositions[floor + 1] ?? linePositions[linePositions.length - 1] ?? 0;
	return y1 + frac * (y2 - y1);
  }

  fbStrings.forEach((stringEl, stringIndex) => {
	const stringRect = stringEl.getBoundingClientRect();
	const stringCenterX = stringRect.left + stringRect.width / 2 - labelsRect.left;

	const notes = stringNotes[stringIndex];
	notes?.forEach(({ f, n }) => {
	  const y = getY(f);

	  const label = document.createElement('span');
	  label.className = 'fb-note-label' + (n.includes('♯') ? ' sharp' : '');
	  label.textContent = n;
	  label.style.left = (stringCenterX + 10) + 'px';
	  label.style.top = y + 'px';

	  fbNoteLabels.appendChild(label);
	});
  });
}

let noteLabelsVisible = false;
fbLabelsToggle.onclick = () => {
	noteLabelsVisible = !noteLabelsVisible;
	fbLabelsToggle.classList.toggle('active', noteLabelsVisible);
	fbNoteLabels.classList.toggle('visible', noteLabelsVisible);
	if (noteLabelsVisible && fbNoteLabels.children.length === 0) {
		generateNoteLabels();
	}
};

window.addEventListener('resize', () => {
	if (noteLabelsVisible) {
		generateNoteLabels();
	}
});

function getNoteStats(): NoteStats[]{
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

// ---------- Stats UI ----------
function updateStatsUI(): void {
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

  let noteStats = getNoteStats();

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

statsClear.onclick = () => {
  if (confirm('Clear all accuracy data?')) {
	clearAccuracyData();
  }
};

// ---------- canvas sizing (retina) ----------
function fitCanvas(): void {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function fitOverlayCanvas(): void {
  if (video.videoWidth && video.videoHeight) {
	overlayCanvas.width = video.videoWidth;
	overlayCanvas.height = video.videoHeight;
  }
}

window.addEventListener('resize', () => {
  fitCanvas();
  fitOverlayCanvas();
});

// ---------- pitch math ----------
function freqToNote(freq: number): NoteInfo {
  const midi = 69 + 12 * Math.log2(freq / a4);
  const nearest = Math.round(midi);
  const cents = (midi - nearest) * 100;
  const name = NOTE_NAMES[(nearest % 12 + 12) % 12] ?? 'A';
  const octave = Math.floor(nearest / 12) - 1;
  return { name, octave, cents };
}

// ---------- Phase switching ----------
function switchPhase(phase: string): void {
  currentPhase = phase;
  phaseTabs.forEach(t => t.classList.toggle('active', t.dataset.phase === phase));

  const showCamera = phase === 'posture';
  const showMeter = phase === 'pitch';
  const showFlags = phase === 'posture';
  const showInsights = phase === 'posture';
  const showStats = phase === 'stats';
  const showFingerboard = phase === 'pitch';

  cameraPanel.classList.toggle('hidden', !showCamera);
  meterShell.classList.toggle('hidden', !showMeter);
  postureFlags.classList.toggle('hidden', !showFlags);
  insightsPanel.classList.toggle('hidden', !showInsights);
  statsPanel.classList.toggle('hidden', !showStats);
  fingerboardWrap.classList.toggle('hidden', !showFingerboard);
  document.getElementById('strings')!.classList.toggle('hidden', phase === 'posture' || phase === 'stats');
  document.querySelector('.controls')!.classList.toggle('hidden', phase === 'stats');

  if (showCamera && !visionRunning && running) {
	startVision();
  }

  if (showStats) {
	updateStatsUI();
  }
}

phaseTabs.forEach(tab => {
  tab.onclick = () => switchPhase(tab.dataset.phase ?? 'pitch');
});

// ---------- MediaPipe initialization ----------
async function initMediaPipe(): Promise<boolean> {
  hint.textContent = 'Loading pose detection...';

  try {
	const vision = await FilesetResolver.forVisionTasks(
	  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
	);

	poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
	  baseOptions: {
		modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
		delegate: 'GPU'
	  },
	  runningMode: 'VIDEO',
	  numPoses: 1
	});

	handLandmarker = await HandLandmarker.createFromOptions(vision, {
	  baseOptions: {
		modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
		delegate: 'GPU'
	  },
	  runningMode: 'VIDEO',
	  numHands: 2
	});

	return true;
  } catch (e) {
	console.error('MediaPipe init failed:', e);
	hint.textContent = 'Pose detection unavailable. Check console for details.';
	return false;
  }
}

// ---------- Vision (camera) start/stop ----------
async function startVision(): Promise<void> {
  if (visionRunning) return;

  if (!poseLandmarker || !handLandmarker) {
	const ok = await initMediaPipe();
	if (!ok) return;
  }

  try {
	videoStream = await navigator.mediaDevices.getUserMedia({
	  video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
	});
	video.srcObject = videoStream;
	await video.play();
	fitOverlayCanvas();
	visionRunning = true;
	visionLoop();
  } catch (e) {
	hint.textContent = 'Camera blocked. Check permissions.';
	console.error(e);
  }
}

function stopVision(): void {
  visionRunning = false;
  if (videoStream) {
	videoStream.getTracks().forEach(t => t.stop());
	videoStream = null;
  }
  video.srcObject = null;
}

// ---------- Posture heuristics ----------
const POSE = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_ELBOW: 13,
  LEFT_WRIST: 15,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  NOSE: 0
};

const HAND = {
  WRIST: 0,
  INDEX_MCP: 5,
  PINKY_MCP: 17,
  MIDDLE_MCP: 9
};

function analyzePosture(poseLandmarks: Landmark[][] | undefined, handLandmarks: Landmark[][] | undefined): PostureFlags {
  const flags: PostureFlags = { shoulderRaised: false, wristCollapsed: false, violinDrooping: false };

  if (poseLandmarks && poseLandmarks.length > 0) {
	const pose = poseLandmarks[0]!;

	const leftShoulder = pose[POSE.LEFT_SHOULDER];
	const rightShoulder = pose[POSE.RIGHT_SHOULDER];
	const leftEar = pose[POSE.LEFT_EAR];

	if (leftShoulder && rightShoulder && leftEar) {
	  const shoulderDiff = rightShoulder.y - leftShoulder.y;
	  const earToShoulder = leftShoulder.y - leftEar.y;

	  if (shoulderDiff > 0.04 || earToShoulder < 0.12) {
		flags.shoulderRaised = true;
	  }
	}

	const leftElbow = pose[POSE.LEFT_ELBOW];
	if (leftShoulder && leftElbow) {
	  const elbowDrop = leftElbow.y - leftShoulder.y;
	  if (elbowDrop > 0.15) {
		flags.violinDrooping = true;
	  }
	}
  }

  if (handLandmarks && handLandmarks.length > 0) {
	for (const hand of handLandmarks) {
	  const wrist = hand[HAND.WRIST];
	  const indexMcp = hand[HAND.INDEX_MCP];
	  const pinkyMcp = hand[HAND.PINKY_MCP];
	  const middleMcp = hand[HAND.MIDDLE_MCP];

	  if (wrist && middleMcp) {
		const dy = middleMcp.y - wrist.y;

		if (pinkyMcp && indexMcp) {
		  const spread = Math.abs(pinkyMcp.x - indexMcp.x);
		  if (spread < 0.05 && Math.abs(dy) < 0.08) {
			flags.wristCollapsed = true;
		  }
		}

		if (wrist.y - middleMcp.y > 0.06) {
		  flags.wristCollapsed = true;
		}
	  }
	}
  }

  return flags;
}

function updatePostureUI(flags: PostureFlags): void {
  const now = Date.now();
  if (now - postureState.lastUpdate > 150) {
	postureState.shoulderRaised = flags.shoulderRaised;
	postureState.wristCollapsed = flags.wristCollapsed;
	postureState.violinDrooping = flags.violinDrooping;
	postureState.lastUpdate = now;
  }

  flagShoulder.className = 'posture-flag' + (postureState.shoulderRaised ? ' warn' : ' ok');
  flagWrist.className = 'posture-flag' + (postureState.wristCollapsed ? ' warn' : ' ok');
  flagViolin.className = 'posture-flag' + (postureState.violinDrooping ? ' warn' : ' ok');
}

// Store last pitch data for correlation
let lastPitch = 0;
let lastCents = 0;

// ---------- Vision loop ----------
function visionLoop(): void {
  if (!visionRunning) return;

  if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
	lastVideoTime = video.currentTime;
	const timestamp = performance.now();

	const poseResults = poseLandmarker!.detectForVideo(video, timestamp);
	const handResults = handLandmarker!.detectForVideo(video, timestamp);

	overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

	const drawingUtils = new DrawingUtils(overlayCtx);

	if (poseResults.landmarks && poseResults.landmarks.length > 0) {
	  for (const landmarks of poseResults.landmarks) {
		drawingUtils.drawConnectors(landmarks, [
		  { start: POSE.LEFT_SHOULDER, end: POSE.RIGHT_SHOULDER },
		  { start: POSE.LEFT_SHOULDER, end: POSE.LEFT_ELBOW },
		  { start: POSE.LEFT_ELBOW, end: POSE.LEFT_WRIST },
		  { start: POSE.RIGHT_SHOULDER, end: POSE.LEFT_SHOULDER }
		], { color: 'rgba(224, 168, 80, 0.5)', lineWidth: 2 });

		const keyPoints = [POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER, POSE.LEFT_ELBOW, POSE.LEFT_WRIST];
		for (const idx of keyPoints) {
		  const lm = landmarks[idx];
		  if (lm) {
			overlayCtx.fillStyle = 'rgba(224, 168, 80, 0.8)';
			overlayCtx.beginPath();
			overlayCtx.arc(lm.x * overlayCanvas.width, lm.y * overlayCanvas.height, 4, 0, Math.PI * 2);
			overlayCtx.fill();
		  }
		}
	  }
	}

	if (handResults.landmarks && handResults.landmarks.length > 0) {
	  for (const landmarks of handResults.landmarks) {
		drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS,
		  { color: 'rgba(143, 191, 106, 0.5)', lineWidth: 1 });
		drawingUtils.drawLandmarks(landmarks, { color: 'rgba(143, 191, 106, 0.8)', radius: 2 });
	  }
	}

	const flags = analyzePosture(poseResults.landmarks, handResults.landmarks);
	updatePostureUI(flags);

	if (currentPhase === 'posture') {
	  recordObservation(
		hasPitch ? freqToNote(lastPitch) : null,
		hasPitch ? lastCents : 0,
		flags
	  );
	  updateInsightsUI();
	}
  }

  requestAnimationFrame(visionLoop);
}

// ---------- audio start/stop ----------
async function start(): Promise<void> {
  try {
	audioStream = await navigator.mediaDevices.getUserMedia({
	  audio: {
		echoCancellation: false,
		noiseSuppression: false,
		autoGainControl: false
	  }
	});
  } catch {
	hint.textContent = 'Microphone blocked. Check your browser permissions and try again.';
	return;
  }

  audioCtx = new AudioContext();
  await audioCtx.resume();
  const source = audioCtx.createMediaStreamSource(audioStream);

  const highPass = audioCtx.createBiquadFilter();
  highPass.type = 'highpass';
  highPass.frequency.value = 150;
  highPass.Q.value = 0.7;

  const lowPass = audioCtx.createBiquadFilter();
  lowPass.type = 'lowpass';
  lowPass.frequency.value = 4500;
  lowPass.Q.value = 0.7;

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 4096;

  source.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(analyser);

  buf = new Float32Array(analyser.fftSize);
  detector = PitchDetector.forFloat32Array(analyser.fftSize);
  detector.minVolumeDecibels = -34;

  running = true;
  toggle.textContent = 'Stop';
  toggle.classList.add('running');
  hint.textContent = 'Play a single sustained note and let it ring.';

  if (currentPhase === 'posture') {
	startVision();
  }

  loop();
}

function stop(): void {
  running = false;
  cancelAnimationFrame(rafId);
  if (audioStream) audioStream.getTracks().forEach(t => t.stop());
  if (audioCtx) audioCtx.close();
  if (metroCtx) { metroCtx.close(); metroCtx = null; }
  if (saveTimeout) {
	clearTimeout(saveTimeout);
	saveTimeout = null;
	saveAccuracyData();
  }
  stopVision();
  toggle.textContent = 'Begin Listening';
  toggle.classList.remove('running');
  hasPitch = false;
  readout.classList.add('idle');
  noteEl.textContent = '—';
  centsEl.textContent = 'awaiting sound';
  freqEl.textContent = '';
  strings.forEach(s => s.classList.remove('lit'));
  drawMeter(0, false);

  flagShoulder.className = 'posture-flag';
  flagWrist.className = 'posture-flag';
  flagViolin.className = 'posture-flag';

  clearFingerboard();
}

toggle.onclick = () => running ? stop() : start();

// ---------- main loop ----------
let lastAccuracyRecord = 0;

function loop(): void {
  if (!analyser || !buf || !detector || !audioCtx) return;

  analyser.getFloatTimeDomainData(buf);
  const [pitch, clarity] = detector.findPitch(buf, audioCtx.sampleRate);

  if (clarity > 0.93 && pitch > 60 && pitch < 4500) {
	const { name, octave, cents } = freqToNote(pitch);

	pitchBuffer.push({ name, octave, cents, pitch });
	if (pitchBuffer.length > PITCH_BUFFER_SIZE) pitchBuffer.shift();

	const noteCounts: Record<string, number> = {};
	for (const p of pitchBuffer) {
	  const key = p.name + p.octave;
	  noteCounts[key] = (noteCounts[key] ?? 0) + 1;
	}
	const sortedNotes = Object.entries(noteCounts).sort((a, b) => b[1] - a[1]);
	const [topNote, topCount] = sortedNotes[0] ?? ['', 0];

	const now = Date.now();
	if (topCount >= Math.ceil(PITCH_BUFFER_SIZE / 2)) {
	  const noteMatch = topNote.match(/^([A-G]#?)(\d)$/);
	  if (noteMatch && noteMatch[1] && noteMatch[2]) {
		const bufName = noteMatch[1];
		const bufOctave = parseInt(noteMatch[2]);

		const isNewNote = bufName !== stableNote || bufOctave !== stableOctave;
		if (!isNewNote || now - lastNoteChangeTime > 150) {
		  if (isNewNote) {
			stableNote = bufName;
			stableOctave = bufOctave;
			lastNoteChangeTime = now;
		  }

		  const matchingReadings = pitchBuffer.filter(p => p.name === bufName && p.octave === bufOctave);
		  const avgCents = matchingReadings.reduce((s, p) => s + p.cents, 0) / matchingReadings.length;
		  const avgPitch = matchingReadings.reduce((s, p) => s + p.pitch, 0) / matchingReadings.length;

		  hasPitch = true;
		  lastPitch = avgPitch;
		  lastCents = avgCents;
		  targetCents = Math.max(-50, Math.min(50, avgCents));

		  const acc = bufName.includes('#');
		  noteEl.innerHTML =
			`${bufName[0]}${acc ? '<span class="acc">♯</span>' : ''}<span class="oct">${bufOctave}</span>`;
		  const dir = avgCents > 0 ? 'sharp' : avgCents < 0 ? 'flat' : 'true';
		  const mag = Math.abs(avgCents) < 5 ? 'in tune' : `${Math.abs(Math.round(avgCents))}¢ ${dir}`;
		  centsEl.textContent = mag;
		  freqEl.textContent = avgPitch.toFixed(1) + ' Hz';
		  readout.classList.remove('idle');

		  const a = Math.abs(avgCents);
		  noteEl.style.color = a < 5 ? 'var(--green)' : a < 18 ? 'var(--amber)' : 'var(--red)';

		  strings.forEach(s => {
			const sf = parseFloat(s.dataset.f ?? '0');
			const lit = Math.abs(1200 * Math.log2(avgPitch / sf)) < 45;
			s.classList.toggle('lit', lit);
		  });

		  if (now - lastAccuracyRecord > 200) {
			recordPitchAccuracy(bufName, bufOctave, avgCents);
			lastAccuracyRecord = now;
		  }

		  updateFingerboard(bufName, bufOctave, avgCents);
		}
	  }
	}
  } else {
	if (pitchBuffer.length > 0) pitchBuffer.length = 0;
	hasPitch = false;
	stableNote = null;
	stableOctave = null;
	centsEl.textContent = 'listening…';
	readout.classList.add('idle');
	strings.forEach(s => s.classList.remove('lit'));
	clearFingerboard();
  }

  displayCents += (targetCents - displayCents) * 0.22;
  drawMeter(displayCents, hasPitch);

  rafId = requestAnimationFrame(loop);
}

// ---------- meter drawing ----------
function drawMeter(cents: number, active: boolean): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h * 0.96;
  const R = Math.min(w * 0.46, h * 0.92);
  const span = Math.PI * 0.78;
  const start = -Math.PI / 2 - span / 2;
  const end = -Math.PI / 2 + span / 2;

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3a2d22';
  ctx.beginPath();
  ctx.arc(cx, cy, R, start, end);
  ctx.stroke();

  for (let c = -50; c <= 50; c += 10) {
	const ang = -Math.PI / 2 + (c / 50) * (span / 2);
	const major = c === 0;
	const r1 = R - (major ? 16 : 9);
	const x1 = cx + Math.cos(ang) * r1;
	const y1 = cy + Math.sin(ang) * r1;
	const x2 = cx + Math.cos(ang) * R;
	const y2 = cy + Math.sin(ang) * R;
	ctx.lineWidth = major ? 2.5 : 1.2;
	ctx.strokeStyle = major ? '#e0a850' : '#5a4836';
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
  }

  const zone = (15 / 50) * (span / 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = active && Math.abs(cents) < CENTS_PERFECT
	? 'rgba(143,191,106,.9)' : 'rgba(143,191,106,.18)';
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2 - zone, -Math.PI / 2 + zone);
  ctx.stroke();

  ctx.fillStyle = '#6a5642';
  ctx.font = "11px 'Spline Sans Mono', monospace";
  ctx.textAlign = 'center';
  ctx.fillText('♭', cx + Math.cos(start) * (R + 16), cy + Math.sin(start) * (R + 16) + 4);
  ctx.fillText('♯', cx + Math.cos(end) * (R + 16), cy + Math.sin(end) * (R + 16) + 4);

  const ang = -Math.PI / 2 + (cents / 50) * (span / 2);
  const nLen = R - 4;
  const tipX = cx + Math.cos(ang) * nLen;
  const tipY = cy + Math.sin(ang) * nLen;

  const col = !active ? '#5a4836'
	: Math.abs(cents) < CENTS_PERFECT ? '#8fbf6a'
	: Math.abs(cents) < CENTS_CLOSE ? '#e0a850' : '#d8694e';

  ctx.shadowColor = active ? col : 'transparent';
  ctx.shadowBlur = active ? 14 : 0;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

// ---------- init ----------
fitCanvas();
drawMeter(0, false);
loadAccuracyData();
updateStatsUI();

async function ask(): Promise<string> {

	const response = await fetch('/api/ask',
	{
		// payload
		body: JSON.stringify({
			question: "Where am I struggling?",
			noteStats: getNoteStats(),
			posture: postureState
		})
	})

	const data = await response.json();
	return data.response;
}

addEventListener('click', ask)