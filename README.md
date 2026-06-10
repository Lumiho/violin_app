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

### Phase 2: Posture Flagging (Planned)
- MediaPipe pose/hand tracking via webcam
- Heuristic rules for common issues:
  - Raised shoulder
  - Collapsed left wrist
  - Drooping instrument
- Hardcoded thresholds first, no ML training

### Phase 3: Correlated Insights (Planned)
- Connect intonation errors with posture flags
- Teacher-like feedback (e.g., "your B is flat and your wrist collapses on it")

## Tech Stack

- Vanilla HTML/CSS/JS — single file, no build step
- Web Audio API (`getUserMedia` + `AnalyserNode`) for mic input
- [pitchy](https://github.com/ianprime0509/pitchy) library (McLeod Pitch Method) for pitch detection
- MediaPipe Tasks (plain JS) for Phase 2
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

One external dependency: `pitchy` loaded from esm.sh CDN.

For offline use, vendor locally:
1. Download pitchy and save as `pitchy.js`
2. Change the import to `./pitchy.js`

## License

MIT
