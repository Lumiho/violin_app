import { noteToFreq } from './audio';
import { droneToggle, droneVolumeInput } from '../shared';
import { DroneOscillator} from '../types';

// Functions in this file:
// - startDrone() - exported, starts the drone sound
// - stopDrone() - exported, stops the drone sound
// - updateDroneFreq() - exported, updates the drone frequency based on selected note
// - setDroneVolume() - exported, sets the drone volume

let a4 = 440; // Default A4 frequency, can be adjusted if needed

// ---------- Drone generator state ----------
let droneCtx: AudioContext | null = null;
let droneOscillators: DroneOscillator[] = [];
let droneGain: GainNode | null = null;
let droneActive = false;
let selectedDroneNote = 'A4';

// ---------- Drone generator ----------
export function startDrone(): void {
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

export function stopDrone(): void {
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

export function updateDroneFreq(): void {
	if (!droneActive || !droneCtx) return;
		const freq = noteToFreq(selectedDroneNote, a4);
		droneOscillators.forEach(({ osc, ratio }) => {
		osc.frequency.setValueAtTime(freq * ratio, droneCtx!.currentTime);
	});
}

export function setDroneVolume(volume: number): void {
	if (droneGain) {
		droneGain.gain.value = volume / 100 * 0.3;
	}
}

export function setDroneNote(note: string): void {
	selectedDroneNote = note;
}

export function setA4(freq: number): void {
	a4 = freq;
}

export function isDroneActive(): boolean {
	return droneActive;
}

export function toggleDrone(): void {
	if (droneActive) {
		stopDrone();
	} else {
		startDrone();
	}
}