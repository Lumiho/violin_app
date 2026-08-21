import { PoseLandmarker, HandLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { POSE } from '../types';
import { getElement } from './shared';
import { analyzePosture, updatePostureUI } from './posture';
import { recordObservation, updateInsightsUI } from './insights';
import { freqToNote } from './audio';

// Functions in this file:
//   - initMediaPipe() - exported, initializes MediaPipe models
//   - startVision() - exported, starts camera and vision loop
//   - stopVision() - exported, stops camera
//   - visionLoop() - internal, processes video frames
//   - isVisionRunning() - exported, returns whether vision is active

// ---------- DOM Elements ----------
const video = getElement<HTMLVideoElement>('video');
const overlayCanvas = getElement<HTMLCanvasElement>('overlay');
const overlayCtx = overlayCanvas.getContext('2d')!;
const hint = getElement<HTMLDivElement>('hint');

// ---------- State ----------
let poseLandmarker: PoseLandmarker | null = null;
let handLandmarker: HandLandmarker | null = null;
let videoStream: MediaStream | null = null;
let visionRunning = false;
let lastVideoTime = -1;

// ---------- External state (passed from main) ----------
let getCurrentPhase: () => string = () => 'pitch';
let getPitchData: () => { hasPitch: boolean; lastPitch: number; lastCents: number; a4: number } = () => ({
	hasPitch: false,
	lastPitch: 0,
	lastCents: 0,
	a4: 440
});

// ---------- Setup callbacks ----------
export function setVisionCallbacks(
	phaseGetter: () => string,
	pitchGetter: () => { hasPitch: boolean; lastPitch: number; lastCents: number; a4: number }
): void {
	getCurrentPhase = phaseGetter;
	getPitchData = pitchGetter;
}

// ---------- Helpers ----------
function fitOverlayCanvas(): void {
	if (video.videoWidth && video.videoHeight) {
		overlayCanvas.width = video.videoWidth;
		overlayCanvas.height = video.videoHeight;
	}
}

export function isVisionRunning(): boolean {
	return visionRunning;
}

// ---------- MediaPipe initialization ----------
export async function initMediaPipe(): Promise<boolean> {
	hint.textContent = 'Loading pose detection...';

	try {
		const vision = await FilesetResolver.forVisionTasks(
			'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
		);

		poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
				delegate: 'GPU'
			},
			runningMode: 'VIDEO',
			numPoses: 1
		});

		handLandmarker = await HandLandmarker.createFromOptions(vision, {
			baseOptions: {
				modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
				delegate: 'GPU'
			},
			runningMode: 'VIDEO',
			numHands: 2
		});

		return true;
	} catch (e) {
		console.error('MediaPipe init failed:', e);
		hint.textContent = 'Pose detection unavailable. Check console for details.';
		return false;
	}
}

// ---------- Vision start/stop ----------
export async function startVision(): Promise<void> {
	if (visionRunning) return;

	if (!poseLandmarker || !handLandmarker) {
		const ok = await initMediaPipe();
		if (!ok) return;
	}

	try {
		videoStream = await navigator.mediaDevices.getUserMedia({
			video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
		});
		video.srcObject = videoStream;
		await video.play();
		fitOverlayCanvas();
		visionRunning = true;
		visionLoop();
	} catch (e) {
		hint.textContent = 'Camera blocked. Check permissions.';
		console.error(e);
	}
}

export function stopVision(): void {
	visionRunning = false;
	if (videoStream) {
		videoStream.getTracks().forEach(t => t.stop());
		videoStream = null;
	}
	video.srcObject = null;
}

// ---------- Vision loop ----------
function visionLoop(): void {
	if (!visionRunning) return;

	if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
		lastVideoTime = video.currentTime;
		const timestamp = performance.now();

		const poseResults = poseLandmarker!.detectForVideo(video, timestamp);
		const handResults = handLandmarker!.detectForVideo(video, timestamp);

		overlayCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

		const drawingUtils = new DrawingUtils(overlayCtx);

		if (poseResults.landmarks && poseResults.landmarks.length > 0) {
			for (const landmarks of poseResults.landmarks) {
				drawingUtils.drawConnectors(landmarks, [
					{ start: POSE.LEFT_SHOULDER, end: POSE.RIGHT_SHOULDER },
					{ start: POSE.LEFT_SHOULDER, end: POSE.LEFT_ELBOW },
					{ start: POSE.LEFT_ELBOW, end: POSE.LEFT_WRIST },
					{ start: POSE.RIGHT_SHOULDER, end: POSE.LEFT_SHOULDER }
				], { color: 'rgba(224, 168, 80, 0.5)', lineWidth: 2 });

				const keyPoints = [POSE.LEFT_SHOULDER, POSE.RIGHT_SHOULDER, POSE.LEFT_ELBOW, POSE.LEFT_WRIST];
				for (const idx of keyPoints) {
					const lm = landmarks[idx];
					if (lm) {
						overlayCtx.fillStyle = 'rgba(224, 168, 80, 0.8)';
						overlayCtx.beginPath();
						overlayCtx.arc(lm.x * overlayCanvas.width, lm.y * overlayCanvas.height, 4, 0, Math.PI * 2);
						overlayCtx.fill();
					}
				}
			}
		}

		if (handResults.landmarks && handResults.landmarks.length > 0) {
			for (const landmarks of handResults.landmarks) {
				drawingUtils.drawConnectors(landmarks, HandLandmarker.HAND_CONNECTIONS,
					{ color: 'rgba(143, 191, 106, 0.5)', lineWidth: 1 });
				drawingUtils.drawLandmarks(landmarks, { color: 'rgba(143, 191, 106, 0.8)', radius: 2 });
			}
		}

		const flags = analyzePosture(poseResults.landmarks, handResults.landmarks);
		updatePostureUI(flags);

		const currentPhase = getCurrentPhase();
		if (currentPhase === 'posture') {
			const { hasPitch, lastPitch, lastCents, a4 } = getPitchData();
			recordObservation(
				hasPitch ? freqToNote(lastPitch, a4) : null,
				hasPitch ? lastCents : 0,
				flags
			);
			updateInsightsUI();
		}
	}

	requestAnimationFrame(visionLoop);
}

// ---------- Window resize handling ----------
window.addEventListener('resize', fitOverlayCanvas);
