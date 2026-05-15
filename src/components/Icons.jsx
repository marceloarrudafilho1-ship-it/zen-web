// Inline SVG icons — no external dependency, fully themable via currentColor.

import { useTheme } from '../lib/theme.js';

const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round' };

export function Logo({ size = 28 }) {
  const t = useTheme();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="zenGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={t.hex} />
          <stop offset="1" stopColor={t.hex2} />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" stroke="url(#zenGrad)" strokeWidth="1.5" fill="none" />
      <path d="M10 11 L22 11 L10 21 L22 21" stroke="url(#zenGrad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Search({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function Settings({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function ArrowDown({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  );
}

export function ArrowUp({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

export function Swap({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="m17 3 4 4-4 4" />
      <path d="M21 7H9" />
      <path d="m7 21-4-4 4-4" />
      <path d="M3 17h12" />
    </svg>
  );
}

export function TrendUp({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

export function TrendDown({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  );
}

export function Eye({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOff({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

export function Lock({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

export function Close({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function ChevronDown({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function External({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function Plus({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function Spinner({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" strokeOpacity="0.2" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Sparkle({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  );
}

export function Mail({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}

export function User({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function Globe({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

export function Server({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect width="20" height="8" x="2" y="2" rx="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" />
      <path d="M6 6h.01" />
      <path d="M6 18h.01" />
    </svg>
  );
}

export function Hash({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <line x1="4" x2="20" y1="9" y2="9" />
      <line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" />
      <line x1="16" x2="14" y1="3" y2="21" />
    </svg>
  );
}

export function Phone({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function Tag({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  );
}

export function IdCard({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M16 10h2" />
      <path d="M16 14h2" />
      <path d="M6.17 15a3 3 0 0 1 5.66 0" />
      <circle cx="9" cy="11" r="2" />
      <rect x="2" y="5" width="20" height="14" rx="2" />
    </svg>
  );
}

export function Wallet({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2" />
      <path d="M3 7h18a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H3" />
      <circle cx="17" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

export function Expand({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M3 9V5a2 2 0 0 1 2-2h4" />
      <path d="M3 15v4a2 2 0 0 0 2 2h4" />
      <path d="M21 9V5a2 2 0 0 0-2-2h-4" />
      <path d="M21 15v4a2 2 0 0 1-2 2h-4" />
    </svg>
  );
}

export function Collapse({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M9 3v4a2 2 0 0 1-2 2H3" />
      <path d="M15 3v4a2 2 0 0 0 2 2h4" />
      <path d="M9 21v-4a2 2 0 0 0-2-2H3" />
      <path d="M15 21v-4a2 2 0 0 1 2-2h4" />
    </svg>
  );
}

export function Save({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

export function FolderOpen({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <path d="M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function FitView({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 9h6v6H9z" />
    </svg>
  );
}

export function Info({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...base}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}

// Chain emblems — simplified SVG renditions of each network's brand mark.
export function ChainIcon({ chain, size = 14 }) {
  const Logo = CHAIN_LOGOS[chain];
  if (!Logo) {
    return (
      <span className="inline-block rounded-full"
        style={{ width: size, height: size, background: '#6b6b75' }} />
    );
  }
  return <Logo size={size} />;
}

const CHAIN_LOGOS = {
  ethereum: EthLogo,
  base: BaseLogo,
  arbitrum: ArbitrumLogo,
  optimism: OptimismLogo,
  polygon: PolygonLogo,
  bsc: BnbLogo,
  solana: SolanaLogo,
  xrp: XrpLogo,
  litecoin: LitecoinLogo,
  bitcoin: BitcoinLogo,
};

function EthLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 417" preserveAspectRatio="xMidYMid meet">
      <g fillRule="nonzero">
        <path fill="#8A92B2" d="M127.96 0l-2.8 9.5v275.66l2.8 2.8L255.92 212.32z"/>
        <path fill="#62688F" d="M127.96 0L0 212.32l127.96 75.64V154.16z"/>
        <path fill="#454A75" d="M127.96 312.19l-1.57 1.92v98.2l1.57 4.6L256 236.59z"/>
        <path fill="#8A92B2" d="M127.96 416.9v-104.72L0 236.59z"/>
        <path fill="#62688F" d="M127.96 287.96l127.96-75.64-127.96-58.16z"/>
        <path fill="#454A75" d="M0 212.32l127.96 75.64V154.16z"/>
      </g>
    </svg>
  );
}

function BaseLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#0052ff"/>
      <path d="M15.5 25.4c5.2 0 9.4-4.2 9.4-9.4s-4.2-9.4-9.4-9.4c-4.93 0-8.97 3.78-9.36 8.6h13.94v1.6H6.14c.39 4.82 4.43 8.6 9.36 8.6z" fill="#fff"/>
    </svg>
  );
}

function ArbitrumLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#2d374b"/>
      <path d="M16.5 8.4l5.7 9.86 1.4-.81-6.04-10.45a1 1 0 0 0-1.74 0l-.81 1.4z" fill="#28a0f0"/>
      <path d="M22.92 18.74L17 8.5a1 1 0 0 0-1.7 0L9.5 18.62 14 11l4.5 7.74h4.42z" fill="#fff"/>
      <path d="M22.6 23.6L16 12 9.4 23.6h13.2z" fill="#28a0f0"/>
      <path d="M14.8 14.7l-2.4 4.16h2.86l-.46-4.16z" fill="#fff"/>
    </svg>
  );
}

function OptimismLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#ff0420"/>
      <ellipse cx="11.5" cy="16" rx="3.4" ry="4.5" fill="none" stroke="#fff" strokeWidth="2.2"/>
      <path d="M17.4 20.8l1.7-6.4h2c.9 0 1.5.4 1.5 1.2 0 1.05-.8 1.6-2 1.6h-1.2l-.4 1.5h1.3c2.2 0 4-1.1 4-3.3 0-1.6-1.2-2.6-3.1-2.6h-3.7l-2 7.9h1.9z" fill="#fff"/>
    </svg>
  );
}

function PolygonLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#8247e5"/>
      <path d="M20.6 13.3c-.36-.2-.82-.2-1.22 0l-2.84 1.66-1.93 1.07-2.8 1.66c-.36.2-.82.2-1.22 0l-2.2-1.3a1.22 1.22 0 0 1-.62-1.06v-2.5c0-.4.2-.82.62-1.07l2.18-1.27c.36-.2.82-.2 1.22 0l2.18 1.3c.36.2.62.62.62 1.06v1.66l1.93-1.1V11.7c0-.4-.2-.82-.62-1.07L11.85 8.3c-.36-.2-.82-.2-1.22 0L6.62 10.65c-.42.2-.62.62-.62 1.06v4.7c0 .4.2.82.62 1.07L10.62 19.8c.36.2.82.2 1.22 0l2.8-1.62 1.93-1.1 2.8-1.62c.36-.2.82-.2 1.22 0l2.18 1.27c.36.2.62.62.62 1.07v2.5c0 .4-.2.82-.62 1.07l-2.14 1.27c-.36.2-.82.2-1.22 0l-2.18-1.27a1.22 1.22 0 0 1-.62-1.07V19.7l-1.93 1.1v1.65c0 .4.2.82.62 1.07l3.97 2.32c.36.2.82.2 1.22 0l3.97-2.32c.36-.2.62-.62.62-1.07v-4.7c0-.4-.2-.82-.62-1.07L20.6 13.3z" fill="#fff"/>
    </svg>
  );
}

function BnbLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#f0b90b"/>
      <g fill="#fff">
        <path d="M11.18 16L16 11.17 20.82 16 23.62 13.2 16 5.58 8.38 13.2z"/>
        <path d="M5.58 16L8.38 13.2 11.18 16 8.38 18.8z"/>
        <path d="M11.18 16L16 20.83 20.82 16 23.62 18.8 16 26.42 8.38 18.8z"/>
        <path d="M20.82 16L23.62 13.2 26.42 16 23.62 18.8z"/>
        <path d="M18.83 16L16 13.17 13.84 15.31l-.25.25-.5.5-.02.02L13.17 16 16 18.83z"/>
      </g>
    </svg>
  );
}

function SolanaLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <defs>
        <linearGradient id="solGradA" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00ffa3"/>
          <stop offset="100%" stopColor="#dc1fff"/>
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="16" fill="#0a0a0b"/>
      <path d="M9.6 21.4a.7.7 0 0 1 .5-.2h13.4c.32 0 .48.4.25.62l-2.65 2.65a.7.7 0 0 1-.5.2H7.2c-.32 0-.48-.4-.25-.62l2.65-2.65z" fill="url(#solGradA)"/>
      <path d="M9.6 11.5a.7.7 0 0 1 .5-.2h13.4c.32 0 .48.4.25.62L21.1 14.57a.7.7 0 0 1-.5.2H7.2c-.32 0-.48-.4-.25-.62L9.6 11.5z" fill="url(#solGradA)"/>
      <path d="M21.1 16.45a.7.7 0 0 0-.5-.2H7.2c-.32 0-.48.4-.25.62l2.65 2.65a.7.7 0 0 0 .5.2h13.4c.32 0 .48-.4.25-.62l-2.65-2.65z" fill="url(#solGradA)"/>
    </svg>
  );
}

function XrpLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#23292f"/>
      <path d="M9 9 L16 15.5 L23 9 M9 23 L16 16.5 L23 23"
        stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function LitecoinLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#345d9d"/>
      <path d="M16.3 6.4 L13 18.6 L10.6 19.4 L10 21.6 L12.4 20.8 L11.4 24.6 L24 24.6 L24.6 21.8 L14.8 21.8 L15.7 18.6 L18 17.9 L18.6 15.8 L16.3 16.5 L18.6 7.2 Z"
        fill="#fff"/>
    </svg>
  );
}

function BitcoinLogo({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      <circle cx="16" cy="16" r="16" fill="#f7931a"/>
      <path d="M21.6 14.2c.3-2-.95-3-2.7-3.7l.55-2.25-1.4-.35-.55 2.2c-.36-.1-.74-.18-1.1-.27l.55-2.2-1.4-.35-.55 2.25c-.3-.07-.6-.14-.88-.2l-1.93-.5-.37 1.5s1.04.24 1.02.25c.57.14.67.52.65.82l-1.6 6.43c-.07.18-.25.44-.66.34l-1.04-.26-.7 1.6 1.84.46c.34.08.67.17.99.26l-.56 2.27 1.4.35.56-2.25c.38.1.75.2 1.11.29l-.55 2.24 1.4.35.56-2.27c2.39.45 4.18.27 4.93-1.9.6-1.74-.03-2.74-1.3-3.4.92-.21 1.61-.83 1.8-2.1zm-3.2 4.5c-.43 1.74-3.36.8-4.32.56l.74-2.99c.96.24 4.02.71 3.58 2.43zm.43-4.53c-.39 1.58-2.83.78-3.62.58l.67-2.71c.79.2 3.36.57 2.95 2.13z"
        fill="#fff"/>
    </svg>
  );
}
