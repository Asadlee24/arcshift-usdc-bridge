// app/analytics/page.tsx
// ArcShift Analytics v5 — Ultra-detailed, Light/Dark theme, SVG line chart, full metrics

'use client';

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Users, Zap, ArrowRightLeft, ExternalLink,
  RefreshCw, TrendingUp, ShieldCheck, Search,
  Award, Flame, MapPin, Compass, Download, Activity, Layers,
  Globe, Clock, ChevronUp, ChevronDown, Wifi, CheckCircle2,
  Sun, Moon, Target, Hash, Percent, Timer, Trophy, Star
} from 'lucide-react';
import { getAllTxsFromSupabase, SupabaseTx } from '../../lib/supabase';
import { getChainById, SUPPORTED_CHAINS } from '../../constants/chains';
import { measureChainLatency } from '../../lib/rpcClient';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtUSDC(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
function fmtShortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
function fmtNum(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

// ── SVG Line Chart ────────────────────────────────────────────────────────────

function LineChart({ data, color = '#C8922A', height = 80 }: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const w = 400;
  const h = height;
  const pad = { t: 8, r: 4, b: 28, l: 4 };
  const max = Math.max(...data.map(d => d.value), 1);
  const min = 0;
  const pts = data.map((d, i) => {
    const x = pad.l + (i / (data.length - 1 || 1)) * (w - pad.l - pad.r);
    const y = pad.t + (1 - (d.value - min) / (max - min)) * (h - pad.t - pad.b);
    return { x, y, ...d };
  });
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = [
    `M ${pts[0]?.x} ${h - pad.b}`,
    ...pts.map(p => `L ${p.x} ${p.y}`),
    `L ${pts[pts.length - 1]?.x} ${h - pad.b}`,
    'Z'
  ].join(' ');
  const gradId = `grad-${color.replace('#', '')}`;

  return (
    <div className="w-full relative" style={{ height }}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full overflow-visible">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0.25, 0.5, 0.75, 1].map(f => (
          <line key={f}
            x1={pad.l} y1={pad.t + (1 - f) * (h - pad.t - pad.b)}
            x2={w - pad.r} y2={pad.t + (1 - f) * (h - pad.t - pad.b)}
            stroke="currentColor" strokeOpacity="0.08" strokeWidth="1" strokeDasharray="4 4"
          />
        ))}
        {/* Area fill */}
        {pts.length > 1 && (
          <motion.path d={areaD} fill={`url(#${gradId})`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1 }} />
        )}
        {/* Line */}
        {pts.length > 1 && (
          <motion.path d={pathD} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        )}
        {/* Dots + labels */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={color} />
            <text x={p.x} y={h - 6} textAnchor="middle" fontSize="9" fill="currentColor" fillOpacity="0.4" fontWeight="700">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ── Horizontal Bar ────────────────────────────────────────────────────────────

function HBar({ name, value, max, color, sub }: { name: string; value: number; max: number; color: string; sub?: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] font-bold w-16 shrink-0 truncate opacity-70">{name}</span>
      <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-black/10 dark:bg-white/5">
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
        />
      </div>
      <span className="text-[10px] font-mono font-black w-14 text-right shrink-0">{fmtUSDC(value)}</span>
      {sub && <span className="text-[9px] opacity-40 shrink-0">{sub}</span>}
    </div>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, accent = '#C8922A', dark }: {
  icon: any; label: string; value: string | number; sub?: string; accent?: string; dark: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, scale: 1.015, transition: { duration: 0.15 } }}
      className={`relative rounded-2xl p-5 overflow-hidden border transition-all duration-300 shadow-sm ${
        dark
          ? 'bg-[#0C1525]/90 border-slate-800 hover:border-[#C8922A]/40 shadow-black/40'
          : 'bg-white border-slate-200 hover:border-[#C8922A]/50 shadow-slate-100'
      }`}
    >
      <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20" style={{ background: accent }} />
      <div className="flex items-start justify-between mb-3">
        <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</span>
        <div className="p-2 rounded-xl" style={{ background: `${accent}18`, border: `1px solid ${accent}30` }}>
          <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
        </div>
      </div>
      <p className={`text-2xl sm:text-3xl font-black tracking-tight tabular-nums ${dark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className={`text-[9px] mt-1.5 font-semibold uppercase tracking-wide ${dark ? 'text-slate-600' : 'text-slate-400'}`}>{sub}</p>}
    </motion.div>
  );
}

// ── Latency Dot ───────────────────────────────────────────────────────────────

function LatDot({ ms }: { ms: number | undefined }) {
  if (ms === undefined) return <span className="text-[9px] font-mono opacity-30 animate-pulse">···</span>;
  if (ms === -1) return <span className="text-[9px] font-black text-red-500">Off</span>;
  const c = ms < 150 ? 'text-emerald-500' : ms < 400 ? 'text-amber-500' : 'text-red-500';
  const bg = ms < 150 ? 'bg-emerald-500/10' : ms < 400 ? 'bg-amber-500/10' : 'bg-red-500/10';
  return <span className={`text-[9px] font-mono font-black ${c} ${bg} px-1.5 py-0.5 rounded-full`}>{ms}ms</span>;
}

// ── Heatmap Cell ──────────────────────────────────────────────────────────────

function HeatCell({ value, max, dark }: { value: number; max: number; dark: boolean }) {
  const pct = max > 0 ? value / max : 0;
  const opacity = 0.08 + pct * 0.9;
  return (
    <div
      className="rounded aspect-square"
      style={{ background: `rgba(200,146,42,${opacity})` }}
      title={`${value} tx`}
    />
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [dark, setDark] = useState(true);
  const [allTxs, setAllTxs] = useState<SupabaseTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChainFilter, setSelectedChainFilter] = useState('all');
  const [timeframeFilter, setTimeframeFilter] = useState<'all' | '7d' | '24h'>('all');
  const [chainLatencies, setChainLatencies] = useState<Record<number, number>>({});
  const [sortKey, setSortKey] = useState<'time' | 'amount'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadData = useCallback(async () => {
    setLoading(true);
    const data = await getAllTxsFromSupabase();
    setAllTxs(data);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
    const iv = setInterval(loadData, 30000);
    return () => clearInterval(iv);
  }, [loadData]);

  useEffect(() => {
    SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana).forEach(async chain => {
      const lat = await measureChainLatency(chain.id);
      setChainLatencies(prev => ({ ...prev, [chain.id]: lat }));
    });
  }, []);

  // Filtered by timeframe + success
  const successTxs = useMemo(() => {
    const now = Date.now();
    const oneDay = 86_400_000;
    return allTxs.filter(t => {
      if (t.status !== 'success') return false;
      const txTime = new Date(t.timestamp).getTime();
      if (timeframeFilter === '24h') return now - txTime <= oneDay;
      if (timeframeFilter === '7d') return now - txTime <= 7 * oneDay;
      return true;
    });
  }, [allTxs, timeframeFilter]);

  const stats = useMemo(() => {
    const totalCount = successTxs.length;
    const pendingCount = allTxs.filter(t => t.status === 'pending').length;
    const failedCount = allTxs.filter(t => t.status === 'failed').length;
    const totalAll = allTxs.length;
    const successRate = totalAll > 0 ? (totalCount / totalAll) * 100 : 0;

    const amounts = successTxs.map(t => parseFloat(t.amount || '0'));
    const totalVolume = amounts.reduce((a, b) => a + b, 0);
    const avgTxSize = totalCount > 0 ? totalVolume / totalCount : 0;
    const maxTx = amounts.length > 0 ? Math.max(...amounts) : 0;
    const minTx = amounts.length > 0 ? Math.min(...amounts) : 0;

    const uniqueWallets = new Set(successTxs.map(t => t.user_address.toLowerCase())).size;
    const uniqueFromChains = new Set(successTxs.map(t => t.from_chain_id)).size;
    const uniqueToChains = new Set(successTxs.map(t => t.to_chain_id)).size;

    // Source chain dist
    const fromDist: Record<string, { count: number; volume: number; color: string }> = {};
    successTxs.forEach(t => {
      const ch = getChainById(t.from_chain_id);
      const name = ch?.shortName || `${t.from_chain_id}`;
      if (!fromDist[name]) fromDist[name] = { count: 0, volume: 0, color: ch?.color || '#C8922A' };
      fromDist[name].count++;
      fromDist[name].volume += parseFloat(t.amount || '0');
    });
    const sortedFrom = Object.entries(fromDist).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.volume - a.volume);

    // Dest chain dist
    const toDist: Record<string, { count: number; volume: number; color: string }> = {};
    successTxs.forEach(t => {
      const ch = getChainById(t.to_chain_id);
      const name = ch?.shortName || `${t.to_chain_id}`;
      if (!toDist[name]) toDist[name] = { count: 0, volume: 0, color: ch?.color || '#10B981' };
      toDist[name].count++;
      toDist[name].volume += parseFloat(t.amount || '0');
    });
    const sortedTo = Object.entries(toDist).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.volume - a.volume);

    // Routes
    const routeDist: Record<string, { count: number; volume: number; from: string; to: string }> = {};
    successTxs.forEach(t => {
      const f = getChainById(t.from_chain_id)?.shortName || `${t.from_chain_id}`;
      const to = getChainById(t.to_chain_id)?.shortName || `${t.to_chain_id}`;
      const key = `${f}→${to}`;
      if (!routeDist[key]) routeDist[key] = { count: 0, volume: 0, from: f, to };
      routeDist[key].count++;
      routeDist[key].volume += parseFloat(t.amount || '0');
    });
    const sortedRoutes = Object.entries(routeDist).map(([route, d]) => ({ route, ...d })).sort((a, b) => b.volume - a.volume).slice(0, 8);

    // Leaderboard
    const walletDist: Record<string, { volume: number; count: number }> = {};
    successTxs.forEach(t => {
      const w = t.user_address.toLowerCase();
      if (!walletDist[w]) walletDist[w] = { volume: 0, count: 0 };
      walletDist[w].volume += parseFloat(t.amount || '0');
      walletDist[w].count++;
    });
    const leaderboard = Object.entries(walletDist).map(([wallet, d]) => ({ wallet, ...d })).sort((a, b) => b.volume - a.volume).slice(0, 10);

    // Volume time series — 14 buckets
    const NUM = 14;
    const now = Date.now();
    const spanMs = timeframeFilter === '24h' ? 86_400_000 : timeframeFilter === '7d' ? 7 * 86_400_000 : 30 * 86_400_000;
    const bucketMs = spanMs / NUM;
    const buckets = Array.from({ length: NUM }, (_, i) => {
      const bucketStart = now - spanMs + i * bucketMs;
      const label = timeframeFilter === '24h'
        ? `${new Date(bucketStart).getHours()}h`
        : timeframeFilter === '7d'
        ? ['Su','Mo','Tu','We','Th','Fr','Sa'][new Date(bucketStart).getDay()]
        : `D${i + 1}`;
      return { label, volume: 0, count: 0 };
    });
    successTxs.forEach(t => {
      const age = now - new Date(t.timestamp).getTime();
      const idx = Math.floor((spanMs - age) / bucketMs);
      if (idx >= 0 && idx < NUM) {
        buckets[idx].volume += parseFloat(t.amount || '0');
        buckets[idx].count++;
      }
    });

    // Hourly heatmap (24 hours x 7 days)
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    const heatmaxAll = allTxs.filter(t => t.status === 'success').forEach(t => {
      const d = new Date(t.timestamp);
      heatmap[d.getDay()][d.getHours()]++;
    });
    const heatMax = Math.max(...heatmap.flat(), 1);

    // Hourly distribution (0-23)
    const hourlyVol: number[] = Array(24).fill(0);
    successTxs.forEach(t => {
      hourlyVol[new Date(t.timestamp).getHours()] += parseFloat(t.amount || '0');
    });
    const peakHour = hourlyVol.indexOf(Math.max(...hourlyVol));

    // Amount distribution buckets
    const amtBuckets = [
      { label: '<$1', min: 0, max: 1, count: 0 },
      { label: '$1-10', min: 1, max: 10, count: 0 },
      { label: '$10-100', min: 10, max: 100, count: 0 },
      { label: '$100-1K', min: 100, max: 1000, count: 0 },
      { label: '>$1K', min: 1000, max: Infinity, count: 0 },
    ];
    successTxs.forEach(t => {
      const a = parseFloat(t.amount || '0');
      const b = amtBuckets.find(b => a >= b.min && a < b.max);
      if (b) b.count++;
    });

    return {
      totalCount, pendingCount, failedCount, totalAll, successRate,
      totalVolume, avgTxSize, maxTx, minTx,
      uniqueWallets, uniqueFromChains, uniqueToChains,
      sortedFrom, sortedTo, sortedRoutes, leaderboard,
      buckets, heatmap, heatMax, peakHour, hourlyVol,
      amtBuckets,
    };
  }, [successTxs, allTxs, timeframeFilter]);

  // Filtered/sorted tx list
  const filteredTxs = useMemo(() => {
    const r = successTxs.filter(tx => {
      const q = searchQuery.toLowerCase();
      const matchSearch = tx.user_address.toLowerCase().includes(q) ||
        (tx.burn_tx_hash && tx.burn_tx_hash.toLowerCase().includes(q));
      const matchChain = selectedChainFilter === 'all' ||
        String(tx.from_chain_id) === selectedChainFilter ||
        String(tx.to_chain_id) === selectedChainFilter;
      return matchSearch && matchChain;
    });
    return r.sort((a, b) => {
      const diff = sortKey === 'amount'
        ? parseFloat(a.amount) - parseFloat(b.amount)
        : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [successTxs, searchQuery, selectedChainFilter, sortKey, sortDir]);

  const handleCSV = () => {
    if (!filteredTxs.length) return;
    const h = ['Time', 'From', 'To', 'USDC', 'Mode', 'Wallet', 'Burn Tx'];
    const rows = filteredTxs.map(t => [
      `"${new Date(t.timestamp).toISOString()}"`,
      getChainById(t.from_chain_id)?.shortName || t.from_chain_id,
      getChainById(t.to_chain_id)?.shortName || t.to_chain_id,
      t.amount, 'CCTP Auto-Relay',
      `"${t.user_address}"`, `"${t.burn_tx_hash || ''}"`,
    ].join(','));
    const blob = new Blob([[h.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const a = Object.assign(document.createElement('a'), {
      href: URL.createObjectURL(blob),
      download: `arcshift-${new Date().toISOString().slice(0, 10)}.csv`
    });
    a.click();
  };

  const onlineChains = SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana && chainLatencies[c.id] !== -1 && chainLatencies[c.id] !== undefined).length;
  const probedChains = SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana && chainLatencies[c.id] !== undefined).length;
  const avgLat = probedChains > 0 ? Math.round(Object.values(chainLatencies).filter(v => v !== -1).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(chainLatencies).filter(v => v !== -1).length)) : 0;

  const bg = dark ? 'bg-[#050A14]' : 'bg-slate-50';
  const cardBg = dark ? 'bg-[#0C1525]/90 border-slate-800' : 'bg-white border-slate-200';
  const text = dark ? 'text-white' : 'text-slate-900';
  const subText = dark ? 'text-slate-400' : 'text-slate-500';
  const divider = dark ? 'border-slate-900' : 'border-slate-200';
  const hdrBg = dark ? 'bg-[#050A14]/95 border-slate-900/80' : 'bg-white/95 border-slate-200';
  const inputBg = dark ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600' : 'bg-slate-100 border-slate-200 text-slate-900 placeholder-slate-400';

  const GOLD = '#C8922A';
  const GREEN = '#10B981';

  return (
    <div className={`min-h-screen ${bg} ${text} font-sans overflow-x-hidden transition-colors duration-300`}>

      {/* BG glows */}
      {dark && <>
        <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-[#C8922A]/4 rounded-full blur-[150px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
        <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-emerald-900/5 rounded-full blur-[150px] pointer-events-none translate-x-1/2 translate-y-1/2" />
      </>}

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className={`border-b ${hdrBg} backdrop-blur-2xl sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center group shrink-0">
              <img src="https://i.ibb.co/x8BwmWJR/6ceb4b2f-4218-408d-b61a-c34d0f3f181e.png" alt="ArcShift" className="h-9 w-auto object-contain transition-transform group-hover:scale-105" />
            </a>
            <div className={`hidden sm:flex items-center gap-2 border-l ${divider} pl-3`}>
              <BarChart3 className="h-3.5 w-3.5 text-[#C8922A]" />
              <span className={`text-[11px] font-black uppercase tracking-[0.15em] ${subText}`}>Analytics Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Timeframe */}
            <div className={`hidden sm:flex p-1 rounded-xl border ${dark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              {(['all', '7d', '24h'] as const).map(tf => (
                <button key={tf} onClick={() => setTimeframeFilter(tf)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    timeframeFilter === tf
                      ? 'bg-[#C8922A] text-white shadow-lg shadow-[#C8922A]/20'
                      : `${subText} hover:${text}`
                  }`}>
                  {tf === 'all' ? 'All' : tf}
                </button>
              ))}
            </div>
            {/* Theme toggle */}
            <button
              onClick={() => setDark(d => !d)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${dark ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'}`}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={loadData} disabled={loading}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${dark ? 'text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border-slate-800' : 'text-slate-600 hover:text-slate-900 bg-slate-100 border-slate-200'}`}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#C8922A]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {lastRefresh && (
              <span className={`hidden md:flex items-center gap-1 text-[9px] font-mono ${dark ? 'text-slate-600' : 'text-slate-400'}`}>
                <Clock className="h-3 w-3" /> {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <a href="/" className="text-[11px] font-black bg-gradient-to-r from-[#C8922A] to-[#E8A830] hover:opacity-90 text-white px-4 py-1.5 rounded-xl shadow-lg shadow-[#C8922A]/20">
              Launch Bridge
            </a>
          </div>
        </div>
      </div>

      {/* ── Live Marquee ──────────────────────────────────────────── */}
      <div className={`border-b ${dark ? 'bg-[#0A1122] border-slate-900/60' : 'bg-slate-100 border-slate-200'} py-2 overflow-hidden`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-3">
          <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider shrink-0">
            <Flame className="h-2.5 w-2.5" /> Live Feed
          </div>
          <div className="flex-1 overflow-hidden h-5 relative">
            <div className="absolute inset-0 flex items-center whitespace-nowrap animate-[marquee_35s_linear_infinite] hover:[animation-play-state:paused] gap-10">
              {successTxs.length > 0
                ? successTxs.slice(0, 12).map((t, i) => {
                    const fc = getChainById(t.from_chain_id);
                    const tc = getChainById(t.to_chain_id);
                    return (
                      <span key={i} className={`inline-flex items-center gap-2 text-[11px] font-bold shrink-0 ${subText}`}>
                        <span className={`font-mono ${text}`}>{fmtShortAddr(t.user_address)}</span>
                        <span className="text-[#C8922A] font-mono font-black">${parseFloat(t.amount).toFixed(2)}</span>
                        <span>{fc?.shortName} → {tc?.shortName}</span>
                        <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">⚡ Auto</span>
                        <span className={`${dark ? 'text-slate-700' : 'text-slate-300'}`}>·</span>
                      </span>
                    );
                  })
                : <span className={`text-[11px] ${subText}`}>No data yet…</span>
              }
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Title ─────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C8922A]/10 border border-[#C8922A]/25 text-[#C8922A] text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="h-3 w-3" /> Circle CCTP v2 Forwarding
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${dark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
              <Wifi className="h-3 w-3" /> {onlineChains}/{probedChains} Chains Online
            </span>
            <motion.span
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${dark ? 'bg-violet-500/10 border-violet-500/20 text-violet-400' : 'bg-violet-50 border-violet-200 text-violet-600'}`}>
              <Zap className="h-3 w-3" /> 100% Auto-Relay
            </motion.span>
          </div>
          <h1 className={`text-3xl sm:text-5xl font-black tracking-tight mb-2 ${dark ? 'bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent' : ''}`}>
            Bridge Analytics
          </h1>
          <p className={`text-sm max-w-2xl leading-relaxed ${subText}`}>
            Comprehensive CCTP v2 metrics — volume trends, chain distribution, relay performance, wallet leaderboard, and on-chain diagnostics. All bridges fully auto-relayed. ⚡
          </p>
        </motion.div>

        {/* ── KPI Row 1 — 4 main ────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <StatCard dark={dark} icon={ArrowRightLeft} label="Total Bridges" accent={GOLD}
            value={loading ? '—' : fmtNum(stats.totalCount)} sub="Verified Auto-Relayed" />
          <StatCard dark={dark} icon={Layers} label="Total Volume" accent={GREEN}
            value={loading ? '—' : fmtUSDC(stats.totalVolume)} sub="USDC Bridged" />
          <StatCard dark={dark} icon={Users} label="Unique Wallets" accent="#06B6D4"
            value={loading ? '—' : fmtNum(stats.uniqueWallets)} sub="Active Addresses" />
          <StatCard dark={dark} icon={Percent} label="Success Rate" accent="#8B5CF6"
            value={loading ? '—' : `${stats.successRate.toFixed(1)}%`} sub={`${stats.failedCount} failed`} />
        </div>

        {/* ── KPI Row 2 — 4 detail ──────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard dark={dark} icon={Target} label="Avg Transfer" accent="#F59E0B"
            value={loading ? '—' : fmtUSDC(stats.avgTxSize)} sub="Per transaction" />
          <StatCard dark={dark} icon={Trophy} label="Largest Transfer" accent="#EF4444"
            value={loading ? '—' : fmtUSDC(stats.maxTx)} sub="Single tx record" />
          <StatCard dark={dark} icon={Hash} label="Active Routes" accent="#10B981"
            value={loading ? '—' : stats.sortedRoutes.length} sub={`${stats.uniqueFromChains} source chains`} />
          <StatCard dark={dark} icon={Timer} label="Peak Hour" accent="#C8922A"
            value={loading ? '—' : `${stats.peakHour}:00`} sub="Highest activity" />
        </div>

        {/* ── CCTP Status Banner ────────────────────────────────────── */}
        <div className={`mb-8 rounded-2xl border overflow-hidden ${dark ? 'border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-[#0C1525]/70 to-[#0C1525]/40' : 'border-emerald-200 bg-gradient-to-r from-emerald-50 to-white'}`}>
          <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${dark ? 'bg-emerald-500/15 border border-emerald-500/25' : 'bg-emerald-100 border border-emerald-200'}`}>
                <Zap className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className={`font-black text-sm uppercase tracking-widest ${dark ? 'text-white' : 'text-slate-900'}`}>CCTP Forwarding Service — All Routes Active</p>
                <p className={`text-[11px] mt-0.5 ${subText}`}>
                  <span className="text-emerald-500 font-bold">depositForBurnWithHook</span> · No manual mint · 1 wallet signature · Circle handles attestation & mint
                </p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              {[
                { label: 'Auto-Relay Rate', value: loading ? '—' : '100%', color: 'text-emerald-500' },
                { label: 'Pending', value: loading ? '—' : stats.pendingCount, color: 'text-amber-500' },
                { label: 'Total All Time', value: loading ? '—' : fmtNum(stats.totalAll), color: dark ? 'text-white' : 'text-slate-900' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${subText}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Volume Line Chart (full width) ────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          className={`mb-8 rounded-2xl border p-5 ${cardBg}`}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className={`font-black text-xs uppercase tracking-widest flex items-center gap-2 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <TrendingUp className="h-4 w-4 text-[#C8922A]" /> Volume Over Time
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
                {timeframeFilter === '24h' ? '24 Hours' : timeframeFilter === '7d' ? '7 Days' : '30 Days'}
              </span>
            </h2>
            <div className="text-right">
              <p className="text-lg font-black" style={{ color: GOLD }}>{fmtUSDC(stats.totalVolume)}</p>
              <p className={`text-[9px] uppercase tracking-widest font-bold ${subText}`}>Total Volume</p>
            </div>
          </div>
          <div className={dark ? 'text-white' : 'text-slate-900'}>
            <LineChart data={stats.buckets.map(b => ({ label: b.label, value: b.volume }))} color={GOLD} height={120} />
          </div>
          <div className={`mt-4 flex gap-6 text-[10px] font-bold uppercase tracking-wider ${subText}`}>
            <span>Peak: {fmtUSDC(Math.max(...stats.buckets.map(b => b.volume)))}</span>
            <span>Avg: {fmtUSDC(stats.totalVolume / Math.max(stats.buckets.filter(b => b.volume > 0).length, 1))}</span>
            <span>Txs: {fmtNum(stats.totalCount)}</span>
          </div>
        </motion.div>

        {/* ── 3-col: Source + Dest + Routes ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Source chain */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className={`rounded-2xl border p-5 ${cardBg}`}>
            <h2 className={`font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-4 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <BarChart3 className="h-4 w-4 text-[#C8922A]" /> Source Chains
            </h2>
            {loading ? <div className={`py-10 text-center text-xs animate-pulse ${subText}`}>Loading…</div>
              : stats.sortedFrom.length === 0 ? <div className={`py-10 text-center text-xs ${subText}`}>No data.</div>
              : (
                <div className="flex flex-col gap-3">
                  {stats.sortedFrom.slice(0, 8).map(d => (
                    <HBar key={d.name} name={d.name} value={d.volume} max={stats.sortedFrom[0].volume} color={d.color} sub={`${d.count}tx`} />
                  ))}
                </div>
              )}
          </motion.div>

          {/* Destination chain */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={`rounded-2xl border p-5 ${cardBg}`}>
            <h2 className={`font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-4 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <MapPin className="h-4 w-4 text-emerald-500" /> Destination Chains
            </h2>
            {loading ? <div className={`py-10 text-center text-xs animate-pulse ${subText}`}>Loading…</div>
              : stats.sortedTo.length === 0 ? <div className={`py-10 text-center text-xs ${subText}`}>No data.</div>
              : (
                <div className="flex flex-col gap-3">
                  {stats.sortedTo.slice(0, 8).map(d => (
                    <HBar key={d.name} name={d.name} value={d.volume} max={stats.sortedTo[0].volume} color={d.color} sub={`${d.count}tx`} />
                  ))}
                </div>
              )}
          </motion.div>

          {/* Routes */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className={`rounded-2xl border p-5 ${cardBg}`}>
            <h2 className={`font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-4 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <ArrowRightLeft className="h-4 w-4 text-[#C8922A]" /> Top Routes
            </h2>
            {loading ? <div className={`py-10 text-center text-xs animate-pulse ${subText}`}>Loading…</div>
              : stats.sortedRoutes.length === 0 ? <div className={`py-10 text-center text-xs ${subText}`}>No routes yet.</div>
              : (
                <div className="flex flex-col gap-2">
                  {stats.sortedRoutes.map((r, i) => (
                    <motion.div key={r.route} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.04 }}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 border transition-all ${dark ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/20' : 'bg-slate-50 border-slate-200 hover:border-emerald-300'}`}>
                      <div className="flex items-center gap-1.5 text-[11px] font-bold min-w-0">
                        <span className={`${dark ? 'text-slate-300' : 'text-slate-700'} truncate`}>{r.from}</span>
                        <ArrowRightLeft className="h-2.5 w-2.5 text-[#C8922A] shrink-0" />
                        <span className="text-[#D4A043] truncate">{r.to}</span>
                        <span className="text-[7px] font-black text-emerald-500 ml-0.5">⚡</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`text-[11px] font-mono font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{fmtUSDC(r.volume)}</p>
                        <p className={`text-[8px] font-bold uppercase ${subText}`}>{r.count}x</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
          </motion.div>
        </div>

        {/* ── TX Count Line + Amount Distribution ───────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">

          {/* TX count over time */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={`rounded-2xl border p-5 ${cardBg}`}>
            <h2 className={`font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-4 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <Activity className="h-4 w-4 text-emerald-500" /> Transaction Count Over Time
            </h2>
            <div className={dark ? 'text-white' : 'text-slate-900'}>
              <LineChart data={stats.buckets.map(b => ({ label: b.label, value: b.count }))} color={GREEN} height={100} />
            </div>
          </motion.div>

          {/* Amount size distribution */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className={`rounded-2xl border p-5 ${cardBg}`}>
            <h2 className={`font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-4 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <Layers className="h-4 w-4 text-violet-500" /> Transfer Size Distribution
            </h2>
            <div className="flex flex-col gap-3">
              {stats.amtBuckets.map((b, i) => {
                const maxCount = Math.max(...stats.amtBuckets.map(x => x.count), 1);
                const pct = (b.count / maxCount) * 100;
                const colors = [GOLD, '#06B6D4', '#8B5CF6', '#10B981', '#EF4444'];
                return (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold w-16 shrink-0 ${subText}`}>{b.label}</span>
                    <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${dark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: i * 0.08 }}
                        className="h-full rounded-full"
                        style={{ background: colors[i] }}
                      />
                    </div>
                    <span className={`text-[10px] font-mono font-black w-8 text-right ${dark ? 'text-white' : 'text-slate-900'}`}>{b.count}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </div>

        {/* ── Activity Heatmap ──────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className={`mb-8 rounded-2xl border p-5 ${cardBg}`}>
          <h2 className={`font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-5 ${dark ? 'text-white' : 'text-slate-900'}`}>
            <Star className="h-4 w-4 text-[#C8922A]" /> Activity Heatmap
            <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>
              Day × Hour (all time)
            </span>
          </h2>
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Hour labels */}
              <div className="flex mb-1 ml-8">
                {Array.from({ length: 24 }, (_, h) => (
                  <div key={h} className={`flex-1 text-center text-[7px] font-bold ${subText}`}>
                    {h % 4 === 0 ? `${h}h` : ''}
                  </div>
                ))}
              </div>
              {/* Grid */}
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, di) => (
                <div key={day} className="flex items-center gap-1 mb-1">
                  <span className={`text-[8px] font-bold w-6 shrink-0 text-right ${subText}`}>{day}</span>
                  {stats.heatmap[di]?.map((val, hi) => (
                    <div key={hi} className="flex-1">
                      <HeatCell value={val} max={stats.heatMax} dark={dark} />
                    </div>
                  ))}
                </div>
              ))}
              <div className="flex items-center gap-2 mt-2 ml-8">
                <span className={`text-[8px] font-bold ${subText}`}>Low</span>
                {[0.1, 0.3, 0.5, 0.7, 0.9].map(o => (
                  <div key={o} className="w-4 h-4 rounded" style={{ background: `rgba(200,146,42,${0.08 + o * 0.9})` }} />
                ))}
                <span className={`text-[8px] font-bold ${subText}`}>High</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Network Health Matrix ─────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className={`mb-8 rounded-2xl border p-5 ${cardBg}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`font-black text-xs uppercase tracking-widest flex items-center gap-2 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <Globe className="h-4 w-4 text-[#C8922A]" /> Network Health & Latency Matrix
            </h2>
            <div className="flex items-center gap-3 text-[9px] font-bold">
              <span className="flex items-center gap-1 text-emerald-500"><div className="w-2 h-2 rounded-full bg-emerald-500" /> {`<150ms Fast`}</span>
              <span className="flex items-center gap-1 text-amber-500"><div className="w-2 h-2 rounded-full bg-amber-500" /> 150-400ms</span>
              <span className="flex items-center gap-1 text-red-500"><div className="w-2 h-2 rounded-full bg-red-500" /> Slow/Off</span>
              <span className={`${subText}`}>avg {avgLat > 0 ? `${avgLat}ms` : '…'}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana).map(c => {
              const lat = chainLatencies[c.id];
              const isOnline = lat !== undefined && lat !== -1;
              return (
                <div key={c.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  isOnline
                    ? dark ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    : dark ? 'bg-red-950/10 border-red-900/20' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      lat === undefined ? 'bg-slate-500 animate-pulse'
                      : lat === -1 ? 'bg-red-500'
                      : lat < 150 ? 'bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.6)]'
                      : lat < 400 ? 'bg-amber-400' : 'bg-red-400'
                    }`} />
                    <span className={`text-[10px] font-bold truncate ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{c.shortName}</span>
                  </div>
                  <LatDot ms={lat} />
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Leaderboard + TX Table ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">

          {/* Leaderboard */}
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className={`rounded-2xl border p-5 ${cardBg}`}>
            <h2 className={`font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-5 ${dark ? 'text-white' : 'text-slate-900'}`}>
              <Award className="h-4 w-4 text-[#C8922A]" /> Top Bridgers
            </h2>
            {loading ? <div className={`py-10 text-center text-xs animate-pulse ${subText}`}>Loading…</div>
              : stats.leaderboard.length === 0 ? <div className={`py-10 text-center text-xs ${subText}`}>No data yet.</div>
              : (
                <div className="flex flex-col">
                  {stats.leaderboard.map((user, idx) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <motion.div key={user.wallet}
                        initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + idx * 0.05 }}
                        className={`flex items-center justify-between py-2.5 border-b last:border-0 ${dark ? 'border-slate-900' : 'border-slate-100'} hover:px-2 -mx-0 transition-all rounded-lg`}>
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm w-5 text-center">{medals[idx] || <span className={`text-[10px] font-black ${subText}`}>{idx + 1}</span>}</span>
                          <div>
                            <p className={`font-mono font-bold text-[11px] ${dark ? 'text-slate-200' : 'text-slate-800'}`}>{fmtShortAddr(user.wallet)}</p>
                            <p className={`text-[9px] ${subText}`}>{user.count} transfers · ⚡ auto</p>
                          </div>
                        </div>
                        <p className={`text-[12px] font-mono font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{fmtUSDC(user.volume)}</p>
                      </motion.div>
                    );
                  })}
                </div>
              )}
          </motion.div>

          {/* Transaction Table */}
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
            className={`lg:col-span-3 rounded-2xl border overflow-hidden flex flex-col ${cardBg}`}>
            {/* Controls */}
            <div className={`px-5 py-4 border-b ${dark ? 'border-slate-900' : 'border-slate-100'} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
              <div>
                <h2 className={`font-black text-sm uppercase tracking-wide flex items-center gap-2 ${dark ? 'text-white' : 'text-slate-900'}`}>
                  <ArrowRightLeft className="h-4 w-4 text-[#C8922A]" /> Transfer Registry
                </h2>
                <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${subText}`}>
                  {filteredTxs.length} auto-relayed record{filteredTxs.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={handleCSV} disabled={!filteredTxs.length}
                  className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer border disabled:opacity-30 ${dark ? 'text-slate-300 hover:text-white bg-slate-900 border-slate-800 hover:border-slate-700' : 'text-slate-600 hover:text-slate-900 bg-slate-100 border-slate-200'}`}>
                  <Download className="h-3.5 w-3.5 text-[#C8922A]" /> <span className="hidden sm:inline">Export CSV</span>
                </button>
                <select value={selectedChainFilter} onChange={e => setSelectedChainFilter(e.target.value)}
                  className={`text-[11px] font-bold rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer border ${dark ? 'bg-slate-950 border-slate-800 text-slate-300 focus:border-[#C8922A]' : 'bg-white border-slate-200 text-slate-700 focus:border-[#C8922A]'}`}>
                  <option value="all">All Chains</option>
                  {SUPPORTED_CHAINS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {/* Search */}
            <div className={`px-5 py-2.5 border-b flex items-center gap-2 ${dark ? 'border-slate-900 bg-slate-950/30' : 'border-slate-100 bg-slate-50'}`}>
              <Search className={`h-3.5 w-3.5 shrink-0 ${subText}`} />
              <input type="text" placeholder="Search wallet or burn hash…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className={`flex-1 bg-transparent text-[11px] focus:outline-none ${dark ? 'text-white placeholder-slate-600' : 'text-slate-900 placeholder-slate-400'}`} />
              {searchQuery && <button onClick={() => setSearchQuery('')} className={`text-[9px] font-black uppercase px-2 py-0.5 rounded cursor-pointer ${dark ? 'text-slate-500 hover:text-white bg-slate-800' : 'text-slate-400 hover:text-slate-700 bg-slate-200'}`}>Clear</button>}
            </div>
            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-3">
                <RefreshCw className="h-5 w-5 animate-spin text-[#C8922A]" />
                <span className={`text-xs font-bold uppercase tracking-wider ${subText}`}>Syncing ledger…</span>
              </div>
            ) : filteredTxs.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-20 gap-3 ${subText}`}>
                <Compass className="h-10 w-10 opacity-20 text-[#C8922A]" />
                <p className="text-xs font-bold uppercase tracking-wider">No matching records</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b sticky top-0 backdrop-blur-md ${dark ? 'border-slate-900 bg-slate-950/70' : 'border-slate-100 bg-white/90'}`}>
                      {[
                        { label: 'Time', key: 'time' as const },
                        { label: 'Route', key: null },
                        { label: 'Relay', key: null },
                        { label: 'Amount', key: 'amount' as const },
                        { label: 'Wallet', key: null },
                        { label: 'Tx', key: null },
                      ].map(col => (
                        <th key={col.label} onClick={() => col.key && (() => { if (sortKey === col.key) setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortKey(col.key!); setSortDir('desc'); } })()}
                          className={`px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest ${subText} ${col.key ? 'cursor-pointer hover:text-[#C8922A] transition-colors select-none' : ''}`}>
                          <span className="flex items-center gap-1">
                            {col.label}
                            {col.key && sortKey === col.key && (sortDir === 'desc' ? <ChevronDown className="h-3 w-3 text-[#C8922A]" /> : <ChevronUp className="h-3 w-3 text-[#C8922A]" />)}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${dark ? 'divide-slate-900/60' : 'divide-slate-100'}`}>
                    {filteredTxs.map((tx, ri) => {
                      const fc = getChainById(tx.from_chain_id);
                      const tc = getChainById(tx.to_chain_id);
                      const d = new Date(tx.timestamp);
                      const hash = tx.burn_tx_hash || tx.id;
                      return (
                        <motion.tr key={tx.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ri * 0.01 }}
                          className={`transition-colors ${dark ? 'hover:bg-slate-900/40' : 'hover:bg-slate-50'}`}>
                          <td className={`px-4 py-3 text-[10px] font-mono whitespace-nowrap ${subText}`}>
                            {d.toLocaleDateString()}<br />
                            <span className={dark ? 'text-slate-700' : 'text-slate-400'}>{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-4 py-3 text-[11px] font-bold whitespace-nowrap">
                            <span className={dark ? 'text-slate-300' : 'text-slate-700'}>{fc?.shortName ?? tx.from_chain_id}</span>
                            <span className={`mx-1 ${dark ? 'text-slate-700' : 'text-slate-300'}`}>→</span>
                            <span className="text-[#D4A043]">{tc?.shortName ?? tx.to_chain_id}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[8px] font-black text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <Zap className="h-2 w-2" /> Auto
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-[11px] font-black font-mono ${dark ? 'text-white' : 'text-slate-900'}`}>${parseFloat(tx.amount).toFixed(2)}</span>
                            <span className={`text-[8px] ml-1 ${subText}`}>USDC</span>
                          </td>
                          <td className={`px-4 py-3 text-[10px] font-mono whitespace-nowrap ${subText}`}>{fmtShortAddr(tx.user_address)}</td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {hash?.startsWith('0x') ? (
                              <a href={`${fc?.explorerUrl ?? 'https://testnet.arcscan.app'}/tx/${hash}`} target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] text-[#D4A043] hover:text-amber-300 font-mono font-bold hover:underline">
                                {hash.slice(0, 6)}…<ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            ) : <span className={subText}>—</span>}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className={`flex flex-col sm:flex-row items-center justify-between border-t pt-6 gap-3 ${dark ? 'border-slate-900' : 'border-slate-200'}`}>
          <p className={`text-[10px] font-semibold ${dark ? 'text-slate-700' : 'text-slate-400'}`}>
            ArcShift Bridge · Circle CCTP v2 Forwarding Service · {new Date().getFullYear()}
          </p>
          <div className={`flex gap-4 text-[10px] font-bold ${dark ? 'text-slate-700' : 'text-slate-400'}`}>
            <a href="https://x.com/asadleo416" target="_blank" rel="noreferrer" className="hover:text-[#D4A043] transition-colors">X (Twitter)</a>
            <span>·</span>
            <a href="https://github.com/Asadlee24/arcshift-usdc-bridge" target="_blank" rel="noreferrer" className="hover:text-[#D4A043] transition-colors">GitHub</a>
            <span>·</span>
            <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" className="hover:text-[#D4A043] transition-colors">Arc Explorer</a>
          </div>
        </div>

      </div>
    </div>
  );
}
