import { getElement } from '../shared';
import { Landmark, PostureFlags, POSE, postureState } from '../types';

// Functions in this file:
//	 - analyzePosture() - exported, analyzes pose and hand landmarks
//   - updatePostureUI() - exported, updates the posture flags in the U

// ---------- Posture Analysis ----------
const flagShoulder = getElement<HTMLSpanElement>('flag-shoulder');
const flagWrist = getElement<HTMLSpanElement>('flag-wrist');
const flagViolin = getElement<HTMLSpanElement>('flag-violin');

const HAND = {
  WRIST: 0,
  INDEX_MCP: 5,
  PINKY_MCP: 17,
  MIDDLE_MCP: 9
};

export function analyzePosture(poseLandmarks: Landmark[][] | undefined, handLandmarks: Landmark[][] | undefined): PostureFlags {
  const flags: PostureFlags = { shoulderRaised: false, wristCollapsed: false, violinDrooping: false };

  if (poseLandmarks && poseLandmarks.length > 0) {
	const pose = poseLandmarks[0]!;

	const leftShoulder = pose[POSE.LEFT_SHOULDER];
	const rightShoulder = pose[POSE.RIGHT_SHOULDER];
	const leftEar = pose[POSE.LEFT_EAR];

	if (leftShoulder && rightShoulder && leftEar) {
	  const shoulderDiff = rightShoulder.y - leftShoulder.y;
	  const earToShoulder = leftShoulder.y - leftEar.y;

	  if (shoulderDiff > 0.04 || earToShoulder < 0.12) {
		flags.shoulderRaised = true;
	  }
	}

	const leftElbow = pose[POSE.LEFT_ELBOW];
	if (leftShoulder && leftElbow) {
	  const elbowDrop = leftElbow.y - leftShoulder.y;
	  if (elbowDrop > 0.15) {
		flags.violinDrooping = true;
	  }
	}
  }

  if (handLandmarks && handLandmarks.length > 0) {
	for (const hand of handLandmarks) {
	  const wrist = hand[HAND.WRIST];
	  const indexMcp = hand[HAND.INDEX_MCP];
	  const pinkyMcp = hand[HAND.PINKY_MCP];
	  const middleMcp = hand[HAND.MIDDLE_MCP];

	  if (wrist && middleMcp) {
		const dy = middleMcp.y - wrist.y;

		if (pinkyMcp && indexMcp) {
		  const spread = Math.abs(pinkyMcp.x - indexMcp.x);
		  if (spread < 0.05 && Math.abs(dy) < 0.08) {
			flags.wristCollapsed = true;
		  }
		}

		if (wrist.y - middleMcp.y > 0.06) {
		  flags.wristCollapsed = true;
		}
	  }
	}
  }

  return flags;
}

export function updatePostureUI(flags: PostureFlags): PostureFlags {
  const now = Date.now();
  if (now - postureState.lastUpdate > 150) {
	postureState.shoulderRaised = flags.shoulderRaised;
	postureState.wristCollapsed = flags.wristCollapsed;
	postureState.violinDrooping = flags.violinDrooping;
	postureState.lastUpdate = now;
	}
	const shoulderRaised = postureState.shoulderRaised;
	const wristCollapsed = postureState.wristCollapsed;
	const violinDrooping = postureState.violinDrooping;

	flagShoulder.className = 'posture-flag' + (postureState.shoulderRaised ? ' warn' : ' ok');
	flagWrist.className = 'posture-flag' + (postureState.wristCollapsed ? ' warn' : ' ok');
	flagViolin.className = 'posture-flag' + (postureState.violinDrooping ? ' warn' : ' ok');

	return { shoulderRaised, wristCollapsed, violinDrooping };
}