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