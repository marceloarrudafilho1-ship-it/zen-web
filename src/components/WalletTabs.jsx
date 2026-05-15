import { ChainIcon, Close, Plus, Spinner } from './Icons.jsx';
import { shortAddr } from '../lib/format.js';

export function WalletTabs({ wallets, activeId, onSelect, onClose, onAdd }) {
  if (wallets.length === 0) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
      {wallets.map(w => (
        <Tab
          key={w.id}
          wallet={w}
          active={w.id === activeId}
          onSelect={() => onSelect(w.id)}
          onClose={() => onClose(w.id)}
        />
      ))}
      <button
        onClick={onAdd}
        className="shrink-0 ml-1 w-8 h-8 flex items-center justify-center rounded-lg border border-dashed border-zen-border text-zen-muted hover:text-zen-text hover:border-zen-accent hover:bg-zen-panel transition"
        title="Add another wallet"
      >
        <Plus size={14} />
      </button>
    </div>
  );
}

function Tab({ wallet, active, onSelect, onClose }) {
  return (
    <div
      className={`shrink-0 group flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg border transition cursor-pointer
        ${active
          ? 'bg-zen-panel border-zen-accent/50 shadow-[0_0_0_3px_rgb(var(--zen-accent-rgb)/0.08)]'
          : 'bg-zen-panel/40 border-zen-border hover:bg-zen-panel hover:border-[#2a2a31]'}`}
      onClick={onSelect}
    >
      <ChainIcon chain={wallet.chain} size={14} />
      <span className="mono text-xs">{shortAddr(wallet.address)}</span>
      <StatusDot status={wallet.status} />
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="ml-1 w-5 h-5 flex items-center justify-center rounded text-zen-muted hover:text-zen-text hover:bg-[#1f1f24] transition opacity-60 group-hover:opacity-100"
        title="Close tab"
      >
        <Close size={12} />
      </button>
    </div>
  );
}

function StatusDot({ status }) {
  if (status === 'loading') {
    return <span className="text-zen-accent"><Spinner size={11} /></span>;
  }
  if (status === 'error') {
    return <span className="w-1.5 h-1.5 rounded-full bg-zen-red" title="Error" />;
  }
  if (status === 'done') {
    return <span className="w-1.5 h-1.5 rounded-full bg-zen-green/80" title="Loaded" />;
  }
  return null;
}
