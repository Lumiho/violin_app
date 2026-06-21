<div align="center">

# Resonance

**Real-time violin practice companion with AI-powered feedback**

A browser-based tool for self-teaching violinists that provides instant intonation feedback, posture analysis, and personalized insights — like having a teacher watch over your shoulder.

[Features](#features) · [Getting Started](#getting-started) · [How It Works](#how-it-works) · [Tech Stack](#tech-stack)

</div>

---

## Overview

Resonance combines real-time pitch detection with computer vision to help violinists practice more effectively. It listens to your playing, watches your form, and identifies patterns between the two — alerting you when posture issues affect your intonation.

**No installation required.** Open it in a browser, grant microphone/camera access, and start practicing.

## Features

### Intonation Trainer
- **Real-time pitch detection** using the McLeod Pitch Method for accuracy down to ±1 cent
- **Arc tuning meter** (±50¢ range) with smooth needle animation
- **Visual feedback**: green (in tune), amber (close), red (off) color coding
- **Note display** with name, accidental, octave, cents deviation, and frequency (Hz)
- **Open string indicators** for G, D, A, and E strings
- **A₄ calibration** adjustable from 432–446 Hz (default 440 Hz)

### Posture Analysis
Powered by MediaPipe's pose and hand tracking:
- **Raised shoulder detection** — compares shoulder heights and ear-to-shoulder distance
- **Collapsed wrist warning** — analyzes left hand landmark angles and palm orientation
- **Drooping violin alert** — monitors elbow position relative to shoulder
- **Real-time skeleton overlay** on webcam feed
- **Visual indicators** (green OK / red warning) for each posture checkpoint

### Correlated Insights
The standout feature — connects your posture to your pitch:
- **Rolling 5-second observation window** tracks pitch and posture simultaneously
- **Pattern detection** identifies when notes drift sharp/flat during posture problems
- **Teacher-like feedback**, for example:
  - *"Your B4 tends 15¢ flat when your wrist collapses."*
  - *"Your shoulder keeps rising — the violin rests on your collarbone, not your shoulder."*
- **Cooldown system** prevents repetitive notifications

### Drone Generator
Reference pitches for ear training:
- Open strings (G, D, A, E) and common keys (C, F, B♭, E♭)
- Rich harmonic tone with fundamental and overtones
- Volume control
- Syncs with your A₄ calibration setting

### Practice Statistics
Track your progress over time:
- **Chromatic heatmap** showing accuracy for every note (G3–E6)
- **Summary stats**: percentage in tune, average cents offset, total samples
- **"Notes to Practice"** section highlights your problem areas
- **Persistent storage** — stats saved to localStorage across sessions

### User Interface
- **Tabbed layout**: Pitch / Posture / Insights / Stats
- **Dark, warm aesthetic** designed for low-light practice rooms
- **Responsive design** works on desktop and tablets
- **Single-page app** — no navigation, no distractions

## Getting Started

### Quick Start
1. Open `index.html` in a modern browser (Chrome or Edge recommended)
2. Click **Start** to begin
3. Grant microphone and camera permissions when prompted
4. Start playing!

### Deploy to GitHub Pages
```bash
git clone https://github.com/your-username/resonance.git
cd resonance
# Push to GitHub, enable Pages in repository settings
# Your app will be live at https://your-username.github.io/resonance
```

### Browser Requirements
| Browser | Support |
|---------|---------|
| Chrome 90+ | Full support |
| Edge 90+ | Full support |
| Firefox 90+ | Full support |
| Safari 15.4+ | Partial (MediaPipe may have issues) |

**Required permissions:** Microphone (for pitch detection), Camera (for posture tracking)

## How It Works

### Pitch Detection Pipeline
1. Microphone input via Web Audio API (`getUserMedia`)
2. Audio analysis with `AnalyserNode` (FFT size: 4096 for low-note stability)
3. Pitch extraction using [pitchy](https://github.com/ianprime0509/pitchy) library
4. Clarity threshold of 0.93 filters out noise
5. Cents deviation calculated against equal temperament

### Posture Detection Pipeline
1. Webcam feed captured via `getUserMedia`
2. Frame-by-frame analysis with MediaPipe Pose Landmarker and Hand Landmarker
3. Heuristic rules applied to landmark positions
4. Results displayed as overlay graphics and status indicators

### Correlation Engine
1. Both pipelines feed into a rolling 5-second observation buffer
2. Pattern matching identifies recurring pitch errors during posture flags
3. Significant correlations trigger contextual insights
4. Cooldown timer prevents notification fatigue

### Key Engineering Decisions
- **Mic settings**: `echoCancellation`, `noiseSuppression`, `autoGainControl` all **disabled** — these DSP features distort pitch for musical instruments
- **FFT size 4096**: Required for stable detection of open G string (~196 Hz)
- **Needle easing**: Smooth animation prevents jarring visual jumps
- **Clarity threshold 0.93**: High threshold reduces false positives from ambient noise

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vanilla HTML/CSS/JS (single file, zero build step) |
| Audio Input | Web Audio API (`getUserMedia` + `AnalyserNode`) |
| Pitch Detection | [pitchy](https://github.com/ianprime0509/pitchy) (McLeod Pitch Method) |
| Computer Vision | [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) |
| Fonts | Fraunces (display), Spline Sans Mono (UI) |
| Storage | localStorage for statistics persistence |

### Dependencies

All dependencies loaded from CDN (no npm install required):

```
pitchy           → esm.sh
@mediapipe/tasks-vision → esm.sh + jsDelivr (WASM binaries)
```

#### Offline Use
1. Download `pitchy` and save as `pitchy.js`
2. Download MediaPipe Tasks Vision bundle and WASM files
3. Update import paths in `index.html` to local files

## Project Structure

```
resonance/
├── index.html    # Complete application (HTML + CSS + JS)
├── README.md     # This file
└── .gitignore    # Git ignore rules
```

Yes, the entire app is a single HTML file. No bundler, no framework, no build step.

## Contributing

Contributions are welcome! Some ideas for future development:

- [ ] PWA support for offline use
- [ ] Recording and playback of practice sessions
- [ ] Scale and arpeggio practice modes
- [ ] Export statistics to CSV/JSON
- [ ] Tuning temperament options (Pythagorean, meantone, etc.)
- [ ] Left-handed mode

To contribute:
1. Fork the repository
2. Create a feature branch
3. Make your changes to `index.html`
4. Test in multiple browsers
5. Submit a pull request

## License

MIT License — free for personal and commercial use.

---

<div align="center">

*Built for violinists, by a violinist.*

</div>
