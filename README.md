<div align="center">

# Resonance

**Real-time violin practice companion with AI-powered feedback**

A tool for self-teaching violinists that provides instant intonation feedback, posture analysis, and personalized insights — like having a teacher watch over your shoulder.

[Features](#features) · [Getting Started](#getting-started) · [How It Works](#how-it-works) · [Tech Stack](#tech-stack)

</div>

---

## Overview

Resonance combines real-time pitch detection with computer vision to help violinists practice more effectively. It listens to your playing, watches your form, and identifies patterns between the two — alerting you when posture issues affect your intonation.

Open it in a browser, grant microphone/camera access, and start practicing.
## Project Structure

```
/src
  main.ts           # App entry point, event handlers, main loop
  types.ts          # Shared type definitions
  shared.ts         # Shared DOM elements and utilities
  /features
    audio.ts        # Pitch/frequency utilities (freqToNote, noteToFreq)
    drone.ts        # Drone generator (start, stop, volume, note selection)
    vision.ts       # MediaPipe camera/pose detection
    posture.ts      # Posture analysis and UI flags
    insights.ts     # Correlated pitch/posture insights
    stats.ts        # Practice statistics tracking
  /cosmetic
    cosmetics.ts    # Visual rendering (meter, fingerboard)
	styles.css		# css styling file
  /api
    ask.ts          # Frontend API call to Flask backend
    notes.md        # Learning notes
/api
  ask.py            # Flask backend for AI coach
  requirements.txt
index.html          # Entry point
vite.config.ts      # Vite configuration
tsconfig.json       # TypeScript configuration
```

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

### AI Coach (Agentic)
An AI coach that can analyze your playing and take actions:
- **"Ask Coach" button** in the Feedback tab sends your data for analysis
- Analyzes your pitch accuracy data and current posture flags
- **Agentic tools**: coach can control the drone (set note, volume, toggle on/off)
- Structured JSON response format enables automated actions
- Powered by Gemini API (free tier) via Flask backend

### User Interface
- **Three-tab layout**:
  - **Setup**: Tuning meter for A4 calibration
  - **Practice**: Fingerboard visualization + optional camera toggle
  - **Feedback**: Stats, drone controls, AI coach
- **Camera toggle**: Enable posture tracking on-demand in Practice tab
- **Dark, warm aesthetic** designed for low-light practice rooms
- **Responsive design** works on desktop and mobile
- **Single-page app** — no navigation, no distractions

## Getting Started

### Frontend Setup
```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server
```

### Backend Setup (AI Coach)
```bash
cd api
python -m venv .venv
.\.venv\Scripts\Activate.ps1   # Windows PowerShell
# source .venv/bin/activate    # Mac/Linux
pip install -r requirements.txt
```

Set your API key (get one free at https://aistudio.google.com/apikey):
```bash
set GEMINI_API_KEY=your-key-here   # Windows
# export GEMINI_API_KEY=your-key   # Mac/Linux
```

Run Flask:
```bash
flask --app ask run
```

### Quick Start
1. Start both frontend (`npm run dev`) and backend (`flask --app ask run`)
2. Open the dev server URL in browser (Chrome or Edge recommended)
3. Click **Start** to begin
4. Grant microphone and camera permissions when prompted
5. Start playing!

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
| Frontend | TypeScript + Vite |
| Backend | Flask (Python) |
| AI | Google Gemini API (free tier) |
| Audio Input | Web Audio API (`getUserMedia` + `AnalyserNode`) |
| Pitch Detection | [pitchy](https://github.com/ianprime0509/pitchy) (McLeod Pitch Method) |
| Computer Vision | [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker) |
| Fonts | Fraunces (display), Spline Sans Mono (UI) |
| Storage | localStorage for statistics persistence |

### Dependencies

**Frontend (npm):**
- `vite` - Build tool and dev server
- `typescript` - Type checking
- `pitchy` - Pitch detection
- `@mediapipe/tasks-vision` - Pose/hand tracking

**Backend (pip):**
- `flask` - Web framework
- `google-generativeai` - Gemini API SDK

## Architecture

```
resonance/
├── src/
│   ├── main.ts            # Entry point, event handlers, main loop
│   ├── types.ts           # TypeScript interfaces
│   ├── shared.ts          # Shared DOM elements (canvas, buttons)
│   ├── styles.css         # Styling
│   ├── features/          # Feature modules
│   │   ├── audio.ts       # Pitch utilities
│   │   ├── drone.ts       # Drone generator
│   │   ├── vision.ts      # MediaPipe integration
│   │   ├── posture.ts     # Posture analysis
│   │   ├── insights.ts    # Pitch/posture correlation
│   │   └── stats.ts       # Statistics tracking
│   ├── cosmetic/
│   │   └── cosmetics.ts   # Visual rendering
│   └── api/
│       └── ask.ts         # Frontend API client
├── api/
│   ├── ask.py             # Flask endpoint for AI coach
│   └── requirements.txt
├── index.html             # Entry point
├── vite.config.ts         # Vite config
├── tsconfig.json          # TypeScript config
└── package.json           # Node dependencies
```

Frontend built with Vite + TypeScript. Backend uses Flask to proxy requests to Gemini API.

## Contributing

Contributions are welcome! Some ideas for future development:

- [x] AI coach tools (set drone, adjust metronome, start drills)
- [ ] PWA support for offline use
- [ ] Recording and playback of practice sessions
- [ ] Scale and arpeggio practice modes
- [ ] Export statistics to CSV/JSON
- [ ] Tuning temperament options (Pythagorean, meantone, etc.)
- [ ] Left-handed mode

To contribute:
1. Fork the repository
2. Create a feature branch
3. Make your changes in `src/`
4. Test in multiple browsers
5. Submit a pull request

## License

MIT License — free for personal and commercial use.

---

<div align="center">

*Built for violinists, by a violinist.*

</div>
