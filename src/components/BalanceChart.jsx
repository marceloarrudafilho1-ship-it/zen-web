import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot, Area, AreaChart } from 'recharts';
import { fmtUsd, fmtDate } from '../lib/format.js';
import { TrendUp, TrendDown } from './Icons.jsx';
import { useTheme } from '../lib/theme.js';

export function BalanceChart({ series, extrema, onSelectExtremum }) {
  const theme = useTheme();
  const accent = theme.hex;
  const data = series.map(p => ({ ts: p.t * 1000, usd: p.usd, txId: p.txId }));

  return (
    <div className="card p-6 fade-in h-full flex flex-col">
      <div className="flex items-baseline justify-between mb-5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold">Balance over time</h2>
          <p className="text-xs text-zen-muted mt-0.5">USD value of all holdings, replayed from history</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6 shrink-0">
        <ExtremumCard label="Highest balance" point={extrema.high} accent="green" Icon={TrendUp}
          onClick={() => extrema.high && onSelectExtremum(extrema.high)} />
        <ExtremumCard label="Lowest balance" point={extrema.low} accent="red" Icon={TrendDown}
          onClick={() => extrema.low && onSelectExtremum(extrema.low)} />
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="balanceFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.4} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="ts"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={(ts) => new Date(ts).toISOString().slice(0, 10)}
              stroke="#2a2a31"
              tick={{ fill: '#6b6b75', fontSize: 11 }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtUsd}
              stroke="#2a2a31"
              tick={{ fill: '#6b6b75', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={70}
            />
            <Tooltip
              contentStyle={{ background: '#111114', border: '1px solid #1f1f24', borderRadius: 8, fontSize: 12 }}
              labelFormatter={(ts) => fmtDate(ts / 1000)}
              formatter={(v) => [fmtUsd(v), 'Balance']}
              cursor={{ stroke: accent, strokeWidth: 1, strokeDasharray: '3 3' }}
            />
            <Area type="monotone" dataKey="usd" stroke={accent} strokeWidth={1.75} fill="url(#balanceFill)" dot={false} />
            {extrema.high && (
              <ReferenceDot x={extrema.high.t * 1000} y={extrema.high.usd} r={5} fill="#4ade80" stroke="#0a0a0b" strokeWidth={2} />
            )}
            {extrema.low && (
              <ReferenceDot x={extrema.low.t * 1000} y={extrema.low.usd} r={5} fill="#f87171" stroke="#0a0a0b" strokeWidth={2} />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ExtremumCard({ label, point, accent, Icon, onClick }) {
  const colors = {
    green: { text: 'text-zen-green', bg: 'bg-zen-green/10', ring: 'ring-zen-green/20' },
    red:   { text: 'text-zen-red',   bg: 'bg-zen-red/10',   ring: 'ring-zen-red/20' },
  }[accent];

  return (
    <button
      onClick={onClick}
      disabled={!point}
      className="text-left p-4 rounded-xl border border-zen-border bg-[#0d0d10]/60 hover:bg-[#13131a] hover:border-[#2a2a31] transition disabled:opacity-50 disabled:cursor-default group"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-zen-muted uppercase tracking-wider">{label}</div>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors.bg} ${colors.text} ring-1 ${colors.ring}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className={`text-2xl font-semibold ${colors.text}`}>{fmtUsd(point?.usd)}</div>
      <div className="text-xs text-zen-muted mono mt-1 group-hover:text-zen-text transition">
        {point ? fmtDate(point.t) : '—'}
      </div>
    </button>
  );
}
