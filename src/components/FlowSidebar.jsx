import { useEffect } from 'react';
import ReactFlow, { Background, Controls, MarkerType, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import { fmtUsd, fmtAmount, shortAddr, fmtDate } from '../lib/format.js';
import { Close } from './Icons.jsx';
import { getTheme } from '../lib/theme.js';

export function FlowSidebar({ selection, walletAddress, onClose }) {
  if (!selection) return null;

  const isExtremum = !!selection.extremum;

  // Pick the right footer label based on direction.
  const partyLabel = isExtremum ? null
    : selection.tx.direction === 'in' ? 'Sender'
    : selection.tx.direction === 'out' ? 'Receiver'
    : 'Router';

  return (
    <aside className="fixed inset-y-0 right-0 w-[520px] bg-zen-panel border-l border-zen-border z-50 flex flex-col shadow-2xl animate-[slidein_0.2s_ease-out]">
      <header className="flex items-start justify-between p-5 border-b border-zen-border">
        <div className="min-w-0">
          <div className="text-xs text-zen-muted uppercase tracking-wider mb-1">
            {isExtremum ? `${selection.extremum} balance` : `${selection.tx.direction.toUpperCase()} transfer`}
          </div>
          <div className="text-lg font-semibold">
            {isExtremum
              ? fmtUsd(selection.point.usd)
              : `${fmtAmount(selection.tx.amount)} ${selection.tx.asset.symbol}`}
          </div>
          <div className="text-sm text-zen-muted mt-1">
            {isExtremum ? fmtDate(selection.point.t) : fmtDate(selection.tx.blockTime)}
            {!isExtremum && selection.tx.usd != null && selection.tx.usd > 0 && ` · ${fmtUsd(selection.tx.usd)}`}
          </div>
        </div>
        <button onClick={onClose} className="text-zen-muted hover:text-zen-text transition p-1">
          <Close size={18} />
        </button>
      </header>

      <FlowCanvas selection={selection} walletAddress={walletAddress} />

      {!isExtremum && (
        <footer className="p-5 border-t border-zen-border text-xs space-y-2">
          <Row label="Hash" value={selection.tx.hash} mono />
          <Row label={partyLabel} value={selection.tx.counterparty} mono />
          <Row label="Kind" value={selection.tx.kind} />
        </footer>
      )}
    </aside>
  );
}

function FlowCanvas({ selection, walletAddress }) {
  const initial = buildGraph(selection, walletAddress);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initial.edges);

  // Reset positions when the selected transaction changes.
  useEffect(() => {
    const next = buildGraph(selection, walletAddress);
    setNodes(next.nodes);
  }, [selection?.tx?.id, selection?.point?.txId]);

  return (
    <div className="flex-1 min-h-0 relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable
        panOnDrag
        zoomOnScroll
        minZoom={0.4}
        maxZoom={2}
      >
        <Background color="#1f1f24" gap={20} />
        <Controls className="!bg-zen-panel !border-zen-border" showInteractive={false} />
      </ReactFlow>
      <div className="absolute bottom-3 left-3 text-[10px] text-zen-muted mono pointer-events-none">
        drag nodes · scroll to zoom
      </div>
    </div>
  );
}

function Row({ label, value, mono }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-zen-muted shrink-0">{label}</span>
      <span className={`truncate ${mono ? 'mono' : ''}`}>{value}</span>
    </div>
  );
}

function buildGraph(selection, walletAddress) {
  if (selection.extremum) return buildExtremumGraph(selection, walletAddress);
  return buildTransferGraph(selection.tx, walletAddress);
}

function buildTransferGraph(tx, walletAddress) {
  const wallet = walletAddress?.toLowerCase() || 'wallet';
  const cp = tx.counterparty || 'unknown';
  const isSwap = tx.direction === 'swap';
  const tokenOut = tx.meta?.tokenOut;

  const theme = getTheme();
  const nodes = [nodeOf('wallet', shortAddr(wallet), 80, 140, theme.hex, true)];
  const edges = [];

  if (isSwap) {
    nodes.push(nodeOf('router', `Router\n${shortAddr(cp)}`, 280, 80, theme.hex2));
    nodes.push(nodeOf('tokenIn', `IN\n${tx.asset.symbol}\n${fmtAmount(tx.amount)}`, 280, 220, '#f87171'));
    edges.push(edgeOf('e1', 'wallet', 'tokenIn', tx.usd != null && tx.usd > 0 ? fmtUsd(tx.usd) : ''));
    edges.push(edgeOf('e2', 'tokenIn', 'router', ''));
    if (tokenOut) {
      nodes.push(nodeOf('tokenOut', `OUT\n${shortAddr(tokenOut)}`, 480, 140, '#4ade80'));
      edges.push(edgeOf('e3', 'router', 'tokenOut', ''));
      edges.push(edgeOf('e4', 'tokenOut', 'wallet', '', true));
    }
    return { nodes, edges };
  }

  const usdLabel = tx.usd != null && tx.usd > 0 ? `\n${fmtUsd(tx.usd)}` : '';
  if (tx.direction === 'in') {
    nodes.push(nodeOf('cp', `Sender\n${shortAddr(cp)}`, 80, 40, '#4ade80'));
    edges.push(edgeOf('e1', 'cp', 'wallet', `${fmtAmount(tx.amount)} ${tx.asset.symbol}${usdLabel}`));
  } else {
    nodes.push(nodeOf('cp', `Receiver\n${shortAddr(cp)}`, 320, 140, '#f87171'));
    edges.push(edgeOf('e1', 'wallet', 'cp', `${fmtAmount(tx.amount)} ${tx.asset.symbol}${usdLabel}`));
  }
  return { nodes, edges };
}

function buildExtremumGraph(selection, walletAddress) {
  const wallet = walletAddress?.toLowerCase() || 'wallet';
  return {
    nodes: [
      nodeOf('wallet', `${shortAddr(wallet)}\n${fmtUsd(selection.point.usd)}`,
        180, 100, selection.extremum === 'Highest' ? '#4ade80' : '#f87171', true),
    ],
    edges: [],
  };
}

function nodeOf(id, label, x, y, color, primary = false) {
  return {
    id,
    position: { x, y },
    data: { label },
    draggable: true,
    style: {
      background: '#0d0d10',
      color: '#e7e7ea',
      border: `1.5px solid ${color}`,
      borderRadius: 10,
      padding: 10,
      fontSize: 11,
      whiteSpace: 'pre-wrap',
      textAlign: 'center',
      minWidth: 110,
      fontWeight: primary ? 600 : 400,
      cursor: 'grab',
    },
  };
}

function edgeOf(id, source, target, label, animated = false) {
  return {
    id, source, target, label,
    animated,
    labelStyle: { fill: '#e7e7ea', fontSize: 10, fontWeight: 500 },
    labelBgStyle: { fill: '#111114' },
    labelBgPadding: [6, 4],
    labelBgBorderRadius: 4,
    style: { stroke: '#3a3a42', strokeWidth: 1.5 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#3a3a42' },
  };
}
