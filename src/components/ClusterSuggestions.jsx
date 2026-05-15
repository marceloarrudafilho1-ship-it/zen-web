// "These addresses look related — open them as tabs?" panel.
// Sits between the wallet tabs and the analytics split. Auto-hides when there
// are no candidates, when the user dismisses it for this wallet, or when every
// candidate is already opened as its own tab.

import { useMemo, useState } from 'react';
import { fmtUsd, shortAddr } from '../lib/format.js';
import { Plus, Close } from './Icons.jsx';
import { AddressNoteChip } from './AddressNote.jsx';
import { ExplorerLink } from './ExplorerLink.jsx';
import { EnsChip } from './EnsName.jsx';

const MAX_VISIBLE = 6;

export function ClusterSuggestions({ wallet, openTabs, onOpen }) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const candidates = wallet.result?.clusterCandidates || [];

  // Filter out anything already opened as its own tab on the same chain.
  const open = useMemo(() => {
    const s = new Set();
    for (const w of openTabs) {
      const key = w.chain === 'solana' ? w.address : w.address.toLowerCase();
      s.add(`${w.chain}:${key}`);
    }
    return s;
  }, [openTabs]);

  const filtered = useMemo(() => candidates.filter(c => {
    const key = c.chain === 'solana' ? c.address : c.address.toLowerCase();
    return !open.has(`${c.chain}:${key}`);
  }), [candidates, open]);

  if (dismissed || filtered.length === 0) return null;

  const visible = expanded ? filtered : filtered.slice(0, MAX_VISIBLE);
  const more = filtered.length - visible.length;

  return (
    <div className="card border-zen-accent/30 bg-zen-accent/5 p-3 fade-in">
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <div className="flex items-baseline gap-2 min-w-0">
          <h3 className="text-xs font-semibold text-zen-accent uppercase tracking-wider">Related addresses</h3>
          <p className="text-[11px] text-zen-muted truncate">
            Frequent counterparties of this wallet — open as tabs to keep tracing.
          </p>
        </div>
        <button onClick={() => setDismissed(true)}
          className="text-zen-muted hover:text-zen-text shrink-0" title="Dismiss">
          <Close size={14} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {visible.map(c => (
          <ClusterChip key={c.address} candidate={c} onOpen={() => onOpen(c)} />
        ))}
        {more > 0 && (
          <button onClick={() => setExpanded(true)}
            className="text-[11px] px-2.5 py-1 rounded text-zen-muted hover:text-zen-accent hover:bg-zen-accent/10 transition">
            + {more} more
          </button>
        )}
      </div>
    </div>
  );
}

function ClusterChip({ candidate, onOpen }) {
  const dirHint = candidate.outCount > candidate.inCount ? '→' : candidate.inCount > candidate.outCount ? '←' : '↔';
  return (
    <div className="flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-md bg-zen-panel ring-1 ring-zen-border hover:ring-zen-accent/40 transition group">
      <span className="text-zen-muted text-[10px]">{dirHint}</span>
      <span className="mono text-[11px] text-zen-text">{shortAddr(candidate.address)}</span>
      <EnsChip chain={candidate.chain} address={candidate.address} />
      <span className="text-[10px] text-zen-muted">
        {candidate.txCount}× · {candidate.totalUsd > 0 ? fmtUsd(candidate.totalUsd) : candidate.sampleSymbol}
      </span>
      <AddressNoteChip address={candidate.address} chain={candidate.chain} compact />
      <ExplorerLink chain={candidate.chain} kind="address" value={candidate.address} />
      <button onClick={onOpen}
        title="Open as tab"
        className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded
          text-zen-muted hover:text-zen-accent hover:bg-zen-accent/15 transition opacity-70 group-hover:opacity-100">
        <Plus size={11} />
      </button>
    </div>
  );
}
