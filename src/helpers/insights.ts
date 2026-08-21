import { Insight, Observation, NoteInfo, PostureFlags } from '../types';
import { getElement } from './shared';

// Functions in this file:
//	 - recordObservation() - exported, logs pitch + posture
//   - analyzeCorrelations() - internal, finds patterns
//   - updateInsightsUI() - exported, renders to DOM

const insightMain = getElement<HTMLDivElement>('insight-main');

// ----------  Correlation Engine ----------
const correlationWindow = 5000;
const observations: Observation[] = [];

let currentInsight: Insight | null = null;
let insightCooldown = 0;

export function recordObservation(pitch: NoteInfo | null, cents: number, posture: PostureFlags): void {
  const now = Date.now();
  observations.push({ time: now, pitch, cents, ...posture });
  while (observations.length > 0 && observations[0]!.time < now - correlationWindow) {
	observations.shift();
  }
}

function analyzeCorrelations(): Insight | null {
  if (observations.length < 10) return null;

  const now = Date.now();
  if (insightCooldown > now) return currentInsight;

  const noteGroups: Record<string, Observation[]> = {};
  for (const obs of observations) {
	if (!obs.pitch) continue;
	const key = obs.pitch.name + obs.pitch.octave;
	if (!noteGroups[key]) noteGroups[key] = [];
	noteGroups[key].push(obs);
  }

  for (const [note, group] of Object.entries(noteGroups)) {
	if (group.length < 3) continue;

	const avgCents = group.reduce((s, o) => s + o.cents, 0) / group.length;
	const wristIssues = group.filter(o => o.wristCollapsed).length / group.length;
	const shoulderIssues = group.filter(o => o.shoulderRaised).length / group.length;
	const violinIssues = group.filter(o => o.violinDrooping).length / group.length;

	if (Math.abs(avgCents) > 12) {
	  const direction = avgCents > 0 ? 'sharp' : 'flat';

	  if (wristIssues > 0.5) {
		currentInsight = {
		  type: 'wrist-pitch',
		  note,
		  direction,
		  cents: Math.abs(Math.round(avgCents)),
		  message: `Your <span class="highlight">${note}</span> tends ${Math.round(Math.abs(avgCents))}¢ ${direction} when your wrist collapses.`,
		  advice: 'Try keeping your left wrist straighter — it affects finger placement.'
		};
		insightCooldown = now + 8000;
		return currentInsight;
	  }

	  if (shoulderIssues > 0.5) {
		currentInsight = {
		  type: 'shoulder-pitch',
		  note,
		  direction,
		  cents: Math.abs(Math.round(avgCents)),
		  message: `Your <span class="highlight">${note}</span> goes ${direction} when your shoulder rises.`,
		  advice: 'Relax your shoulder — tension travels down to your fingers.'
		};
		insightCooldown = now + 8000;
		return currentInsight;
	  }

	  if (violinIssues > 0.5) {
		currentInsight = {
		  type: 'violin-pitch',
		  note,
		  direction,
		  cents: Math.abs(Math.round(avgCents)),
		  message: `<span class="highlight">${note}</span> drifts ${direction} when your violin droops.`,
		  advice: 'Keep the scroll up — it changes the angle of attack for your fingers.'
		};
		insightCooldown = now + 8000;
		return currentInsight;
	  }
	}
  }

  const recent = observations.slice(-20);
  const recentWrist = recent.filter(o => o.wristCollapsed).length / recent.length;
  const recentShoulder = recent.filter(o => o.shoulderRaised).length / recent.length;
  const recentViolin = recent.filter(o => o.violinDrooping).length / recent.length;

  if (recentWrist > 0.6 && (!currentInsight || currentInsight.type !== 'wrist-general')) {
	currentInsight = {
	  type: 'wrist-general',
	  message: 'Your left wrist is consistently <span class="highlight">collapsed</span>.',
	  advice: 'Imagine holding a small ball in your palm to maintain the curve.'
	};
	insightCooldown = now + 6000;
	return currentInsight;
  }

  if (recentShoulder > 0.6 && (!currentInsight || currentInsight.type !== 'shoulder-general')) {
	currentInsight = {
	  type: 'shoulder-general',
	  message: 'Your left shoulder keeps <span class="highlight">rising</span>.',
	  advice: 'Take a breath and let it drop — the violin rests on your collarbone, not your shoulder.'
	};
	insightCooldown = now + 6000;
	return currentInsight;
  }

  if (recentViolin > 0.6 && (!currentInsight || currentInsight.type !== 'violin-general')) {
	currentInsight = {
	  type: 'violin-general',
	  message: 'Your violin is <span class="highlight">drooping</span>.',
	  advice: 'Keep the scroll at eye level or slightly above.'
	};
	insightCooldown = now + 6000;
	return currentInsight;
  }

  return currentInsight;
}

export function updateInsightsUI(): void {
  const insight = analyzeCorrelations();
  if (insight) {
	insightMain.innerHTML = `
	  <div class="correlation">${insight.message}</div>
	  <div style="margin-top: 8px; font-size: 12px; color: var(--ink-faint);">${insight.advice}</div>
	`;
	insightMain.className = 'insight-card' + (insight.type.includes('pitch') ? ' warning' : '');
  } else if (observations.length < 10) {
	insightMain.innerHTML = '<span class="correlation">Keep playing — gathering data...</span>';
	insightMain.className = 'insight-card';
  } else {
	insightMain.innerHTML = '<span class="correlation">Looking good! No issues detected.</span>';
	insightMain.className = 'insight-card';
  }
}