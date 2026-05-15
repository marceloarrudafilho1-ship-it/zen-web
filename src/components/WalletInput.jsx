import { useState } from 'react';
import { EVM_CHAINS } from '../api/evm.js';
import { Search, ChainIcon, ChevronDown } from './Icons.jsx';

const CHAIN_OPTIONS = [
  ...Object.entries(EVM_CHAINS).map(([k, v]) => ({ value: k, label: v.name })),
  { value: 'solana',   label: 'Solana' },
  { value: 'xrp',      label: 'XRP' },
  { value: 'litecoin', label: 'Litecoin' },
];

export function WalletInput({ onAnalyze, busy, variant = 'compact' }) {
  const [address, setAddress] = useState('');
  const [chain, setChain] = useState('ethereum');

  const submit = (e) => {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) return;
    onAnalyze({ chain, address: trimmed });
  };

  if (variant === 'hero') {
    return (
      <form onSubmit={submit} className="w-full max-w-2xl mx-auto">
        <div className="hero-bar flex items-center gap-2 bg-[#0d0d10]/80 border border-zen-border rounded-xl pl-4 pr-2 py-2 transition focus-within:border-zen-accent">
          <div className="text-zen-muted shrink-0">
            <Search size={18} />
          </div>
          <input
            value={address}
            onChange={e => setAddress(e.target.value)}
            placeholder="Paste a wallet address…"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm py-1.5 mono placeholder:text-zen-muted"
            disabled={busy}
            autoFocus
          />
          <ChainSelect value={chain} onChange={setChain} disabled={busy} />
          <button type="submit" className="btn-primary !py-2 !px-4 shrink-0" disabled={busy || !address.trim()}>
            {busy ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 mt-4 text-xs text-zen-muted">
          <span>Press</span>
          <kbd className="kbd">Enter</kbd>
          <span>to analyze · or try a recent search</span>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="flex gap-2 items-stretch">
      <ChainSelect value={chain} onChange={setChain} disabled={busy} compact />
      <div className="relative flex-1">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zen-muted">
          <Search size={14} />
        </div>
        <input
          value={address}
          onChange={e => setAddress(e.target.value)}
          placeholder="Paste wallet address…"
          className="input pl-9"
          disabled={busy}
        />
      </div>
      <button type="submit" className="btn-primary disabled:opacity-50" disabled={busy || !address.trim()}>
        {busy ? 'Analyzing…' : 'Analyze'}
      </button>
    </form>
  );
}

function ChainSelect({ value, onChange, disabled, compact }) {
  return (
    <div className="relative">
      <div className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
        <ChainIcon chain={value} size={16} />
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className={`appearance-none ${compact ? 'input pl-9 pr-7 w-40' : 'bg-[#0d0d10] border border-zen-border rounded-lg pl-9 pr-7 py-1.5 text-sm mono cursor-pointer hover:border-[#2a2a31] transition w-36'}`}
      >
        {CHAIN_OPTIONS.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-zen-muted">
        <ChevronDown size={12} />
      </div>
    </div>
  );
}
