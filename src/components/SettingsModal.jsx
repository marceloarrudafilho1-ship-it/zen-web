import { useState } from 'react';
import { Close, Lock, External, Eye, EyeOff } from './Icons.jsx';
import { PALETTES, useTheme, setTheme } from '../lib/theme.js';

export function SettingsModal({ open, onClose, keys, onSave }) {
  const [draft, setDraft] = useState(keys);
  const theme = useTheme();

  if (!open) return null;

  const save = () => { onSave(draft); onClose(); };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4 fade-in" onClick={onClose}>
      <div className="card w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-lg font-semibold">API keys</h2>
            <p className="text-xs text-zen-muted mt-1 flex items-center gap-1.5">
              <Lock size={12} />
              Stored only in your browser. They never leave your machine.
            </p>
          </div>
          <button onClick={onClose} className="text-zen-muted hover:text-zen-text transition p-1">
            <Close size={18} />
          </button>
        </div>

        <div className="space-y-4 mt-6">
          <Field
            label="Etherscan v2"
            sub="Covers all EVM chains with one key"
            link="https://etherscan.io/myapikey"
            value={draft.etherscan}
            onChange={v => setDraft(d => ({ ...d, etherscan: v }))}
          />
          <Field
            label="Helius"
            sub="Required for Solana"
            link="https://dashboard.helius.dev"
            value={draft.helius}
            onChange={v => setDraft(d => ({ ...d, helius: v }))}
          />
          <Field
            label="CoinGecko Pro"
            sub="Optional — boosts price rate limit"
            link="https://www.coingecko.com/en/api/pricing"
            value={draft.coingecko}
            onChange={v => setDraft(d => ({ ...d, coingecko: v }))}
          />

          <div className="border-t border-zen-border pt-4 mt-2">
            <div className="text-xs uppercase tracking-wider text-zen-muted mb-3">Theme</div>
            <p className="text-xs text-zen-muted mb-3">Accent color used across the UI.</p>
            <div className="grid grid-cols-5 gap-2">
              {PALETTES.map(p => {
                const active = theme.id === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setTheme(p)}
                    title={p.name}
                    className={`group relative h-10 rounded-lg border transition flex items-center justify-center
                      ${active ? 'border-transparent' : 'border-zen-border hover:border-[#2a2a31]'}`}
                    style={{
                      background: `linear-gradient(135deg, ${p.hex} 0%, ${p.hex2} 100%)`,
                      boxShadow: active ? `0 0 0 2px ${p.hex}, 0 0 0 4px #0a0a0b` : undefined,
                    }}
                  >
                    {active && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0a0a0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="text-[10px] text-zen-muted mt-2 mono">{theme.name}</div>
          </div>

          <div className="border-t border-zen-border pt-4 mt-2">
            <div className="text-xs uppercase tracking-wider text-zen-muted mb-3">Investigation (Info tab)</div>
            <div className="space-y-4">
              <Field
                label="Snusbase"
                sub="Breach-data search — required for Info tab"
                link="https://snusbase.com/"
                value={draft.snusbase}
                onChange={v => setDraft(d => ({ ...d, snusbase: v }))}
              />
              <Field
                label="LeakPeek"
                sub="Optional — second breach-data source"
                link="https://leakpeek.com/"
                value={draft.leakpeek}
                onChange={v => setDraft(d => ({ ...d, leakpeek: v }))}
              />
              <Field
                label="web3.bio"
                sub="Optional — raises rate limits for the linked-identities lookup"
                link="https://api.web3.bio/"
                value={draft.web3bio}
                onChange={v => setDraft(d => ({ ...d, web3bio: v }))}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-7">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={save}>Save keys</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, sub, link, value, onChange }) {
  const [shown, setShown] = useState(false);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-sm font-medium">{label}</label>
        {link && (
          <a href={link} target="_blank" rel="noreferrer"
             className="text-xs text-zen-muted hover:text-zen-accent transition flex items-center gap-1">
            Get key <External size={10} />
          </a>
        )}
      </div>
      <div className="relative">
        <input
          type={shown ? 'text' : 'password'}
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="input pr-9"
          placeholder="Paste API key…"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-zen-muted hover:text-zen-text hover:bg-[#16161b] transition"
          tabIndex={-1}
          title={shown ? 'Hide key' : 'Show key'}
        >
          {shown ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {sub && <div className="text-xs text-zen-muted mt-1">{sub}</div>}
    </div>
  );
}
