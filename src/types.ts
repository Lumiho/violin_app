// ---------- Types ----------
export interface NoteInfo {
  name: string;
  octave: number;
  cents: number;
}

export interface NoteStats{
  note: string;
  avg: number;
  bias: number;
  count: number;
}

export interface PitchReading extends NoteInfo {
  pitch: number;
}

export interface PostureFlags {
  shoulderRaised: boolean;
  wristCollapsed: boolean;
  violinDrooping: boolean;
}

export interface Observation extends PostureFlags {
  time: number;
  pitch: NoteInfo | null;
  cents: number;
}

export interface Insight {
  type: string;
  note?: string;
  direction?: string;
  cents?: number;
  message: string;
  advice: string;
}

export interface NoteAccuracySample {
  cents: number;
  timestamp: number;
}

export interface NoteAccuracyData {
  [noteKey: string]: {
    samples: NoteAccuracySample[];
  };
}

export interface FingerPosition {
  string: number;
  finger: number;
}

export interface DroneOscillator {
  osc: OscillatorNode;
  gain: GainNode;
  ratio: number;
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

// ---------- Posture heuristics ----------
export const POSE = {
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

export const postureState = {
  shoulderRaised: false,
  wristCollapsed: false,
  violinDrooping: false,
  lastUpdate: 0
};

export const noteToPosition: Record<string, FingerPosition> = {
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

export const stringNotes = [
  [{ f: 0.5, n: 'G♯' }, { f: 1, n: 'A' }, { f: 1.5, n: 'A♯' }, { f: 2, n: 'B' }, { f: 3, n: 'C' }, { f: 3.5, n: 'C♯' }, { f: 4, n: 'D' }],
  [{ f: 0.5, n: 'D♯' }, { f: 1, n: 'E' }, { f: 1.5, n: 'F' }, { f: 2, n: 'F♯' }, { f: 3, n: 'G' }, { f: 3.5, n: 'G♯' }, { f: 4, n: 'A' }],
  [{ f: 0.5, n: 'A♯' }, { f: 1, n: 'B' }, { f: 1.5, n: 'C' }, { f: 2, n: 'C♯' }, { f: 3, n: 'D' }, { f: 3.5, n: 'D♯' }, { f: 4, n: 'E' }],
  [{ f: 0.5, n: 'F' }, { f: 1, n: 'F♯' }, { f: 1.5, n: 'G' }, { f: 2, n: 'G♯' }, { f: 3, n: 'A' }, { f: 3.5, n: 'A♯' }, { f: 4, n: 'B' }],
];



// ask endpoint already filters for just the content text.
// the frontend just needs to see 'response: string' not all of this stuff we already filtered out

// export interface LLMResponse
// {
//   id: string,
//   type: string,
//   role: string,
//   content: {
//     type: string,
//     text: string
//   }[],
//   model: string,
//   stop_reason: string,
//   stop_sequence: string | null,
//   usage: {
// 	input_tokens: number,
// 	output_tokens: number
//   }
// }