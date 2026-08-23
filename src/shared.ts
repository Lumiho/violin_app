// ---------- Helper to get elements with null checks ----------
export function getElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Element #${id} not found`);
  return el as T;
}

export function getElements<T extends HTMLElement>(selector: string): T[] {
  return [...document.querySelectorAll<T>(selector)];
}

// ---------- Shared element references ----------
export const canvas = getElement<HTMLCanvasElement>('meter');
export const ctx = canvas.getContext('2d')!;

export const droneToggle = getElement<HTMLButtonElement>('drone-toggle');
export const droneVolumeInput = getElement<HTMLInputElement>('drone-volume');

export const fbNoteLabels = getElement<HTMLDivElement>('fb-note-labels');