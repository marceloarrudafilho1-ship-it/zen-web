// "Network" view — every analyzed wallet on one canvas, with edges drawn between
// pairs of wallets that have transacted directly. The investigator's-eye view
// of an entire ring of related addresses.
//
// Node = wallet (analyzed tab). Edge thickness scales with transfer count.
// Edge label is the bidirectional total (USD if priced, transfer count otherwise).
// Standalone counterparties are NOT drawn — that would re-render every wallet's
// individual flow chart on top of each other. Use the per-wallet view for that.

import { useEffect, useMemo, useState } from 'react';
import ReactFlow, { Background, MarkerType, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { fmtUsd, shortAddr } from '../lib/format.js';
import { TEMP_STYLE } from '../lib/temperature.js';
import { getNote, subscribeNotes } from '../lib/notes.js';
import { getCachedName } from '../lib/ens.js';
import { subscribeNameTick } from '../lib/pipeline.js';
import { subscribeTheme, getTheme } from '../lib/theme.js';

const COLORS = {
  walletLoading: '#94a3b8',
  walletError:   '#f87171',
};
Object.defineProperty(COLORS, 'walletReady', { get: () => getTheme().hex,  enumerable: true });
Object.defineProperty(COLORS, 'active',      { get: () => getTheme().hex2, enumerable: true });

export function NetworkGraph({ wallets, activeId, onSwitchWallet, onInstance }) {
  // Re-render on note + ENS edits so node sublabels update live.
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeNotes(() => setTick(t => t + 1)), []);
  useEffect(() => subscribeNameTick(() => setTick(t => t + 1)), []);
  useEffect(() => subscribeTheme(() => setTick(t => t + 1)), []);

  const built = useMemo(
    () => buildNetwork(wallets, activeId),
    [wallets, activeId, tick],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);

  useEffect(() => {
    // Preserve user-dragged positions for nodes that survived the rebuild.
    setNodes(prev => {
      const byId = new Map(prev.map(n => [n.id, n]));
      return built.nodes.map(n => {
        const existing = byId.get(n.id);
        return existing ? { ...n, position: existing.position } : n;
      });
    });
    setEdges(built.edges);
  }, [built]);

  const onNodeClick = (_e, node) => {
    if (node.data?.walletId) onSwitchWallet?.(node.data.walletId);
  };

  if (built.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-zen-muted text-sm px-6 text-center">
        No analyzed wallets yet. Add at least one to see the network view.
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onInit={onInstance}
      fitView
      fitViewOptions={{ padding: 0.25 }}
      proOptions={{ hideAttribution: true }}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      panOnDrag
      zoomOnScroll
      minZoom={0.15}
      maxZoom={2}
    >
      <Background color="#1f1f24" gap={20} />
    </ReactFlow>
  );
}

