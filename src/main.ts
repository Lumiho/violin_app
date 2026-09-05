import './cosmetic/styles.css';
import { PitchDetector } from 'pitchy';
import { PitchReading } from './types'
import { loadAccuracyData, saveAccuracyData, recordPitchAccuracy, updateStatsUI } from './features/stats';
import { startVision, stopVision, isVisionRunning, setVisionCallbacks } from './features/vision';
import { startDrone, stopDrone, updateDroneFreq, setDroneVolume, setDroneNote, setA4, isDroneActive } from './features/drone';
import { getElement, getElements, canvas, ctx, droneToggle, droneVolumeInput, fbNoteLabels } from './shared';
import { freqToNote } from './features/audio';
import { drawMeter, generateNoteLabels, clearFingerboard, updateFingerboard } from './cosmetic/cosmetics';
import { ask } from './api/ask';

// ---------- accuracy thresholds (cents) ----------
// const CENTS_PERFECT = 5;    // Perfect intonation (green glow)
// const CENTS_IN_TUNE = 10;   // Acceptable intonation
// const CENTS_CLOSE = 18;     // Close but needs work (amber)
// Above CENTS_CLOSE = off/red

// ---------- elements ----------
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
const droneNoteSelect = getElement<HTMLSelectElement>('drone-note');
const cameraPanel = getElement<HTMLDivElement>('camera-panel');
const postureFlags = getElement<HTMLDivElement>('posture-flags');
const meterShell = getElement<HTMLDivElement>('meter-shell');

// Insights elements (shown on posture tab)
const insightsPanel = getElement<HTMLDivElement>('insights-panel');

// Phase tabs
const phaseTabs = getElements<HTMLButtonElement>('.phase-tab');

// Stats elements
const statsPanel = getElement<HTMLDivElement>('stats-panel');

// Tips elements
const tipsToggleEl = getElement<HTMLAnchorElement>('tips-toggle');
const tipsPanelEl = getElement<HTMLDivElement>('tips-panel');

// Fingerboard elements
const fingerboardWrap = getElement<HTMLDivElement>('fingerboard-wrap');
const fbLabelsToggle = getElement<HTMLButtonElement>('fb-labels-toggle');
const cameraToggleBtn = getElement<HTMLButtonElement>('camera-toggle');

// ----------------------------------------- STATE -------------------------------------------------
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

// Current phase: "setup" | "practice" | "feedback"
let currentPhase = 'setup';
let cameraEnabled = false;

// ---------- A4 calibration ----------
getElement('a-up').onclick = () => { a4 = Math.min(446, a4 + 1); aVal.textContent = String(a4); setA4(a4); updateDroneFreq(); };
getElement('a-down').onclick = () => { a4 = Math.max(432, a4 - 1); aVal.textContent = String(a4); setA4(a4); updateDroneFreq(); };

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

// --------------------------- Drone ---------------------------
droneToggle.onclick = () => isDroneActive() ? stopDrone() : startDrone();

droneNoteSelect.onchange = () => {
  setDroneNote(droneNoteSelect.value);
  updateDroneFreq();
};

droneVolumeInput.oninput = () => {
  setDroneVolume(parseInt(droneVolumeInput.value));
};

// Tips toggle
tipsToggleEl.onclick = () => {
  tipsPanelEl.classList.toggle('open');
  tipsToggleEl.classList.toggle('open');
};

// ---------- Note labels on fingerboard ----------

let noteLabelsVisible = false;
fbLabelsToggle.onclick = () => {
	noteLabelsVisible = !noteLabelsVisible;
	fbLabelsToggle.classList.toggle('active', noteLabelsVisible);
	fbNoteLabels.classList.toggle('visible', noteLabelsVisible);
	if (noteLabelsVisible && fbNoteLabels.children.length === 0) {
		generateNoteLabels();
	}
};

// Camera toggle for practice tab
cameraToggleBtn.onclick = async () => {
	cameraEnabled = !cameraEnabled;
	cameraToggleBtn.classList.toggle('active', cameraEnabled);

	if (cameraEnabled) {
		cameraPanel.classList.remove('hidden');
		postureFlags.classList.remove('hidden');
		if (!isVisionRunning()) {
			await startVision();
		}
	} else {
		cameraPanel.classList.add('hidden');
		postureFlags.classList.add('hidden');
		if (isVisionRunning()) {
			stopVision();
		}
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

  // Setup: just the meter for tuning
  // Practice: fingerboard + optional camera
  // Feedback: stats panel
  const showMeter = phase === 'setup';
  const showFingerboard = phase === 'practice';
  const showCamera = phase === 'practice' && cameraEnabled;
  const showFlags = phase === 'practice' && cameraEnabled;
  const showInsights = phase === 'practice';
  const showFeedback = phase === 'feedback';

  cameraPanel.classList.toggle('hidden', !showCamera);
  meterShell.classList.toggle('hidden', !showMeter);
  postureFlags.classList.toggle('hidden', !showFlags);
  insightsPanel.classList.toggle('hidden', !showInsights);
  statsPanel.classList.toggle('hidden', !showFeedback);
  fingerboardWrap.classList.toggle('hidden', !showFingerboard);
  document.getElementById('strings')!.classList.toggle('hidden', phase !== 'setup');
  document.querySelector('.controls')!.classList.toggle('hidden', phase === 'feedback');

  if (showFeedback) {
	updateStatsUI();
  }
}

phaseTabs.forEach(tab => {
  tab.onclick = () => switchPhase(tab.dataset.phase ?? 'setup');
});

// Set initial phase state on load
switchPhase('setup');

// Store last pitch data for correlation (used by vision module)
let lastPitch = 0;
let lastCents = 0;

// ---------------- Audio/Vision -----------------

// Set up vision callbacks
setVisionCallbacks(
	() => currentPhase,
	() => ({ hasPitch, lastPitch, lastCents, a4 })
);

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
			enableAskCoach();
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

// ---------- Ask button ----------
const askBtn = getElement<HTMLButtonElement>('ask-btn');
const askResponse = getElement<HTMLDivElement>('ask-response');
let sessionHasData = false;

// Start disabled until user plays something
askBtn.disabled = true;
askBtn.title = 'Play some notes first';

export function enableAskCoach(): void {
  if (!sessionHasData) {
    sessionHasData = true;
    askBtn.disabled = false;
    askBtn.title = '';
  }
}

askBtn.onclick = async () => {
  askBtn.disabled = true;
  askBtn.textContent = 'Thinking...';
  askResponse.textContent = '';

  try {
    const response = await ask();
    askResponse.textContent = response;
  } catch (err) {
    askResponse.textContent = 'Error getting response. Is the server running?';
    console.error(err);
  }

  askBtn.disabled = false;
  askBtn.textContent = 'Ask Coach';
};

// ============================================== init ===========================================================

fitCanvas();
drawMeter(0, false);
loadAccuracyData();
updateStatsUI();