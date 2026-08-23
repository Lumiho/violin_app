import { getElement, getElements, canvas, ctx, fbNoteLabels } from '../shared';
import { stringNotes, noteToPosition } from '../types';

// Cosmetic-related functions

// ---------- accuracy thresholds (cents) ----------
const CENTS_PERFECT = 5;    // Perfect intonation (green glow)
const CENTS_IN_TUNE = 10;   // Acceptable intonation
const CENTS_CLOSE = 18;     // Close but needs work (amber)

// Fingerboard elements
const fingerboard = getElement<HTMLDivElement>('fingerboard');
const fbMarker = getElement<HTMLDivElement>('fb-marker');
const fbFingerNum = getElement<HTMLSpanElement>('fb-finger-num');
const fbStrings = getElements<HTMLDivElement>('.fb-string');

// ---------- meter drawing ----------
export function drawMeter(cents: number, active: boolean): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h * 0.96;
  const R = Math.min(w * 0.46, h * 0.92);
  const span = Math.PI * 0.78;
  const start = -Math.PI / 2 - span / 2;
  const end = -Math.PI / 2 + span / 2;

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#3a2d22';
  ctx.beginPath();
  ctx.arc(cx, cy, R, start, end);
  ctx.stroke();

  for (let c = -50; c <= 50; c += 10) {
	const ang = -Math.PI / 2 + (c / 50) * (span / 2);
	const major = c === 0;
	const r1 = R - (major ? 16 : 9);
	const x1 = cx + Math.cos(ang) * r1;
	const y1 = cy + Math.sin(ang) * r1;
	const x2 = cx + Math.cos(ang) * R;
	const y2 = cy + Math.sin(ang) * R;
	ctx.lineWidth = major ? 2.5 : 1.2;
	ctx.strokeStyle = major ? '#e0a850' : '#5a4836';
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();
  }

  const zone = (15 / 50) * (span / 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = active && Math.abs(cents) < CENTS_PERFECT
	? 'rgba(143,191,106,.9)' : 'rgba(143,191,106,.18)';
  ctx.beginPath();
  ctx.arc(cx, cy, R, -Math.PI / 2 - zone, -Math.PI / 2 + zone);
  ctx.stroke();

  ctx.fillStyle = '#6a5642';
  ctx.font = "11px 'Spline Sans Mono', monospace";
  ctx.textAlign = 'center';
  ctx.fillText('♭', cx + Math.cos(start) * (R + 16), cy + Math.sin(start) * (R + 16) + 4);
  ctx.fillText('♯', cx + Math.cos(end) * (R + 16), cy + Math.sin(end) * (R + 16) + 4);

  const ang = -Math.PI / 2 + (cents / 50) * (span / 2);
  const nLen = R - 4;
  const tipX = cx + Math.cos(ang) * nLen;
  const tipY = cy + Math.sin(ang) * nLen;

  const col = !active ? '#5a4836'
	: Math.abs(cents) < CENTS_PERFECT ? '#8fbf6a'
	: Math.abs(cents) < CENTS_CLOSE ? '#e0a850' : '#d8694e';

  ctx.shadowColor = active ? col : 'transparent';
  ctx.shadowBlur = active ? 14 : 0;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = col;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.arc(cx, cy, 2.4, 0, Math.PI * 2);
  ctx.fill();
}

export function generateNoteLabels(): void {
  fbNoteLabels.innerHTML = '';

  const guidesEl = document.querySelector('.fb-position-guides')!;
  const guideDivs = guidesEl.querySelectorAll('.fb-guide');
  const labelsRect = fbNoteLabels.getBoundingClientRect();

  const linePositions: number[] = [];
  guideDivs.forEach((div) => {
	const divRect = div.getBoundingClientRect();
	linePositions.push(divRect.top - labelsRect.top);
  });
  linePositions.push(labelsRect.height);

  function getY(finger: number): number {
	const floor = Math.floor(finger);
	const frac = finger - floor;
	const y1 = linePositions[floor] ?? 0;
	const y2 = linePositions[floor + 1] ?? linePositions[linePositions.length - 1] ?? 0;
	return y1 + frac * (y2 - y1);
  }

  fbStrings.forEach((stringEl, stringIndex) => {
	const stringRect = stringEl.getBoundingClientRect();
	const stringCenterX = stringRect.left + stringRect.width / 2 - labelsRect.left;

	const notes = stringNotes[stringIndex];
	notes?.forEach(({ f, n }) => {
	  const y = getY(f);

	  const label = document.createElement('span');
	  label.className = 'fb-note-label' + (n.includes('♯') ? ' sharp' : '');
	  label.textContent = n;
	  label.style.left = (stringCenterX + 10) + 'px';
	  label.style.top = y + 'px';

	  fbNoteLabels.appendChild(label);
	});
  });
}

// ---------- Fingerboard visualization ----------
export function updateFingerboard(noteName: string | null, octave: number, cents: number): void {
  fbStrings.forEach(s => s.classList.remove('active-string'));

  if (!noteName) {
	fbMarker.classList.remove('visible', 'in-tune', 'off');
	return;
  }

  const noteKey = noteName + octave;
  const pos = noteToPosition[noteKey];

  if (!pos) {
	fbMarker.classList.remove('visible', 'in-tune', 'off');
	return;
  }

  const fbRect = fingerboard.getBoundingClientRect();
  const targetString = fbStrings[pos.string];
  if (!targetString) return;

  targetString.classList.add('active-string');

  const stringRect = targetString.getBoundingClientRect();
  const stringCenterX = stringRect.left + stringRect.width / 2 - fbRect.left;

  const guidesEl = document.querySelector('.fb-position-guides')!;
  const guideDivs = guidesEl.querySelectorAll('.fb-guide');
  const guidesRect = guidesEl.getBoundingClientRect();

  const linePositions: number[] = [];
  guideDivs.forEach((div) => {
	const divRect = div.getBoundingClientRect();
	linePositions.push(divRect.top - guidesRect.top);
  });
  linePositions.push(guidesRect.height);

  function getFingerY(finger: number): number {
	const floor = Math.floor(finger);
	const frac = finger - floor;
	const y1 = linePositions[floor] ?? 0;
	const y2 = linePositions[floor + 1] ?? linePositions[linePositions.length - 1] ?? 0;
	return y1 + frac * (y2 - y1);
  }

  const topPadding = guidesRect.top - fbRect.top;
  let baseY = topPadding + getFingerY(pos.finger);

  const nextY = topPadding + getFingerY(pos.finger + 1);
  const localSpacing = nextY - baseY;
  const centsOffset = (cents / 50) * (localSpacing * 0.5);
  const finalY = baseY + centsOffset;

  const clampedY = Math.max(topPadding, Math.min(fbRect.height - 15, finalY));

  fbMarker.style.left = stringCenterX + 'px';
  fbMarker.style.top = clampedY + 'px';
  fbMarker.classList.add('visible');

  const fingerNum = Math.round(pos.finger);
  fbFingerNum.textContent = String(fingerNum);

  const absCents = Math.abs(cents);
  fbMarker.classList.remove('in-tune', 'off');

  if (absCents < CENTS_IN_TUNE) {
	fbMarker.classList.add('in-tune');
  } else if (absCents > CENTS_CLOSE) {
	fbMarker.classList.add('off');
  }
}

export function clearFingerboard(): void {
  fbMarker.classList.remove('visible', 'in-tune', 'off');
  fbStrings.forEach(s => s.classList.remove('active-string'));
}