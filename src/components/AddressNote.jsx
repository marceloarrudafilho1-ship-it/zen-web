// Reusable inline note editor. Two modes:
//
//   `chip`   — small inline pill suitable for list rows. Empty state shows ✎ icon
//              that hovers into "Add note". With a note, shows the text + edit-on-click.
//   `block`  — fuller multi-line block for the Info panel.
//
// All persistence runs through src/lib/notes.js — the component just renders and
// lets the user edit. Subscribes so other instances of the same address update live.

import { useEffect, useRef, useState } from 'react';
import { getNote, setNote, subscribeNotes } from '../lib/notes.js';
import { Tag } from './Icons.jsx';

export function useNoteFor(address, chain) {
  const [note, setLocal] = useState(() => getNote(address, chain));
  useEffect(() => {
    setLocal(getNote(address, chain));
    const unsub = subscribeNotes(() => setLocal(getNote(address, chain)));
    return () => unsub();
  }, [address, chain]);
  return note;
}

export function AddressNoteChip({ address, chain, compact = false }) {
  const note = useNoteFor(address, chain);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft(note || '');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing]);

  if (!address) return null;

  const commit = () => {
    setNote(address, chain, draft);
    setEditing(false);
  };
  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={commit}
          placeholder="victim's wallet…"
          className="text-[11px] px-1.5 py-0.5 rounded bg-zen-panel ring-1 ring-zen-accent/50
            text-zen-text outline-none w-32"
        />
      </span>
    );
  }

  if (note) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        title="Click to edit note"
        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded
          bg-zen-accent/15 text-zen-accent ring-1 ring-zen-accent/40 hover:bg-zen-accent/25 transition truncate max-w-[140px]"
      >
        <Tag size={9} />
        <span className="truncate">{note}</span>
      </button>
    );
  }

  if (compact) return null;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      title="Add a private note"
      className="inline-flex items-center gap-1 text-[10px] px-1 py-0.5 rounded
        text-zen-muted hover:text-zen-accent hover:bg-zen-accent/10 transition opacity-50 hover:opacity-100"
    >
      <Tag size={9} />
    </button>
  );
}

export function AddressNoteBlock({ address, chain }) {
  const note = useNoteFor(address, chain);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) {
      setDraft(note || '');
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [editing]);

  if (!address) return null;

  const commit = () => {
    setNote(address, chain, draft);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-2">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
          }}
          rows={2}
          placeholder="e.g. victim wallet 2 · scammer A · hop receiver"
          className="w-full text-xs px-2.5 py-1.5 rounded-md bg-zen-panel ring-1 ring-zen-accent/40
            text-zen-text outline-none resize-none"
        />
        <div className="flex items-center gap-2">
          <button onClick={commit} className="text-[11px] px-2.5 py-1 rounded bg-zen-accent/20 text-zen-accent ring-1 ring-zen-accent/40 hover:bg-zen-accent/30">
            Save
          </button>
          <button onClick={() => setEditing(false)} className="text-[11px] px-2.5 py-1 rounded text-zen-muted hover:text-zen-text">
            Cancel
          </button>
          {note && (
            <button onClick={() => { setNote(address, chain, ''); setEditing(false); }}
              className="text-[11px] px-2.5 py-1 rounded text-zen-red hover:bg-zen-red/10 ml-auto">
              Delete
            </button>
          )}
        </div>
      </div>
    );
  }

  if (note) {
    return (
      <button onClick={() => setEditing(true)}
        className="block w-full text-left p-2 rounded-md bg-zen-accent/10 ring-1 ring-zen-accent/30 hover:ring-zen-accent/50 transition group">
        <div className="flex items-start gap-2">
          <span className="text-zen-accent mt-0.5"><Tag size={11} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-zen-accent/80 mb-0.5">Note</div>
            <div className="text-xs text-zen-text whitespace-pre-wrap break-words">{note}</div>
          </div>
          <span className="text-[9px] text-zen-muted opacity-0 group-hover:opacity-100">edit</span>
        </div>
      </button>
    );
  }

  return (
    <button onClick={() => setEditing(true)}
      className="text-[11px] px-2.5 py-1 rounded-md ring-1 ring-dashed ring-zen-border text-zen-muted hover:text-zen-accent hover:ring-zen-accent/40 transition inline-flex items-center gap-1.5">
      <Tag size={10} /> Add note
    </button>
  );
}
