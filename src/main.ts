import './styles.css';
import { PitchDetector } from 'pitchy';
import {
	PitchReading, FingerPosition, DroneOscillator, postureState
} from './types'
import { getElement } from './helpers/shared';
import { freqToNote, noteToFreq } from './helpers/audio';
import { loadAccuracyData, saveAccuracyData, recordPitchAccuracy, getNoteStats, updateStatsUI } from './helpers/stats';
import { startVision, stopVision, isVisionRunning, setVisionCallbacks } from './helpers/vision';

// ---------- accuracy thresholds (cents) ----------
const CENTS_PERFECT = 5;    // Perfect intonation (green glow)
const CENTS_IN_TUNE = 10;   // Acceptable intonation
const CENTS_CLOSE = 18;     // Close but needs work (amber)
// Above CENTS_CLOSE = off/red


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
const flagShoulder = getElement<HTMLSpanElement>('flag-shoulder');
const flagWrist = getElement<HTMLSpanElement>('flag-wrist');
const flagViolin = getElement<HTMLSpanElement>('flag-violin');

// Phase 2 elements
const cameraPanel = getElement<HTMLDivElement>('camera-panel');
const postureFlags = getElement<HTMLDivElement>('posture-flags');
const meterShell = getElement<HTMLDivElement>('meter-shell');

// Insights elements (shown on posture tab)
const insightsPanel = getElement<HTMLDivElement>('insights-panel');

// Phase tabs
const phaseTabs = getElements<HTMLButtonElement>('.phase-tab');

// Stats elements
const statsPanel = getElement<HTMLDivElement>('stats-panel');

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
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let audioCtx: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let detector: ReturnType<typeof PitchDetector.forFloat32Array> | null = null;
let rafId: number = 0;
let audioStream: MediaStream | null = null;
let buf: Float32Array<ArrayBuffer> | null = null;
let running = false;
let a4 = 440;

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

  const freq = noteToFreq(selectedDroneNote, a4);

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
		const freq = noteToFreq(selectedDroneNote, a4);
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

// ---------- canvas sizing (retina) ----------
function fitCanvas(): void {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener('resize', fitCanvas);

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

  if (showCamera && !isVisionRunning() && running) {
	startVision();
  }

  if (showStats) {
	updateStatsUI();
  }
}

phaseTabs.forEach(tab => {
  tab.onclick = () => switchPhase(tab.dataset.phase ?? 'pitch');
});

// Store last pitch data for correlation (used by vision module)
let lastPitch = 0;
let lastCents = 0;

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
	const { name, octave, cents } = freqToNote(pitch, a4);

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

// ============================================== init ===========================================================

fitCanvas();
drawMeter(0, false);
loadAccuracyData();
updateStatsUI();

// Set up vision callbacks
setVisionCallbacks(
	() => currentPhase,
	() => ({ hasPitch, lastPitch, lastCents, a4 })
);

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