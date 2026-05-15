import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, { Background, MarkerType, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { fmtUsd, fmtAmount, shortAddr, fmtDate } from '../lib/format.js';
import { ArrowDown, ArrowUp, Swap, Expand, Collapse, FitView } from './Icons.jsx';
import { kindMeta, labelFor } from '../lib/labels.js';
import { TEMP_STYLE } from '../lib/temperature.js';
import { getNote, subscribeNotes } from '../lib/notes.js';
import { AddressNoteBlock } from './AddressNote.jsx';
import { NetworkGraph } from './NetworkGraph.jsx';
import { ExplorerLink } from './ExplorerLink.jsx';
import { EnsChip } from './EnsName.jsx';
import { getCachedName } from '../lib/ens.js';
import { subscribeNameTick } from '../lib/pipeline.js';
import { useTheme, subscribeTheme, getTheme } from '../lib/theme.js';

// Single persistent flow chart for the active wallet — wallet at center, top
// 5 IN/OUT/SWAP transactions arranged around it. Clicking any OUT/SWAP node lets
// the investigator fetch the next hop ("where did the money go after that?")
// and renders those transfers as a fan of children.

// `wallet` and `swap` follow the active theme — defined as getters so every
// read picks up the latest palette. The remaining colors are semantic and
// fixed (green=in, red=out, purple=hop).
const COLORS = {
  in: '#4ade80',
  out: '#f87171',
  hop: '#c084fc',
};
Object.defineProperty(COLORS, 'wallet', { get: () => getTheme().hex,  enumerable: true });
Object.defineProperty(COLORS, 'swap',   { get: () => getTheme().hex2, enumerable: true });

export function FlowPanel({
  wallet, wallets, selection, onSelect, onTraceHop,
  onAutoTrace, onOpenAddress,
  graphMode = 'wallet', onChangeGraphMode, onSwitchWallet,
}) {
  useTheme(); // subscribe so swatches & inline-style accent colors refresh on palette change
  const isNetwork = graphMode === 'network';
  const readyCount = (wallets || []).filter(w => w.status === 'done').length;

  // Fullscreen escapes the sticky right-column container by going `position:
  // fixed` over the whole viewport. Lives here (not in App) because no other
  // component cares — it's a per-panel viewing mode.
  const [fullscreen, setFullscreen] = useState(false);

  // ESC exits fullscreen. Browser fullscreen API isn't used because we want
  // soft-overlay behavior (header still navigable), not the OS-level mode.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  // Imperatively re-fit the view on demand. The ReactFlow instance is captured
  // via onInit and cached in a ref so the toolbar button can call it.
  const flowInstance = useRef(null);
  const handleFit = useCallback(() => {
    flowInstance.current?.fitView?.({ padding: 0.2, duration: 250 });
  }, []);

  // When the container resizes (fullscreen toggle, mode switch), ReactFlow
  // keeps its previous zoom/pan — which leaves nodes tiny in a 1920×1080 area
  // when entering fullscreen, or cropped when exiting. Wait two animation
  // frames for the layout to settle, then auto-fit so every node is visible
  // in the new viewport. Without the delay, fitView measures the old size.
  useEffect(() => {
    if (!flowInstance.current) return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        flowInstance.current?.fitView?.({ padding: 0.2, duration: 300 });
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, [fullscreen, isNetwork]);

  if (!wallet?.result) {
    return (
      <div className="card flex-1 flex items-center justify-center">
        <div className="text-zen-muted text-sm text-center px-6">
          {wallet?.status === 'loading'
            ? 'Loading wallet…'
            : wallet?.status === 'error'
              ? 'Analysis failed.'
              : 'No data yet.'}
        </div>
      </div>
    );
  }

  const containerCls = fullscreen
    ? 'fixed inset-0 z-50 card !rounded-none flex flex-col overflow-hidden bg-zen-bg'
    : 'card flex flex-col overflow-hidden flex-1 min-h-0';

  return (
    <div className={containerCls}>
      <div className="px-4 py-3 border-b border-zen-border flex items-baseline justify-between gap-3 shrink-0">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{isNetwork ? 'Network view' : 'Money flow'}</h2>
          <p className="text-[11px] text-zen-muted truncate">
            {isNetwork
              ? `${readyCount} wallet${readyCount === 1 ? '' : 's'} · click a node to switch tabs`
              : 'click any node for details · drag to rearrange'}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {readyCount >= 2 && onChangeGraphMode && (
            <ModeToggle mode={graphMode} onChange={onChangeGraphMode} />
          )}
          {!isNetwork && <Legend />}
          <GraphToolbar
            fullscreen={fullscreen}
            onToggleFullscreen={() => setFullscreen(f => !f)}
            onFit={handleFit}
          />
        </div>
      </div>

      <div className="relative flex-1 min-h-0">
        {isNetwork ? (
          <NetworkGraph
            wallets={wallets}
            activeId={wallet.id}
            onSwitchWallet={onSwitchWallet}
            onInstance={(inst) => { flowInstance.current = inst; }}
          />
        ) : (
          <Graph
            wallet={wallet}
            selection={selection}
            onSelect={onSelect}
            onInstance={(inst) => { flowInstance.current = inst; }}
          />
        )}
      </div>

      {!isNetwork && (
        <div className={`border-t border-zen-border bg-[#0d0d10]/50 shrink-0 overflow-y-auto
          ${fullscreen ? 'h-[320px]' : 'h-[280px]'}`}>
          <InfoPanel wallet={wallet} selection={selection} onTraceHop={onTraceHop} onAutoTrace={onAutoTrace} onOpenAddress={onOpenAddress} />
        </div>
      )}
    </div>
  );
}

function GraphToolbar({ fullscreen, onToggleFullscreen, onFit }) {
  return (
    <div className="flex items-center gap-1 bg-[#0d0d10]/60 border border-zen-border rounded-md p-0.5">
      <ToolButton onClick={onFit} title="Fit view (F)">
        <FitView size={13} />
      </ToolButton>
      <ToolButton onClick={onToggleFullscreen}
        title={fullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}>
        {fullscreen ? <Collapse size={13} /> : <Expand size={13} />}
      </ToolButton>
    </div>
  );
}

function ToolButton({ onClick, title, children }) {
  return (
    <button onClick={onClick} title={title}
      className="w-7 h-7 rounded inline-flex items-center justify-center text-zen-muted
        hover:text-zen-text hover:bg-zen-panel transition">
      {children}
    </button>
  );
}

function ModeToggle({ mode, onChange }) {
  return (
    <div className="flex items-center gap-1 bg-[#0d0d10]/60 border border-zen-border rounded-md p-0.5">
      {[
        { id: 'wallet',  label: 'Wallet'  },
        { id: 'network', label: 'Network' },
      ].map(opt => (
        <button key={opt.id} onClick={() => onChange(opt.id)}
          className={`px-2 py-1 rounded text-[11px] transition
            ${mode === opt.id
              ? 'bg-zen-panel text-zen-text shadow-[0_0_0_1px_rgb(var(--zen-accent-rgb)/0.4)]'
              : 'text-zen-muted hover:text-zen-text'}`}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-zen-muted">
      <Swatch color={COLORS.in} label="IN" />
      <Swatch color={COLORS.out} label="OUT" />
      <Swatch color={COLORS.swap} label="SWAP" />
      <Swatch color={COLORS.hop} label="HOP" />
    </div>
  );
}

function Swatch({ color, label }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}88` }} />
      {label}
    </span>
  );
}

function Graph({ wallet, selection, onSelect, onInstance }) {
  // Re-render on note edits + ENS resolutions so node sublabels update live
  // as freshly-resolved data lands without needing the user to re-click.
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeNotes(() => setTick(t => t + 1)), []);
  useEffect(() => subscribeNameTick(() => setTick(t => t + 1)), []);
  useEffect(() => subscribeTheme(() => setTick(t => t + 1)), []);

  // Recompute base graph when wallet, hop set, notes, or names change. Keeping
  // these in the dep list means newly-traced hops slot in without resetting the
  // user's dragged positions (we call setNodes with a merge).
  const built = useMemo(() => buildGraph(wallet), [wallet.id, wallet.result, wallet.hops, tick]);
  const [nodes, setNodes, onNodesChange] = useNodesState(built.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(built.edges);

  // Apply rebuilds whenever the memoized graph object changes (wallet switch,
  // result, hops, or notes). Preserve user-dragged positions for nodes that
  // survived — but on a wallet switch reset entirely so dragged positions from
  // the previous wallet (which share node IDs like `in-0`) don't leak through.
  const lastWalletId = useRef(wallet.id);
  useEffect(() => {
    const switched = lastWalletId.current !== wallet.id;
    lastWalletId.current = wallet.id;
    if (switched) {
      setNodes(built.nodes);
    } else {
      setNodes(prev => {
        const byId = new Map(prev.map(n => [n.id, n]));
        return built.nodes.map(n => {
          const existing = byId.get(n.id);
          return existing ? { ...n, position: existing.position } : n;
        });
      });
    }
    setEdges(built.edges);
  }, [built]);

  // Sync selection ring onto current nodes (without resetting positions).
  useEffect(() => {
    setNodes(prev => prev.map(n => applySelectionRing(n, selection)));
  }, [selection?.kind, selection?.id]);

  const onNodeClick = (_e, node) => {
    if (node.id === 'wallet') {
      onSelect({ kind: 'wallet', id: 'wallet' });
    } else if (node.data?.hop) {
      onSelect({ kind: 'hop', id: node.id, hop: node.data.hop });
    } else if (node.data?.tx) {
      onSelect({ kind: 'tx', id: node.id, tx: node.data.tx });
    }
  };

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onInit={onInstance}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      panOnDrag
      zoomOnScroll
      minZoom={0.2}
      maxZoom={2}
    >
      <Background color="#1f1f24" gap={20} />
    </ReactFlow>
  );
}

function buildGraph(wallet) {
  const top = wallet.result.top;
  const nodes = [];
  const edges = [];

  const walletHasNote = !!getNote(wallet.address, wallet.chain);
  nodes.push({
    id: 'wallet',
    position: { x: 400, y: 200 },
    data: { label: walletLabel(wallet), notable: walletHasNote },
    draggable: true,
    style: nodeStyle({ color: COLORS.wallet, primary: true, minWidth: 150, notable: walletHasNote }),
  });

  // IN — left column, top to bottom. IN-hop fans (if traced) extend further
  // LEFT, with arrows pointing INTO the IN node — answering "where did the
  // money come from before reaching us".
  top.in.slice(0, 5).forEach((tx, i) => {
    const id = `in-${i}`;
    const pos = { x: 60, y: 20 + i * 95 };
    const hasNote = !!getNote(tx.counterparty, tx.chain);
    nodes.push({
      id,
      position: pos,
      data: { label: txLabel(tx, 'in'), tx, notable: hasNote },
      draggable: true,
      style: nodeStyle({ color: COLORS.in, notable: hasNote }),
    });
    edges.push(edgeBetween(`e-${id}`, id, 'wallet', edgeLabel(tx)));

    appendHopNodesIfAny({
      parentId: id, parentPos: pos,
      counterparty: tx.counterparty,
      hops: wallet.hops,
      direction: 'in',
      nodes, edges,
    });
  });

  // OUT — right column. OUT-hop fans extend RIGHT.
  top.out.slice(0, 5).forEach((tx, i) => {
    const id = `out-${i}`;
    const pos = { x: 740, y: 20 + i * 95 };
    const hasNote = !!getNote(tx.counterparty, tx.chain);
    nodes.push({
      id,
      position: pos,
      data: { label: txLabel(tx, 'out'), tx, notable: hasNote },
      draggable: true,
      style: nodeStyle({ color: COLORS.out, notable: hasNote }),
    });
    edges.push(edgeBetween(`e-${id}`, 'wallet', id, edgeLabel(tx)));

    appendHopNodesIfAny({
      parentId: id, parentPos: pos,
      counterparty: tx.counterparty,
      hops: wallet.hops,
      direction: 'out',
      nodes, edges,
    });
  });

  // SWAP — bottom row. SWAP nodes get OUT-style hop tracing (where the swapped
  // tokens went next). IN-tracing on swap routers is rarely useful since the
  // counterparty is a DEX aggregator.
  top.swap.slice(0, 5).forEach((tx, i) => {
    const id = `swap-${i}`;
    const pos = { x: 80 + i * 160, y: 500 };
    const hasNote = !!getNote(tx.counterparty, tx.chain);
    nodes.push({
      id,
      position: pos,
      data: { label: txLabel(tx, 'swap'), tx, notable: hasNote },
      draggable: true,
      style: nodeStyle({ color: COLORS.swap, notable: hasNote }),
    });
    edges.push(edgeBetween(`e-${id}`, 'wallet', id, edgeLabel(tx), true));

    appendHopNodesIfAny({
      parentId: id, parentPos: pos,
      counterparty: tx.counterparty,
      hops: wallet.hops,
      direction: 'out',
      nodes, edges,
    });
  });

  return { nodes, edges };
}

// Builds the second-hop child fan for a parent IN/OUT/SWAP node. Direction
// flips both the layout side (IN extends left, OUT/SWAP extend right) and the
// edge arrow direction (IN: hop → parent; OUT: parent → hop) so the visual
// flow of money stays readable left-to-right.
function appendHopNodesIfAny({ parentId, parentPos, counterparty, hops, direction, nodes, edges }) {
  const hop = hops?.[`${direction}:${counterparty}`];
  if (!hop || hop.status !== 'done' || !hop.flows?.length) return;

  const isInbound = direction === 'in';
  const baseX = isInbound ? parentPos.x - 280 : parentPos.x + 280;
  const startY = parentPos.y - 60;

  hop.flows.forEach((flow, i) => {
    const id = `hop-${direction}-${parentId}-${i}`;
    const hasNote = !!getNote(flow.counterparty, flow.last?.chain);
    nodes.push({
      id,
      position: { x: baseX, y: startY + i * 80 },
      data: {
        label: hopLabel(flow),
        hop: { ...flow, parentCounterparty: counterparty, traceDirection: direction },
        notable: hasNote,
      },
      draggable: true,
      style: nodeStyle({ color: COLORS.hop, dashed: true, minWidth: 120, notable: hasNote }),
    });
    const lbl = flow.label ? flow.label.name : `${fmtAmount(flow.total, 2)} ${flow.last.asset.symbol}`;
    // Source → target: IN traces money flowing INTO parent (hop → parent),
    // OUT traces money flowing OUT of parent (parent → hop).
    const [src, dst] = isInbound ? [id, parentId] : [parentId, id];
    edges.push(edgeBetween(`e-${id}`, src, dst, lbl, false, COLORS.hop));
  });
}

function walletLabel(wallet) {
  const peak = wallet.result.extrema.high?.usd;
  const t = wallet.result.temperature;
  const note = getNote(wallet.address, wallet.chain);
  const ens = getCachedName(wallet.chain, wallet.address);
  const lines = [];
  lines.push(note ? `✎ ${truncateNote(note)}` : 'Wallet');
  // Prefer the ENS / SNS name over the hex for the central wallet — that's
  // what makes a known wallet visually identifiable at a glance.
  lines.push(ens || shortAddr(wallet.address));
  if (ens) lines.push(shortAddr(wallet.address));
  if (t && t.temp !== 'unknown') lines.push(`● ${t.label}`);
  if (peak != null && peak > 0) lines.push(`peak ${fmtUsd(peak)}`);
  return lines.join('\n');
}

function txLabel(tx, dir) {
  const head = dir === 'in' ? 'IN' : dir === 'out' ? 'OUT' : 'SWAP';
  const lines = [head];
  const note = getNote(tx.counterparty, tx.chain);
  const ens = getCachedName(tx.chain, tx.counterparty);
  // Priority: user's note > ENS/SNS name > known-service label > nothing.
  if (note) lines.push(`✎ ${truncateNote(note)}`);
  else if (ens) lines.push(`→ ${truncateNote(ens)}`);
  else if (tx.counterpartyLabel) lines.push(`→ ${tx.counterpartyLabel.name}`);
  // Amount + USD on the same line so the dollar value is always visible right
  // next to "1.1 ETH", not stranded as a separate sub-line that can be missed.
  const amt = `${fmtAmount(tx.amount)} ${tx.asset.symbol}`;
  lines.push(tx.usd != null && tx.usd > 0 ? `${amt}  ·  ${fmtUsd(tx.usd)}` : amt);
  return lines.join('\n');
}

function hopLabel(flow) {
  const lines = ['HOP'];
  const note = getNote(flow.counterparty, flow.last?.chain);
  const ens = getCachedName(flow.last?.chain, flow.counterparty);
  if (note) lines.push(`✎ ${truncateNote(note)}`);
  else if (ens) lines.push(`→ ${truncateNote(ens)}`);
  else if (flow.label) lines.push(`→ ${flow.label.name}`);
  else lines.push(shortAddr(flow.counterparty));
  const amt = `${fmtAmount(flow.total, 3)} ${flow.last.asset.symbol}`;
  // Hop transfers skip the price pass for speed; show USD only if it happens
  // to be present (e.g. native ETH carried through from the parent wallet's
  // price series — rare).
  lines.push(flow.last?.usd != null && flow.last.usd > 0
    ? `${amt}  ·  ${fmtUsd(flow.last.usd)}`
    : amt);
  if (flow.count > 1) lines.push(`× ${flow.count}`);
  return lines.join('\n');
}

function truncateNote(s, n = 22) {
  if (!s) return '';
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

function edgeLabel(tx) {
  const amt = `${fmtAmount(tx.amount, 2)} ${tx.asset.symbol}`;
  if (tx.usd != null && tx.usd > 0) return `${amt} · ${fmtUsd(tx.usd)}`;
  return amt;
}

function nodeStyle({ color, primary = false, minWidth = 110, dashed = false, notable = false }) {
  return {
    background: '#0d0d10',
    color: '#e7e7ea',
    border: `1.5px ${dashed ? 'dashed' : 'solid'} ${color}`,
    borderRadius: 10,
    padding: 9,
    fontSize: 10,
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    textAlign: 'center',
    minWidth,
    fontWeight: primary ? 600 : 400,
    cursor: 'grab',
    // A subtle inner glow signals "this address has an investigator note attached".
    ...(notable ? { boxShadow: 'inset 0 0 0 1px rgb(var(--zen-accent2-rgb) / 0.55)' } : {}),
  };
}

function applySelectionRing(node, selection) {
  const isSelected = selection && (
    (selection.kind === 'wallet' && node.id === 'wallet') ||
    ((selection.kind === 'tx' || selection.kind === 'hop') && node.id === selection.id)
  );
  // Combine the outer selection ring with the inner notable glow so a tagged
  // node still shows its rose halo even while another node is selected.
  const shadows = [];
  if (isSelected) shadows.push('0 0 0 3px rgb(var(--zen-accent-rgb) / 0.35)');
  if (node.data?.notable) shadows.push('inset 0 0 0 1px rgb(var(--zen-accent2-rgb) / 0.55)');
  return {
    ...node,
    style: {
      ...node.style,
      boxShadow: shadows.length ? shadows.join(', ') : 'none',
    },
  };
}

function edgeBetween(id, source, target, label, animated = false, strokeOverride) {
  const stroke = strokeOverride || '#3a3a42';
  return {
    id, source, target, label, animated,
    labelStyle: { fill: '#e7e7ea', fontSize: 10, fontWeight: 500 },
    labelBgStyle: { fill: '#111114' },
    labelBgPadding: [5, 3],
    labelBgBorderRadius: 4,
    style: { stroke, strokeWidth: 1.4, ...(strokeOverride ? { strokeDasharray: '4 3' } : {}) },
    markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
  };
}

function InfoPanel({ wallet, selection, onTraceHop, onAutoTrace, onOpenAddress }) {
  if (!selection) {
    return (
      <div className="p-5 text-sm text-zen-muted">
        <div className="font-medium text-zen-text mb-2">No node selected</div>
        <p className="text-xs leading-relaxed">
          Click any node in the graph above to see its details here. The center node is the wallet
          itself; surrounding nodes are the top inflows, outflows, and swaps from this address.
          For an OUT node, <span className="text-zen-text font-medium">Trace outflows</span> follows
          where the money went. For an IN node, <span className="text-zen-text font-medium">Trace inflows</span>
          shows where it came from before reaching this wallet.
        </p>
      </div>
    );
  }

  if (selection.kind === 'wallet') return <WalletDetails wallet={wallet} />;
  if (selection.kind === 'hop')    return <HopDetails hop={selection.hop} chain={wallet.chain} />;
  return <TxDetails tx={selection.tx} chain={wallet.chain} wallet={wallet} onTraceHop={onTraceHop} onAutoTrace={onAutoTrace} onOpenAddress={onOpenAddress} />;
}

function WalletDetails({ wallet }) {
  const { result, address, chain } = wallet;
  const t = result.temperature;
  const totalIn = sumUsd(result.top.in);
  const totalOut = sumUsd(result.top.out);

  return (
    <div className="p-5 text-sm space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-2 h-2 rounded-full" style={{ background: COLORS.wallet }} />
        <span className="font-medium">Wallet summary</span>
        {t && t.temp !== 'unknown' && <TemperatureBadge temperature={t} />}
        <EnsChip chain={chain} address={address} />
      </div>
      <AddressNoteBlock address={address} chain={chain} />
      <DetailRow label="Address" value={address} mono
        trailing={<ExplorerLink chain={chain} kind="address" value={address} />} />
      <DetailRow label="Chain" value={chain} />
      {t && t.temp !== 'unknown' && (
        <DetailRow label="Activity" value={t.reason} />
      )}
      <DetailRow label="Transfers analyzed" value={result.transfers.length.toLocaleString()} />
      <DetailRow label="Peak balance" value={fmtUsd(result.extrema.high?.usd)} accent="text-zen-green" />
      <DetailRow label="Floor balance" value={fmtUsd(result.extrema.low?.usd)} accent="text-zen-red" />
      <DetailRow label="Top-5 inflow total" value={fmtUsd(totalIn)} />
      <DetailRow label="Top-5 outflow total" value={fmtUsd(totalOut)} />
    </div>
  );
}

function TxDetails({ tx, chain, wallet, onTraceHop, onAutoTrace, onOpenAddress }) {
  const partyLabel = tx.direction === 'in' ? 'Sender' : tx.direction === 'out' ? 'Receiver' : 'Router';
  const Icon = tx.direction === 'in' ? ArrowDown : tx.direction === 'out' ? ArrowUp : Swap;
  const accentColor = tx.direction === 'in' ? COLORS.in : tx.direction === 'out' ? COLORS.out : COLORS.swap;
  const accentClass = tx.direction === 'in' ? 'text-zen-green' : tx.direction === 'out' ? 'text-zen-red' : 'text-zen-accent';

  const cpLabel = tx.counterpartyLabel || labelFor(tx.counterparty, chain);
  const validCp = tx.counterparty && tx.counterparty !== 'native' && tx.counterparty !== 'DEX';

  const traceDirection = tx.direction === 'in' ? 'in' : 'out';
  const hop = validCp ? wallet.hops?.[`${traceDirection}:${tx.counterparty}`] : null;

  // Show "Follow the Money" only for OUT nodes to unlabeled / non-terminal counterparties.
  const cpKind = cpLabel?.kind;
  const isTerminal = cpKind === 'exchange' || cpKind === 'mixer' || cpKind === 'bridge';
  const showAutoTrace = tx.direction === 'out' && validCp && !isTerminal && onAutoTrace;
  const showBridgePrompt = cpKind === 'bridge' && validCp && onOpenAddress;

  return (
    <div className="p-5 text-sm space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={accentClass}><Icon size={14} /></span>
        <span className="font-medium uppercase tracking-wider text-xs" style={{ color: accentColor }}>
          {tx.direction} transfer
        </span>
        {cpLabel && <CounterpartyChip label={cpLabel} />}
        <EnsChip chain={tx.chain} address={tx.counterparty} />
      </div>
      <AddressNoteBlock address={tx.counterparty} chain={tx.chain} />
      <DetailRow label="Amount" value={`${fmtAmount(tx.amount)} ${tx.asset.symbol}`} mono />
      <DetailRow label="USD value" value={tx.usd != null && tx.usd > 0 ? fmtUsd(tx.usd) : 'unpriced'}
        accent={tx.usd != null && tx.usd > 0 ? accentClass : 'text-zen-muted'} />
      <DetailRow label={partyLabel} value={cpLabel ? cpLabel.name : tx.counterparty} mono={!cpLabel}
        trailing={<ExplorerLink chain={tx.chain} kind="address" value={tx.counterparty} />} />
      {cpLabel && <DetailRow label="Address" value={tx.counterparty} mono
        trailing={<ExplorerLink chain={tx.chain} kind="address" value={tx.counterparty} />} />}
      <DetailRow label="Date" value={fmtDate(tx.blockTime)} />
      <DetailRow label="Hash" value={tx.hash} mono
        trailing={<ExplorerLink chain={tx.chain} kind="tx" value={tx.hash} />} />
      <DetailRow label="Kind" value={tx.kind} />

      {validCp && (
        <div className="pt-2 border-t border-zen-border/60">
          <TraceHopControl
            hop={hop}
            direction={traceDirection}
            onTrace={() => onTraceHop?.(tx.counterparty, traceDirection)}
          />
        </div>
      )}

      {showAutoTrace && (
        <div className="pt-2 border-t border-zen-border/60">
          <AutoTraceSection
            autoTrace={wallet.autoTrace}
            startAddress={tx.counterparty}
            chain={chain}
            onStartTrace={() => onAutoTrace(tx.counterparty)}
            onOpenAddress={onOpenAddress}
          />
        </div>
      )}

      {showBridgePrompt && (
        <div className="pt-2 border-t border-zen-border/60">
          <BridgePivotPrompt
            bridgeName={cpLabel.name}
            currentChain={chain}
            onOpenAddress={onOpenAddress}
          />
        </div>
      )}
    </div>
  );
}

function HopDetails({ hop, chain }) {
  const cpLabel = hop.label || labelFor(hop.counterparty, chain);
  const isInbound = hop.traceDirection === 'in';
  const partyLabel = isInbound ? 'Sender' : 'Recipient';
  const amountLabel = isInbound ? 'Total received' : 'Total sent';
  return (
    <div className="p-5 text-sm space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-2 h-2 rounded-full" style={{ background: COLORS.hop }} />
        <span className="font-medium uppercase tracking-wider text-xs" style={{ color: COLORS.hop }}>
          {isInbound ? 'Upstream source' : 'Next-hop recipient'}
        </span>
        {cpLabel && <CounterpartyChip label={cpLabel} />}
        <EnsChip chain={chain} address={hop.counterparty} />
      </div>
      <AddressNoteBlock address={hop.counterparty} chain={chain} />
      <DetailRow label={partyLabel} value={cpLabel ? cpLabel.name : hop.counterparty} mono={!cpLabel}
        trailing={<ExplorerLink chain={chain} kind="address" value={hop.counterparty} />} />
      {cpLabel && <DetailRow label="Address" value={hop.counterparty} mono
        trailing={<ExplorerLink chain={chain} kind="address" value={hop.counterparty} />} />}
      <DetailRow label={amountLabel} value={`${fmtAmount(hop.total)} ${hop.last.asset.symbol}`} mono />
      <DetailRow label="Transfer count" value={String(hop.count)} />
      <DetailRow label="Most recent" value={fmtDate(hop.last.blockTime)} />
      <DetailRow label="Last hash" value={hop.last.hash} mono
        trailing={<ExplorerLink chain={chain} kind="tx" value={hop.last.hash} />} />
      <p className="text-[10px] text-zen-muted leading-relaxed pt-1">
        {isInbound
          ? <>Aggregated inflows TO <span className="mono">{shortAddr(hop.parentCounterparty)}</span> from this address.</>
          : <>Aggregated outflows FROM <span className="mono">{shortAddr(hop.parentCounterparty)}</span> to this address.</>
        }
        {' '}Pricing not applied to second-hop transfers.
      </p>
    </div>
  );
}

// Maps bridge names to their destination chain ID. Only chains the app
// recognises are listed; unknown bridges fall back to null (user sees "chain").
function inferDestinationChain(bridgeName) {
  const n = bridgeName.toLowerCase();
  if (n.includes('base')) return 'base';
  if (n.includes('optimism')) return 'optimism';
  if (n.includes('arbitrum')) return 'arbitrum';
  if (n.includes('zksync') || n.includes('zk sync')) return 'zksync';
  if (n.includes('polygon') || n.includes('pos bridge')) return 'polygon';
  return null;
}

// Clickable address/label chip used in the money-trail path display.
function PathChip({ address, label, chain, onOpen }) {
  const meta = label ? kindMeta(label.kind) : null;
  const display = label ? label.name : shortAddr(address);
  return (
    <button
      onClick={() => onOpen?.({ chain, address })}
      title={address}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] mono
        bg-zen-panel border border-zen-border hover:border-zen-accent/40 transition shrink-0"
    >
      {meta && (
        <span className="text-[9px] font-semibold" style={{ color: meta.color }}>{meta.short}</span>
      )}
      <span className="text-zen-text">{display}</span>
    </button>
  );
}

function AutoTraceSection({ autoTrace, startAddress, chain, onStartTrace, onOpenAddress }) {
  const isActive = autoTrace?.startAddress === startAddress;
  const status = isActive ? autoTrace.status : null;

  if (!isActive || !status) {
    return (
      <button onClick={onStartTrace}
        className="w-full text-xs font-medium px-3 py-2 rounded-md bg-zen-accent/10 text-zen-accent
          ring-1 ring-zen-accent/30 hover:bg-zen-accent/20 transition">
        Follow the Money →
      </button>
    );
  }
  if (status === 'loading') {
    return (
      <div className="text-xs text-zen-muted flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-zen-accent animate-pulse" />
        {autoTrace.progress}
      </div>
    );
  }
  if (status === 'error') {
    return (
      <div className="space-y-2">
        <div className="text-xs text-zen-red">{autoTrace.error}</div>
        <button onClick={onStartTrace}
          className="text-xs px-3 py-1.5 rounded-md bg-zen-panel ring-1 ring-zen-border hover:bg-[#1a1a20]">
          Retry
        </button>
      </div>
    );
  }
  if (status === 'done') {
    const { path, terminationReason } = autoTrace;
    return (
      <div className="space-y-2">
        <div className="text-[10px] text-zen-muted uppercase tracking-wider">Money trail</div>
        <div className="flex items-center gap-1 flex-wrap">
          <PathChip address={startAddress} chain={chain} onOpen={onOpenAddress} />
          {path.map((hop, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              <span className="text-zen-muted/60 text-[10px]">→</span>
              <PathChip address={hop.address} label={hop.label} chain={chain} onOpen={onOpenAddress} />
            </span>
          ))}
        </div>
        <div className="text-[10px] text-zen-muted">
          {terminationReason === 'labeled' && 'Terminated at known address.'}
          {terminationReason === 'depth' && `Depth limit reached — ${path.length} hop${path.length === 1 ? '' : 's'}.`}
          {terminationReason === 'no-outflow' && 'No further outflows found.'}
        </div>
        <button onClick={onStartTrace}
          className="text-[10px] text-zen-muted hover:text-zen-text transition">
          Re-trace
        </button>
      </div>
    );
  }
  return null;
}

function BridgePivotPrompt({ bridgeName, currentChain, onOpenAddress }) {
  const [destAddress, setDestAddress] = useState('');
  const destChain = inferDestinationChain(bridgeName);
  const targetChain = destChain || currentChain;
  const chainLabel = destChain ? destChain.charAt(0).toUpperCase() + destChain.slice(1) : 'another chain';

  return (
    <div className="rounded-lg p-3 space-y-2"
      style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)' }}>
      <div className="text-xs font-medium" style={{ color: '#60a5fa' }}>
        Bridge detected: {bridgeName}
      </div>
      <p className="text-[11px] text-zen-muted leading-relaxed">
        Funds may have crossed to <span className="text-zen-text">{chainLabel}</span>.
        Paste the destination address to continue tracing.
      </p>
      <div className="flex gap-2">
        <input
          value={destAddress}
          onChange={e => setDestAddress(e.target.value)}
          placeholder="Destination address…"
          className="flex-1 min-w-0 text-xs bg-zen-panel border border-zen-border rounded px-2 py-1.5
            mono text-zen-text placeholder:text-zen-muted/60 focus:outline-none
            focus:border-[#60a5fa]/60 transition"
        />
        <button
          onClick={() => destAddress.trim() && onOpenAddress?.({ chain: targetChain, address: destAddress.trim() })}
          disabled={!destAddress.trim()}
          className="shrink-0 text-xs px-3 py-1.5 rounded transition disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' }}
        >
          Open on {chainLabel}
        </button>
      </div>
    </div>
  );
}

function TraceHopControl({ hop, direction = 'out', onTrace }) {
  const isInbound = direction === 'in';
  const ctaLabel  = isInbound ? '← Trace inflows' : 'Trace outflows →';
  const loading   = isInbound ? "Fetching counterparty's inflows…" : "Fetching counterparty's outflows…";
  const noun      = isInbound ? 'inflow' : 'outflow';

  if (!hop) {
    return (
      <button onClick={onTrace}
        className="w-full text-xs font-medium px-3 py-2 rounded-md bg-zen-accent/15 text-zen-accent
          ring-1 ring-zen-accent/40 hover:bg-zen-accent/25 transition">
        {ctaLabel}
      </button>
    );
  }
  if (hop.status === 'loading') {
    return (
      <div className="text-xs text-zen-muted flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-zen-accent animate-pulse" />
        {loading}
      </div>
    );
  }
  if (hop.status === 'error') {
    return (
      <div className="space-y-2">
        <div className="text-xs text-zen-red">{hop.error}</div>
        <button onClick={onTrace} className="text-xs px-3 py-1.5 rounded-md bg-zen-panel ring-1 ring-zen-border hover:bg-[#1a1a20]">
          Retry
        </button>
      </div>
    );
  }
  if (hop.status === 'done') {
    const n = hop.flows?.length || 0;
    return (
      <div className="text-[11px] text-zen-muted">
        ✓ Traced — {n} top {noun}{n === 1 ? '' : 's'} now visible on the graph.
      </div>
    );
  }
  return null;
}

function TemperatureBadge({ temperature }) {
  const s = TEMP_STYLE[temperature.temp] || TEMP_STYLE.unknown;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ring-1 ${s.bg} ${s.text} ${s.ring}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot, boxShadow: `0 0 4px ${s.dot}` }} />
      {temperature.label}
    </span>
  );
}

function CounterpartyChip({ label }) {
  const meta = kindMeta(label.kind);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded mono"
      style={{
        background: `${meta.color}1f`,
        color: meta.color,
        border: `1px solid ${meta.color}55`,
      }}
      title={meta.label}
    >
      {meta.short}
    </span>
  );
}

function DetailRow({ label, value, mono, accent, trailing }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-zen-muted shrink-0 text-xs uppercase tracking-wider">{label}</span>
      <span className="flex items-center gap-1.5 min-w-0">
        <span className={`truncate text-right ${mono ? 'mono' : ''} ${accent || ''}`}>{value}</span>
        {trailing}
      </span>
    </div>
  );
}

function sumUsd(items) {
  return items.reduce((acc, t) => acc + (t.usd || 0), 0);
}
