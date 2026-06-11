# Resonance

A web app to supplement self-teaching violin. Real-time feedback on intonation and posture, eventually correlating the two into teacher-like insights.

## Phases

### Phase 1: Real-time Intonation Trainer (Complete)
- Pitch detection with cents-off feedback
- Arc tuning meter (±50¢) on canvas
- Note name, octave, cents deviation, frequency readout
- Color feedback: green/amber/red
- Open-string indicators (G/D/A/E)
- A₄ calibration: 432–446 Hz

### Phase 2: Posture Flagging (Complete)
- MediaPipe pose/hand tracking via webcam
- Real-time landmark visualization on video overlay
- Heuristic detection for:
  - **Raised shoulder**: compares left/right shoulder height + ear-to-shoulder distance
  - **Collapsed left wrist**: analyzes hand landmark angles and palm orientation
  - **Drooping violin**: checks elbow drop relative to shoulder
- Visual flag indicators (green OK / red warning)

### Phase 3: Correlated Insights (Complete)
- Rolling 5-second observation window tracks pitch + posture together
- Pattern detection: identifies when specific notes drift sharp/flat during posture issues
- Teacher-like feedback examples:
  - "Your B4 tends 15¢ flat when your wrist collapses."
  - "Your shoulder keeps rising — the violin rests on your collarbone, not your shoulder."
- Cooldown system prevents insight spam

### Additional Features

**Drone Generator**
- Reference pitch for ear training
- Open strings (G, D, A, E) + common keys (C, F, Bb, Eb)
- Rich harmonic tone (fundamental + overtones)
- Volume control
- Adjusts with A4 calibration

**Note Accuracy Stats**
- Chromatic heatmap showing accuracy by note (G3–E6)
- Color coding: green (accurate), amber (close), red (off)
- Overall stats: % in tune, average cents offset, total samples
- "Notes to Practice" section highlights problem areas
- Persisted to localStorage across sessions
- Tabbed UI: Pitch / Posture / Insights / Stats

## Tech Stack

- Vanilla HTML/CSS/JS — single file, no build step
- Web Audio API (`getUserMedia` + `AnalyserNode`) for mic input
- [pitchy](https://github.com/ianprime0509/pitchy) library (McLeod Pitch Method) for pitch detection
- [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) for pose and hand tracking
- PWA wrapper possible later

## Key Engineering Decisions

- Mic settings: `echoCancellation`, `noiseSuppression`, `autoGainControl` all **OFF** (they distort pitch)
- `fftSize = 4096` for stable low-note (open G) detection
- Needle eased toward target for smooth visual swing
- Clarity threshold: 0.93

## Setup

1. Clone or download
2. Open `index.html` in a browser
3. Allow microphone access

Works directly as a GitHub Pages site.

## Dependencies

External dependencies loaded from CDN:
- `pitchy` (esm.sh) — pitch detection
- `@mediapipe/tasks-vision` (esm.sh + jsDelivr WASM) — pose/hand tracking

For offline use:
1. Download pitchy and save as `pitchy.js`
2. Download MediaPipe Tasks Vision and its WASM files
3. Update import paths to local files

## License

MIT