// Build a directed multi-graph: one node per wallet, one edge for each direction
// where transfers exist. Same A→B and B→A pair stacks into one bidirectional
// edge with a combined label.
function buildNetwork(wallets, activeId) {
  const nodes = [];
  const edges = [];
  const ready = wallets.filter(w => w.status === 'done' && w.result);

  // Layout: arrange wallets around a circle so the eye sees them as a constellation.
  const center = { x: 480, y: 320 };
  const radius = Math.max(180, 80 * ready.length);
  const angleStep = (2 * Math.PI) / Math.max(1, ready.length);

  // Build a quick lookup of wallet address → wallet record (for matching counterparties).
  const byAddr = new Map();
  for (const w of ready) {
    const k = walletKey(w);
    byAddr.set(k, w);
  }

  ready.forEach((w, i) => {
    const angle = angleStep * i - Math.PI / 2;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    const isActive = w.id === activeId;
    const tempColor = TEMP_STYLE[w.result.temperature?.temp]?.dot || '#94a3b8';

    nodes.push({
      id: `w-${w.id}`,
      position: { x, y },
      data: { walletId: w.id, label: walletNodeLabel(w) },
      draggable: true,
      style: walletNodeStyle({ active: isActive, tempColor }),
    });
  });

  // Scan each wallet's transfers; if the counterparty is another analyzed
  // wallet, accumulate an edge. We only count `out` (and `swap`) legs from each
  // wallet's POV — the matching `in` leg lives on the other wallet's transfers
  // and counting both would double every cross-wallet flow.
  const pairs = new Map();
  for (const w of ready) {
    for (const t of w.result.transfers) {
      if (t.direction === 'in') continue;
      const cpKey = `${t.chain}:${t.chain === 'solana' ? t.counterparty : String(t.counterparty || '').toLowerCase()}`;
      const other = byAddr.get(cpKey);
      if (!other || other.id === w.id) continue;

      const key = `${w.id}|${other.id}`;
      if (!pairs.has(key)) pairs.set(key, { src: w.id, dst: other.id, count: 0, totalUsd: 0, sampleSymbol: t.asset.symbol });
      const p = pairs.get(key);
      p.count += 1;
      p.totalUsd += t.usd || 0;
    }
  }

  // Collapse opposing pairs (A→B and B→A) into one bidirectional edge for clarity.
  const seen = new Set();
  for (const [key, p] of pairs.entries()) {
    if (seen.has(key)) continue;
    const reverseKey = `${p.dst}|${p.src}`;
    const reverse = pairs.get(reverseKey);
    seen.add(key);
    if (reverse) seen.add(reverseKey);

    const edgeId = `edge-${p.src}-${p.dst}`;
    const totalCount = p.count + (reverse?.count || 0);
    const totalUsd = p.totalUsd + (reverse?.totalUsd || 0);
    const label = totalUsd > 0
      ? `${fmtUsd(totalUsd)} · ${totalCount}×`
      : `${totalCount}× ${p.sampleSymbol}`;
    const theme = getTheme();
    const stroke = reverse ? theme.hex2 : theme.hex;
    const width = Math.min(4, 1 + Math.log10(totalCount + 1) * 1.5);

    edges.push({
      id: edgeId,
      source: `w-${p.src}`,
      target: `w-${p.dst}`,
      label,
      animated: totalCount >= 5,
      labelStyle: { fill: '#e7e7ea', fontSize: 10, fontWeight: 500 },
      labelBgStyle: { fill: '#111114' },
      labelBgPadding: [5, 3],
      labelBgBorderRadius: 4,
      style: { stroke, strokeWidth: width },
      markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
      markerStart: reverse ? { type: MarkerType.ArrowClosed, color: stroke } : undefined,
    });
  }

  return { nodes, edges };
}

function walletKey(w) {
  return `${w.chain}:${w.chain === 'solana' ? w.address : w.address.toLowerCase()}`;
}

function walletNodeLabel(w) {
  const note = getNote(w.address, w.chain);
  const ens = getCachedName(w.chain, w.address);
  const t = w.result?.temperature;
  const lines = [];
  lines.push(note ? `✎ ${truncate(note, 22)}` : 'Wallet');
  lines.push(ens || shortAddr(w.address));
  if (ens) lines.push(shortAddr(w.address));
  lines.push(w.chain);
  if (t && t.temp !== 'unknown') lines.push(`● ${t.label}`);
  if (w.result?.extrema?.high?.usd) lines.push(`peak ${fmtUsd(w.result.extrema.high.usd)}`);
  return lines.join('\n');
}

function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + '…';
}

function walletNodeStyle({ active, tempColor }) {
  const border = active ? COLORS.active : COLORS.walletReady;
  return {
    background: '#0d0d10',
    color: '#e7e7ea',
    border: `2px solid ${border}`,
    borderRadius: 12,
    padding: 10,
    fontSize: 10,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    textAlign: 'center',
    minWidth: 160,
    fontWeight: 600,
    boxShadow: active
      ? `0 0 0 3px rgb(var(--zen-accent2-rgb) / 0.25), 0 0 12px ${tempColor}55`
      : `0 0 8px ${tempColor}44`,
    cursor: 'pointer',
  };
}
