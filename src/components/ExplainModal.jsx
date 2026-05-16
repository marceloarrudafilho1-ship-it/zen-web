// "Explain this wallet" modal. Opens with a streaming connection to
// /api/ai/explain, renders Markdown-ish text as it arrives. Cheap inline
// renderer — bold, italic, headers, bullets, numbered lists — keeps the
// bundle small (no react-markdown dependency).

import { useEffect, useRef, useState } from 'react';
import { explainWallet } from '../api/ai.js';
import { Close, Spinner, Sparkle } from './Icons.jsx';

export function ExplainModal({ open, onClose, wallet }) {
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setText('');
    setDone(false);
    setError(null);

    const summary = walletToSummary(wallet);
    if (!summary) {
      setError('No wallet data available yet — load one first.');
      setDone(true);
      return;
    }

    const ac = new AbortController();
    abortRef.current = ac;

    explainWallet({
      wallet: summary,
      signal: ac.signal,
      onDelta: (d) => setText(prev => prev + d),
    })
      .catch(err => {
        if (err?.name === 'AbortError') return;
        setError(err.message || String(err));
      })
      .finally(() => setDone(true));

    return () => {
      ac.abort();
      abortRef.current = null;
    };
  }, [open, wallet?.id]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 fade-in"
      onClick={onClose}
    >
      <div className="card w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-zen-border shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-zen-accent"><Sparkle size={16} /></span>
            <h2 className="text-lg font-semibold">Wallet analysis</h2>
          </div>
          <button onClick={onClose} className="text-zen-muted hover:text-zen-text transition p-1">
            <Close size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {error ? (
            <div className="text-sm text-zen-red border border-zen-red/30 bg-zen-red/5 rounded-md px-3 py-2.5">
              {error}
            </div>
          ) : text.length === 0 ? (
            <div className="text-sm text-zen-muted flex items-center gap-2">
              <Spinner size={14} /> Analyzing transfers, counterparties, and traces…
            </div>
          ) : (
            <MiniMarkdown text={text} />
          )}
          {text.length > 0 && !done && (
            <span className="inline-block w-2 h-4 ml-1 align-middle bg-zen-accent animate-pulse" />
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-zen-border shrink-0">
          <button className="btn" onClick={onClose}>{done ? 'Close' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  );
}

// Convert the in-app wallet object into the compact shape /api/ai/explain wants.
// The server has its own redundant compactor — this just trims big arrays so
// we don't burn a 4 MB POST body on a 2 KB summary.
function walletToSummary(w) {
  if (!w?.result) return null;
  const r = w.result;
  return {
    address: w.address,
    chain: w.chain,
    transferCount: r.transfers?.length,
    peakUsd: r.extrema?.high?.usd,
    floorUsd: r.extrema?.low?.usd,
    temperature: r.temperature,
    topIn: r.top?.in,
    topOut: r.top?.out,
    topSwap: r.top?.swap,
    clusterCandidates: r.clusterCandidates,
    autoTrace: w.autoTrace?.status === 'done'
      ? { path: w.autoTrace.path, terminationReason: w.autoTrace.terminationReason }
      : null,
  };
}

// Tiny streaming-friendly Markdown subset. Renders headers (#, ##, ###), bold,
// italic, code spans, bullet lists, numbered lists, and paragraphs. We
// deliberately avoid react-markdown because it'd ship 50 KB just to render the
// ~300-word output of one Claude call.
function MiniMarkdown({ text }) {
  const blocks = splitBlocks(text);
  return (
    <div className="text-sm leading-relaxed space-y-3">
      {blocks.map((b, i) => renderBlock(b, i))}
    </div>
  );
}

function splitBlocks(src) {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let buf = [];
  let kind = 'p';

  const flush = () => {
    if (buf.length === 0) return;
    blocks.push({ kind, lines: buf });
    buf = [];
  };

  for (const line of lines) {
    if (!line.trim()) {
      flush();
      kind = 'p';
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      flush();
      blocks.push({ kind: 'h', lines: [line] });
      kind = 'p';
      continue;
    }
    if (/^\s*[-*•]\s/.test(line)) {
      if (kind !== 'ul') flush();
      kind = 'ul';
      buf.push(line);
      continue;
    }
    if (/^\s*\d+[.)]\s/.test(line)) {
      if (kind !== 'ol') flush();
      kind = 'ol';
      buf.push(line);
      continue;
    }
    if (kind !== 'p') flush();
    kind = 'p';
    buf.push(line);
  }
  flush();
  return blocks;
}

function renderBlock(b, i) {
  if (b.kind === 'h') {
    const line = b.lines[0];
    const level = (line.match(/^#+/) || ['#'])[0].length;
    const text = line.replace(/^#{1,3}\s*/, '');
    const cls = level === 1
      ? 'text-base font-semibold text-zen-text'
      : level === 2
        ? 'text-sm font-semibold text-zen-text uppercase tracking-wider mt-2'
        : 'text-sm font-medium text-zen-text';
    return <div key={i} className={cls}>{inline(text)}</div>;
  }
  if (b.kind === 'ul') {
    return (
      <ul key={i} className="list-none space-y-1.5 pl-1">
        {b.lines.map((l, j) => (
          <li key={j} className="flex gap-2 text-zen-text/90">
            <span className="text-zen-accent shrink-0 select-none">·</span>
            <span>{inline(l.replace(/^\s*[-*•]\s+/, ''))}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (b.kind === 'ol') {
    return (
      <ol key={i} className="list-decimal pl-5 space-y-1.5 marker:text-zen-accent">
        {b.lines.map((l, j) => (
          <li key={j} className="text-zen-text/90">{inline(l.replace(/^\s*\d+[.)]\s+/, ''))}</li>
        ))}
      </ol>
    );
  }
  return (
    <p key={i} className="text-zen-text/85">
      {b.lines.map((l, j) => (
        <span key={j}>
          {inline(l)}
          {j < b.lines.length - 1 ? ' ' : ''}
        </span>
      ))}
    </p>
  );
}

// Inline formatting: **bold**, *italic*, `code`. Pure regex pass; we're
// only rendering Claude's output, not arbitrary user content, so safety
// comes from React's default JSX escaping.
function inline(s) {
  const out = [];
  let rest = s;
  let key = 0;
  // alternating pattern matcher
  const patterns = [
    { re: /\*\*([^*]+)\*\*/, wrap: (t) => <strong key={key++} className="text-zen-text font-semibold">{t}</strong> },
    { re: /`([^`]+)`/,        wrap: (t) => <code key={key++} className="mono text-[12.5px] px-1 py-0.5 rounded bg-zen-panel">{t}</code> },
    { re: /\*([^*]+)\*/,      wrap: (t) => <em key={key++} className="italic">{t}</em> },
  ];
  while (rest.length > 0) {
    let earliest = -1, picked = null, match = null;
    for (const p of patterns) {
      const m = rest.match(p.re);
      if (m && (earliest === -1 || m.index < earliest)) {
        earliest = m.index;
        picked = p;
        match = m;
      }
    }
    if (!picked) {
      out.push(<span key={key++}>{rest}</span>);
      break;
    }
    if (match.index > 0) out.push(<span key={key++}>{rest.slice(0, match.index)}</span>);
    out.push(picked.wrap(match[1]));
    rest = rest.slice(match.index + match[0].length);
  }
  return out;
}
