// Runtime-switchable accent theme. The two accent colors flow into the rest of
// the UI through CSS variables (`--zen-accent-rgb`, `--zen-accent2-rgb`, both
// space-separated R G B triples consumed by Tailwind's `<alpha-value>` syntax).
// Components that hand raw hex strings to SVG / recharts / reactflow use the
// `useTheme()` hook to re-render when the user picks a new palette.

import { useEffect, useState } from 'react';

export const PALETTES = [
  { id: 'rose',    name: 'Rose',    hex: '#fb7185', hex2: '#f472b6' },
  { id: 'sky',     name: 'Sky',     hex: '#38bdf8', hex2: '#60a5fa' },
  { id: 'emerald', name: 'Emerald', hex: '#34d399', hex2: '#10b981' },
  { id: 'amber',   name: 'Amber',   hex: '#fbbf24', hex2: '#f59e0b' },
  { id: 'violet',  name: 'Violet',  hex: '#a78bfa', hex2: '#8b5cf6' },
  { id: 'fuchsia', name: 'Fuchsia', hex: '#e879f9', hex2: '#c026d3' },
  { id: 'orange',  name: 'Orange',  hex: '#fb923c', hex2: '#f97316' },
  { id: 'teal',    name: 'Teal',    hex: '#2dd4bf', hex2: '#14b8a6' },
  { id: 'cyan',    name: 'Cyan',    hex: '#22d3ee', hex2: '#06b6d4' },
  { id: 'indigo',  name: 'Indigo',  hex: '#818cf8', hex2: '#6366f1' },
];

const STORAGE_KEY = 'zen.theme.v1';

function rgbTuple(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function applyToDom(p) {
  if (typeof document === 'undefined') return;
  const r = document.documentElement;
  r.style.setProperty('--zen-accent', p.hex);
  r.style.setProperty('--zen-accent2', p.hex2);
  r.style.setProperty('--zen-accent-rgb', rgbTuple(p.hex));
  r.style.setProperty('--zen-accent2-rgb', rgbTuple(p.hex2));
  paintTaskbarIcon(p);
}

// Re-renders the window/taskbar icon in the active palette by painting the
// Logo (circle + Z) onto an offscreen canvas, then handing the PNG to the
// Electron main process via the preload bridge. No-op outside Electron.
function paintTaskbarIcon(p) {
  if (typeof document === 'undefined') return;
  if (typeof window === 'undefined' || !window.zenElectron?.setIcon) return;
  try {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, p.hex);
    grad.addColorStop(1, p.hex2);
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const sc = size / 32; // Logo SVG is authored in a 32×32 viewBox.

    // Outer circle (r=14, stroke 1.5px in source units).
    ctx.lineWidth = 1.5 * sc;
    ctx.beginPath();
    ctx.arc(16 * sc, 16 * sc, 14 * sc, 0, Math.PI * 2);
    ctx.stroke();

    // "Z" stroke: top bar, diagonal, bottom bar.
    ctx.lineWidth = 2 * sc;
    ctx.beginPath();
    ctx.moveTo(10 * sc, 11 * sc);
    ctx.lineTo(22 * sc, 11 * sc);
    ctx.lineTo(10 * sc, 21 * sc);
    ctx.lineTo(22 * sc, 21 * sc);
    ctx.stroke();

    window.zenElectron.setIcon(canvas.toDataURL('image/png'));
  } catch (err) {
    console.warn('paintTaskbarIcon failed:', err);
  }
}

let current = PALETTES[0];
const subs = new Set();

export function getTheme() { return current; }

export function setTheme(p) {
  current = p;
  applyToDom(p);
  try { localStorage.setItem(STORAGE_KEY, p.id); } catch {}
  for (const cb of subs) { try { cb(p); } catch (e) { console.warn(e); } }
}

export function subscribeTheme(cb) {
  subs.add(cb);
  return () => subs.delete(cb);
}

export function useTheme() {
  const [t, setT] = useState(current);
  useEffect(() => subscribeTheme(setT), []);
  return t;
}

// Initialize from storage on import so the first paint has the right colors.
try {
  const id = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  const p = PALETTES.find(x => x.id === id) || PALETTES[0];
  current = p;
  applyToDom(p);
} catch {}
