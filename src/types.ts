// ---------- Types ----------
export interface NoteInfo {
  name: string;
  octave: number;
  cents: number;
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
