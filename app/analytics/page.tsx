// app/analytics/page.tsx
// ArcShift Analytics v3 — Full Redesign: Animated Charts, Protocol Health, Chain Matrix, Leaderboard

'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import {
  BarChart3, Users, Zap, ArrowRightLeft, ExternalLink,
  RefreshCw, CheckCircle2, TrendingUp, ShieldCheck, Search,
  Award, Flame, MapPin, Compass, Download, Activity, Lock, Layers,
  Globe, Clock, ChevronUp, ChevronDown, Wifi, Star, Filter
} from 'lucide-react';
import { getAllTxsFromSupabase, SupabaseTx } from '../../lib/supabase';
import { getChainById, SUPPORTED_CHAINS } from '../../constants/chains';
import { measureChainLatency } from '../../lib/rpcClient';

// ── Helpers ─────────────────────────────────────────────────────────────────

function fmtUSDC(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtShortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Animated Number ──────────────────────────────────────────────────────────

function AnimatedNumber({ value, prefix = '', suffix = '', decimals = 0 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
    let start = 0;
    const step = value / 40;
    const id = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(id); }
      else setDisplay(start);
    }, 16);
    return () => clearInterval(id);
  }, [value]);
  return <>{prefix}{display.toFixed(decimals)}{suffix}</>;
}

// ── Radial Ring Stat ─────────────────────────────────────────────────────────

function RingProgress({ percent, color, label, value }: {
  percent: number; color: string; label: string; value: string;
}) {
  const r = 38;
  const circ = 2 * Math.PI * r;
  const dash = (percent / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="#1e293b" strokeWidth="8" />
          <motion.circle
            cx="48" cy="48" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${circ}`}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - dash }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-sm font-black text-white leading-none">{value}</span>
          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
            {percent.toFixed(0)}%
          </span>
        </div>
      </div>
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">{label}</span>
    </div>
  );
}

// ── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: any; label: string; value: string | number;
  sub?: string; colorClass?: string; glowColor?: string;
  trend?: number; // positive = up, negative = down
}

function StatCard({ icon: Icon, label, value, sub, colorClass = 'text-[#C8922A] bg-[#C8922A]/10 border-[#C8922A]/20', glowColor = 'from-[#C8922A]/5', trend }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.02, transition: { duration: 0.18 } }}
      className="relative bg-[#0C1525]/80 backdrop-blur-xl border border-slate-800 hover:border-[#C8922A]/50 rounded-2xl p-5 transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.7)] overflow-hidden group"
    >
      <div className={`absolute -top-8 -right-8 w-32 h-32 bg-gradient-to-br ${glowColor} to-transparent rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700 opacity-60`} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">{label}</span>
        <div className={`p-2 rounded-xl border ${colorClass} group-hover:scale-110 transition-all duration-300`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-2xl sm:text-[28px] font-black text-white tracking-tight tabular-nums group-hover:text-[#D4A043] transition-colors duration-300">{value}</p>
      <div className="flex items-center justify-between mt-2">
        {sub && <p className="text-[9px] text-slate-500 font-semibold tracking-wide uppercase">{sub}</p>}
        {trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-[9px] font-black ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend >= 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ── Animated Bar Chart ────────────────────────────────────────────────────────

function MiniBarChart({ data, colorMap }: {
  data: { name: string; value: number; color: string }[];
  colorMap?: Record<string, string>;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex flex-col gap-3">
      {data.map((d, i) => (
        <div key={d.name} className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 w-16 shrink-0 truncate">{d.name}</span>
          <div className="flex-1 h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(d.value / max) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.08, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${d.color}cc, ${d.color})` }}
            />
          </div>
          <span className="text-[10px] font-mono font-bold text-white w-14 text-right shrink-0">{fmtUSDC(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Latency Badge ────────────────────────────────────────────────────────────

function LatencyBadge({ ms }: { ms: number | undefined }) {
  if (ms === undefined) return <span className="text-[10px] font-mono text-slate-600 animate-pulse">•••</span>;
  if (ms === -1) return <span className="text-[9px] font-black text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded-full uppercase">Offline</span>;
  const color = ms < 150 ? 'text-emerald-400 bg-emerald-400/10' : ms < 400 ? 'text-amber-400 bg-amber-400/10' : 'text-red-400 bg-red-400/10';
  return (
    <span className={`text-[9px] font-mono font-black ${color} px-1.5 py-0.5 rounded-full`}>
      {ms}ms
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [allTxs, setAllTxs] = useState<SupabaseTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChainFilter, setSelectedChainFilter] = useState<string>('all');
  const [timeframeFilter, setTimeframeFilter] = useState<'all' | '24h' | '7d'>('all');
  const [chainLatencies, setChainLatencies] = useState<Record<number, number>>({});
  const [sortKey, setSortKey] = useState<'time' | 'amount'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const loadData = async () => {
    setLoading(true);
    const data = await getAllTxsFromSupabase();
    setAllTxs(data);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Probe all active EVM chains for latency
  useEffect(() => {
    const activeChains = SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana);
    activeChains.forEach(async (chain) => {
      const lat = await measureChainLatency(chain.id);
      setChainLatencies(prev => ({ ...prev, [chain.id]: lat }));
    });
  }, []);

  // Timeframe filter
  const timeFilteredTxs = useMemo(() => {
    const now = Date.now();
    const oneDay = 86_400_000;
    const sevenDays = 7 * oneDay;
    return allTxs.filter(t => {
      if (t.status !== 'success') return false;
      const txTime = new Date(t.timestamp).getTime();
      if (timeframeFilter === '24h') return now - txTime <= oneDay;
      if (timeframeFilter === '7d') return now - txTime <= sevenDays;
      return true;
    });
  }, [allTxs, timeframeFilter]);

  // All stats
  const stats = useMemo(() => {
    const totalCount = timeFilteredTxs.length;
    const uniqueWallets = new Set(timeFilteredTxs.map(t => t.user_address.toLowerCase())).size;
    const totalVolume = timeFilteredTxs.reduce((s, t) => s + parseFloat(t.amount || '0'), 0);
    const avgTxSize = totalCount > 0 ? totalVolume / totalCount : 0;

    const autoRelayedCount = timeFilteredTxs.filter(t => {
      const toChain = getChainById(t.to_chain_id);
      return toChain?.supportsForwarding === true || t.mint_tx_hash === 'auto-relayed';
    }).length;
    const forwardingSharePercent = totalCount > 0 ? (autoRelayedCount / totalCount) * 100 : 0;

    // Chain distribution
    const chainDist: Record<string, { count: number; volume: number; color: string }> = {};
    timeFilteredTxs.forEach(t => {
      const chain = getChainById(t.from_chain_id);
      const name = chain?.shortName || `Chain ${t.from_chain_id}`;
      if (!chainDist[name]) chainDist[name] = { count: 0, volume: 0, color: chain?.color || '#C8922A' };
      chainDist[name].count += 1;
      chainDist[name].volume += parseFloat(t.amount || '0');
    });
    const sortedDistribution = Object.entries(chainDist)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.volume - a.volume);

    // Route distribution
    const routeDist: Record<string, { count: number; volume: number; from: string; to: string }> = {};
    timeFilteredTxs.forEach(t => {
      const f = getChainById(t.from_chain_id)?.shortName || `${t.from_chain_id}`;
      const to = getChainById(t.to_chain_id)?.shortName || `${t.to_chain_id}`;
      const key = `${f} → ${to}`;
      if (!routeDist[key]) routeDist[key] = { count: 0, volume: 0, from: f, to };
      routeDist[key].count += 1;
      routeDist[key].volume += parseFloat(t.amount || '0');
    });
    const sortedRoutes = Object.entries(routeDist)
      .map(([route, d]) => ({ route, ...d }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 6);

    // Leaderboard
    const walletDist: Record<string, { volume: number; count: number }> = {};
    timeFilteredTxs.forEach(t => {
      const w = t.user_address.toLowerCase();
      if (!walletDist[w]) walletDist[w] = { volume: 0, count: 0 };
      walletDist[w].volume += parseFloat(t.amount || '0');
      walletDist[w].count += 1;
    });
    const leaderboard = Object.entries(walletDist)
      .map(([wallet, d]) => ({ wallet, ...d }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 7);

    // Volume over 7 buckets (hourly for 24h, daily for 7d, else last 7 days)
    const buckets = Array(7).fill(0).map((_, i) => {
      const label = timeframeFilter === '24h'
        ? `${(i * 3) % 24}h`
        : timeframeFilter === '7d'
        ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]
        : `W${i + 1}`;
      return { label, volume: 0 };
    });
    const now = Date.now();
    timeFilteredTxs.forEach(t => {
      const age = now - new Date(t.timestamp).getTime();
      const bucketMs = timeframeFilter === '24h' ? 3 * 3_600_000 : 86_400_000;
      const idx = Math.min(6, Math.floor(age / bucketMs));
      // fill from newest bucket (idx 0) to oldest (idx 6)
      if (idx >= 0 && idx < 7) buckets[6 - idx].volume += parseFloat(t.amount || '0');
    });

    // Pending + failed
    const pendingCount = allTxs.filter(t => t.status === 'pending').length;
    const failedCount = allTxs.filter(t => t.status === 'failed').length;

    return {
      totalCount, uniqueWallets, totalVolume, avgTxSize,
      autoRelayedCount, forwardingSharePercent,
      sortedDistribution, sortedRoutes, leaderboard,
      buckets, pendingCount, failedCount,
    };
  }, [timeFilteredTxs, allTxs, timeframeFilter]);

  // Filtered & sorted tx list
  const filteredTxs = useMemo(() => {
    const result = timeFilteredTxs.filter(tx => {
      const matchSearch =
        tx.user_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.burn_tx_hash && tx.burn_tx_hash.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.mint_tx_hash && tx.mint_tx_hash.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchChain =
        selectedChainFilter === 'all' ||
        String(tx.from_chain_id) === selectedChainFilter ||
        String(tx.to_chain_id) === selectedChainFilter;
      return matchSearch && matchChain;
    });

    return result.sort((a, b) => {
      if (sortKey === 'amount') {
        const diff = parseFloat(a.amount) - parseFloat(b.amount);
        return sortDir === 'desc' ? -diff : diff;
      }
      const diff = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [timeFilteredTxs, searchQuery, selectedChainFilter, sortKey, sortDir]);

  // CSV export
  const handleExportCSV = () => {
    if (filteredTxs.length === 0) return;
    const headers = ['Timestamp', 'From Chain', 'To Chain', 'Amount USDC', 'Mode', 'Wallet', 'Burn Tx', 'Mint Tx', 'Status'];
    const rows = filteredTxs.map(t => {
      const isForward = getChainById(t.to_chain_id)?.supportsForwarding || t.mint_tx_hash === 'auto-relayed';
      return [
        `"${new Date(t.timestamp).toISOString()}"`,
        getChainById(t.from_chain_id)?.shortName || t.from_chain_id,
        getChainById(t.to_chain_id)?.shortName || t.to_chain_id,
        t.amount,
        isForward ? '1-Step Auto' : '2-Step Mint',
        `"${t.user_address}"`,
        `"${t.burn_tx_hash || ''}"`,
        `"${t.mint_tx_hash || ''}"`,
        t.status
      ].join(',');
    });
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `arcshift-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Chain health overview
  const healthyChains = SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana && chainLatencies[c.id] !== -1 && chainLatencies[c.id] !== undefined).length;
  const totalProbed = SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana && chainLatencies[c.id] !== undefined).length;
  const avgLatency = totalProbed > 0
    ? Math.round(Object.values(chainLatencies).filter(v => v !== -1).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(chainLatencies).filter(v => v !== -1).length))
    : 0;

  // Volume bar chart data
  const maxBucket = Math.max(...stats.buckets.map(b => b.volume), 1);

  const toggleSort = (key: 'time' | 'amount') => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  return (
    <div className="min-h-screen bg-[#050A14] text-white font-sans selection:bg-[#C8922A]/30 overflow-x-hidden relative">
      
      {/* Ambient glows */}
      <div className="fixed top-0 left-0 w-[600px] h-[600px] bg-[#C8922A]/4 rounded-full blur-[180px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="fixed bottom-0 right-0 w-[600px] h-[600px] bg-[#0891B2]/4 rounded-full blur-[180px] pointer-events-none translate-x-1/2 translate-y-1/2" />
      <div className="fixed top-1/2 left-1/2 w-[400px] h-[400px] bg-purple-900/3 rounded-full blur-[150px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="border-b border-slate-900/80 bg-[#050A14]/95 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 group shrink-0">
              <img
                src="https://i.ibb.co/x8BwmWJR/6ceb4b2f-4218-408d-b61a-c34d0f3f181e.png"
                alt="ArcShift"
                className="h-9 w-auto object-contain transition-transform duration-200 group-hover:scale-105"
              />
            </a>
            <div className="hidden sm:flex items-center gap-2 border-l border-slate-800 pl-3">
              <BarChart3 className="h-3.5 w-3.5 text-[#C8922A]" />
              <span className="text-[11px] font-black uppercase tracking-[0.15em] text-slate-400">Analytics</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Timeframe pills */}
            <div className="hidden sm:flex p-1 bg-slate-900/80 border border-slate-800 rounded-xl">
              {(['all', '7d', '24h'] as const).map(tf => (
                <button
                  key={tf}
                  onClick={() => setTimeframeFilter(tf)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    timeframeFilter === tf
                      ? 'bg-[#C8922A] text-white shadow-lg shadow-[#C8922A]/20'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {tf === 'all' ? 'All' : tf}
                </button>
              ))}
            </div>

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 px-3 py-1.5 rounded-xl transition-all cursor-pointer border border-slate-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-[#C8922A]' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {lastRefresh && (
              <span className="hidden md:flex items-center gap-1 text-[9px] font-mono text-slate-600">
                <Clock className="h-3 w-3" /> {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <a href="/" className="text-[11px] font-black bg-gradient-to-r from-[#C8922A] to-[#E8A830] hover:opacity-90 text-white px-4 py-1.5 rounded-xl transition-all shadow-lg shadow-[#C8922A]/20">
              Launch Bridge
            </a>
          </div>
        </div>
      </div>

      {/* ── Live Marquee ────────────────────────────────────────────── */}
      <div className="bg-[#0A1122] border-b border-slate-900/60 py-2.5 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#C8922A]/15 border border-[#C8922A]/25 text-[#D4A043] px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0">
            <Flame className="h-3 w-3" /> Live
          </div>
          <div className="flex-1 overflow-hidden relative h-5">
            <div className="absolute inset-0 flex items-center whitespace-nowrap animate-[marquee_30s_linear_infinite] hover:[animation-play-state:paused] gap-12">
              {timeFilteredTxs.length > 0
                ? timeFilteredTxs.slice(0, 10).map((t, idx) => {
                    const fc = getChainById(t.from_chain_id);
                    const tc = getChainById(t.to_chain_id);
                    const isFwd = tc?.supportsForwarding === true || t.mint_tx_hash === 'auto-relayed';
                    return (
                      <span key={idx} className="inline-flex items-center gap-2 text-[11px] text-slate-400 font-bold shrink-0">
                        <span className="text-white font-mono">{fmtShortAddr(t.user_address)}</span>
                        <span className="text-[#C8922A] font-mono font-black">${parseFloat(t.amount).toFixed(2)}</span>
                        <span className="text-slate-500">{fc?.shortName} → {tc?.shortName}</span>
                        {isFwd
                          ? <span className="text-[8px] font-black text-emerald-400 bg-emerald-400/10 px-1.5 rounded-full uppercase">⚡ Auto</span>
                          : <span className="text-[8px] font-semibold text-slate-500 bg-slate-800 px-1.5 rounded-full uppercase">2-Step</span>
                        }
                        <span className="text-slate-700">·</span>
                      </span>
                    );
                  })
                : <span className="text-[11px] text-slate-600">Awaiting live activity…</span>
              }
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 relative z-10">

        {/* ── Page Header ─────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C8922A]/10 border border-[#C8922A]/25 text-[#D4A043] text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck className="h-3 w-3" /> CCTP v2 Verified Ledger
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
              <Wifi className="h-3 w-3" />
              {healthyChains}/{totalProbed} Networks Online
            </div>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mb-2 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Bridge Analytics
          </h1>
          <p className="text-sm text-slate-500 max-w-2xl leading-relaxed">
            Real-time USDC transfer metrics powered by Circle CCTP v2 — forwarding service auto-relay coverage, multi-chain volume distribution, and on-chain diagnostics.
          </p>
        </motion.div>

        {/* ── KPI Row ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard
            icon={ArrowRightLeft}
            label="Completed Bridges"
            value={loading ? '—' : stats.totalCount.toLocaleString()}
            sub="Verified USDC Transfers"
            colorClass="text-[#D4A043] bg-[#C8922A]/15 border-[#C8922A]/30"
            glowColor="from-[#C8922A]/10"
          />
          <StatCard
            icon={Layers}
            label="Total Volume"
            value={loading ? '—' : fmtUSDC(stats.totalVolume)}
            sub="Bridged USDC Value"
            colorClass="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
            glowColor="from-emerald-500/8"
          />
          <StatCard
            icon={Users}
            label="Unique Bridgers"
            value={loading ? '—' : stats.uniqueWallets}
            sub="Active Wallet Addresses"
            colorClass="text-cyan-400 bg-cyan-500/10 border-cyan-500/20"
            glowColor="from-cyan-500/8"
          />
          <StatCard
            icon={Zap}
            label="Avg Transfer Size"
            value={loading ? '—' : fmtUSDC(stats.avgTxSize)}
            sub={`${stats.autoRelayedCount} Auto-Relayed Transfers`}
            colorClass="text-violet-400 bg-violet-500/10 border-violet-500/20"
            glowColor="from-violet-500/8"
          />
        </div>

        {/* ── Protocol Health + Rings ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8"
        >
          {/* Protocol Health Card */}
          <div className="lg:col-span-2 bg-[#0C1525]/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-black text-xs text-white uppercase tracking-widest flex items-center gap-2">
                <Globe className="h-4 w-4 text-[#C8922A]" /> Protocol Health Overview
              </h2>
              <span className="text-[9px] font-mono text-slate-600">
                avg {avgLatency > 0 ? `${avgLatency}ms` : '…'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana).map(c => {
                const lat = chainLatencies[c.id];
                const isOnline = lat !== -1 && lat !== undefined;
                return (
                  <div
                    key={c.id}
                    className={`group flex items-center justify-between p-2.5 rounded-xl border transition-all duration-300 ${
                      isOnline
                        ? 'bg-slate-900/60 border-slate-800 hover:border-emerald-500/30 hover:bg-slate-900'
                        : 'bg-red-950/10 border-red-900/20'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        lat === undefined ? 'bg-slate-700 animate-pulse' :
                        lat === -1 ? 'bg-red-500' :
                        lat < 150 ? 'bg-emerald-400' :
                        lat < 400 ? 'bg-amber-400' : 'bg-red-400'
                      }`} />
                      <span className="text-[10px] font-bold text-slate-300 truncate">{c.shortName}</span>
                    </div>
                    <LatencyBadge ms={lat} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Transfer Mode Rings */}
          <div className="bg-[#0C1525]/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5">
            <h2 className="font-black text-xs text-white uppercase tracking-widest flex items-center gap-2 mb-5">
              <Zap className="h-4 w-4 text-[#C8922A]" /> Transfer Mode Split
            </h2>
            <div className="flex flex-col items-center gap-5">
              <div className="flex items-center justify-center gap-6">
                <RingProgress
                  percent={loading ? 0 : stats.forwardingSharePercent}
                  color="#10B981"
                  label="1-Step Auto"
                  value={loading ? '…' : stats.autoRelayedCount.toString()}
                />
                <RingProgress
                  percent={loading ? 0 : 100 - stats.forwardingSharePercent}
                  color="#6366F1"
                  label="2-Step Manual"
                  value={loading ? '…' : (stats.totalCount - stats.autoRelayedCount).toString()}
                />
              </div>
              <div className="w-full space-y-2 text-[10px] font-semibold text-slate-500">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Circle CCTP Forward</span>
                  </div>
                  <span className="font-mono text-white">{stats.autoRelayedCount} txs</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-indigo-400" />
                    <span>Manual Mint Flow</span>
                  </div>
                  <span className="font-mono text-white">{stats.totalCount - stats.autoRelayedCount} txs</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Pending</span>
                  </div>
                  <span className="font-mono text-amber-400">{stats.pendingCount}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <span>Failed</span>
                  </div>
                  <span className="font-mono text-red-400">{stats.failedCount}</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Volume Chart + Chain + Routes ─────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* Volume Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="lg:col-span-1 bg-[#0C1525]/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5"
          >
            <h2 className="font-black text-xs text-white uppercase tracking-widest flex items-center gap-2 mb-5">
              <TrendingUp className="h-4 w-4 text-[#C8922A]" /> Volume Distribution
            </h2>
            <div className="flex items-end gap-1.5 h-36 mb-3">
              {stats.buckets.map((b, i) => {
                const h = maxBucket > 0 ? (b.volume / maxBucket) * 100 : 0;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none"
                    >
                      <div className="bg-slate-800 border border-slate-700 text-[9px] font-mono text-white px-2 py-0.5 rounded whitespace-nowrap">
                        {fmtUSDC(b.volume)}
                      </div>
                    </div>
                    <div className="w-full bg-slate-900 rounded-t-sm overflow-hidden" style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(h, 2)}%` }}
                        transition={{ duration: 0.7, delay: i * 0.07, ease: 'easeOut' }}
                        className="w-full rounded-t-sm group-hover:brightness-125 transition-all"
                        style={{ background: h > 0 ? 'linear-gradient(180deg, #C8922A, #8B5E1A)' : '#1e293b' }}
                      />
                    </div>
                    <span className="text-[8px] font-bold text-slate-600 mt-1">{b.label}</span>
                  </div>
                );
              })}
            </div>
            <div className="pt-3 border-t border-slate-900 flex justify-between text-[9px] font-bold text-slate-600 uppercase tracking-wider">
              <span>Total: {fmtUSDC(stats.totalVolume)}</span>
              <span>Avg: {fmtUSDC(stats.avgTxSize)}/tx</span>
            </div>
          </motion.div>

          {/* Source Chain Volume Share */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-[#0C1525]/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5"
          >
            <h2 className="font-black text-xs text-white uppercase tracking-widest flex items-center gap-2 mb-5">
              <BarChart3 className="h-4 w-4 text-[#C8922A]" /> Source Chain Volume
            </h2>
            {loading ? (
              <div className="py-10 text-center text-slate-600 text-xs animate-pulse">Loading chain data…</div>
            ) : stats.sortedDistribution.length === 0 ? (
              <div className="py-10 text-center text-slate-700 text-xs">No records found.</div>
            ) : (
              <MiniBarChart
                data={stats.sortedDistribution.slice(0, 7).map(d => ({ name: d.name, value: d.volume, color: d.color }))}
              />
            )}
          </motion.div>

          {/* Top Routes */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-[#0C1525]/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5"
          >
            <h2 className="font-black text-xs text-white uppercase tracking-widest flex items-center gap-2 mb-5">
              <MapPin className="h-4 w-4 text-[#C8922A]" /> Top Pathways
            </h2>
            {loading ? (
              <div className="py-10 text-center text-slate-600 text-xs animate-pulse">Loading routes…</div>
            ) : stats.sortedRoutes.length === 0 ? (
              <div className="py-10 text-center text-slate-700 text-xs">No routes logged yet.</div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {stats.sortedRoutes.map((r, i) => (
                  <motion.div
                    key={r.route}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.06 }}
                    className="flex items-center justify-between bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-xl px-3 py-2.5 transition-all group"
                  >
                    <div className="flex items-center gap-1.5 text-[11px] font-bold min-w-0">
                      <span className="text-slate-300 truncate">{r.from}</span>
                      <ArrowRightLeft className="h-3 w-3 text-[#C8922A] shrink-0" />
                      <span className="text-[#D4A043] truncate">{r.to}</span>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-[11px] font-mono font-black text-white">{fmtUSDC(r.volume)}</p>
                      <p className="text-[8px] font-bold text-slate-600 uppercase">{r.count}x</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Leaderboard + Transaction Registry ──────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">

          {/* Leaderboard */}
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-[#0C1525]/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-5"
          >
            <h2 className="font-black text-xs text-white uppercase tracking-widest flex items-center gap-2 mb-5">
              <Award className="h-4 w-4 text-[#C8922A]" /> Top Bridgers
            </h2>
            {loading ? (
              <div className="py-10 text-center text-slate-600 text-xs animate-pulse">Loading leaderboard…</div>
            ) : stats.leaderboard.length === 0 ? (
              <div className="py-10 text-center text-slate-700 text-xs">No wallet metrics yet.</div>
            ) : (
              <div className="flex flex-col gap-1">
                {stats.leaderboard.map((user, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const rankColors = ['text-amber-400', 'text-slate-300', 'text-amber-700'];
                  return (
                    <motion.div
                      key={user.wallet}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.35 + idx * 0.07 }}
                      className="flex items-center justify-between py-2.5 border-b border-slate-900 last:border-0 group hover:bg-slate-900/30 rounded-lg px-2 -mx-2 transition-all"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`text-sm w-5 text-center ${rankColors[idx] || 'text-slate-600'}`}>
                          {medals[idx] || <span className="text-[11px] font-black text-slate-600">#{idx + 1}</span>}
                        </span>
                        <div>
                          <p className="font-mono font-bold text-[11px] text-slate-200">{fmtShortAddr(user.wallet)}</p>
                          <p className="text-[9px] text-slate-600 font-semibold">{user.count} transfer{user.count > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <p className="text-[12px] font-mono font-black text-white">{fmtUSDC(user.volume)}</p>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* Transaction Registry */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-3 bg-[#0C1525]/80 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden flex flex-col"
          >
            {/* Table header controls */}
            <div className="px-5 py-4 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-black text-sm text-white flex items-center gap-2 uppercase tracking-wide">
                  <ArrowRightLeft className="h-4 w-4 text-[#C8922A]" /> Transfer Registry
                </h2>
                <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider mt-0.5">
                  {filteredTxs.length} verified record{filteredTxs.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleExportCSV}
                  disabled={filteredTxs.length === 0}
                  className="flex items-center gap-1.5 text-[11px] font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-30"
                >
                  <Download className="h-3.5 w-3.5 text-[#C8922A]" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
                <select
                  value={selectedChainFilter}
                  onChange={e => setSelectedChainFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-[11px] font-bold text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#C8922A] cursor-pointer"
                >
                  <option value="all">All Chains</option>
                  {SUPPORTED_CHAINS.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search */}
            <div className="px-5 py-2.5 border-b border-slate-900 bg-slate-950/30 flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-slate-600 shrink-0" />
              <input
                type="text"
                placeholder="Search wallet, burn hash, mint hash…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-[11px] text-white placeholder-slate-600 focus:outline-none focus:ring-0"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-[9px] font-black uppercase text-slate-500 hover:text-white px-2 py-0.5 bg-slate-800 rounded cursor-pointer">
                  Clear
                </button>
              )}
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-slate-500">
                <RefreshCw className="h-5 w-5 animate-spin text-[#C8922A]" />
                <span className="text-xs font-bold uppercase tracking-wider">Syncing ledger…</span>
              </div>
            ) : filteredTxs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-600">
                <Compass className="h-10 w-10 opacity-20 text-[#C8922A]" />
                <p className="text-xs font-bold uppercase tracking-wider">No matching records</p>
                <p className="text-[10px] text-slate-700">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-900 bg-slate-950/70 sticky top-0 backdrop-blur-md">
                      {[
                        { label: 'Time', key: 'time' as const },
                        { label: 'Route', key: null },
                        { label: 'Mode', key: null },
                        { label: 'Amount', key: 'amount' as const },
                        { label: 'Wallet', key: null },
                        { label: 'Explorer', key: null },
                      ].map(col => (
                        <th
                          key={col.label}
                          onClick={() => col.key && toggleSort(col.key)}
                          className={`px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-500 ${col.key ? 'cursor-pointer hover:text-[#C8922A] transition-colors select-none' : ''}`}
                        >
                          <span className="flex items-center gap-1">
                            {col.label}
                            {col.key && sortKey === col.key && (
                              sortDir === 'desc' ? <ChevronDown className="h-3 w-3 text-[#C8922A]" /> : <ChevronUp className="h-3 w-3 text-[#C8922A]" />
                            )}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/60">
                    <AnimatePresence>
                      {filteredTxs.map((tx, rowIdx) => {
                        const fromChain = getChainById(tx.from_chain_id);
                        const toChain = getChainById(tx.to_chain_id);
                        const date = new Date(tx.timestamp);
                        const hash = tx.burn_tx_hash || tx.id;
                        const isFwd = toChain?.supportsForwarding === true || tx.mint_tx_hash === 'auto-relayed';
                        return (
                          <motion.tr
                            key={tx.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: rowIdx * 0.015 }}
                            className="hover:bg-slate-900/40 transition-colors"
                          >
                            <td className="px-4 py-3 text-[10px] text-slate-500 font-mono whitespace-nowrap">
                              {date.toLocaleDateString()} <span className="text-slate-700">{date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </td>
                            <td className="px-4 py-3 text-[11px] font-bold whitespace-nowrap">
                              <span className="text-slate-300">{fromChain?.shortName ?? tx.from_chain_id}</span>
                              <span className="text-slate-700 mx-1">→</span>
                              <span className="text-[#D4A043]">{toChain?.shortName ?? tx.to_chain_id}</span>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {isFwd ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[8px] font-black text-emerald-400 uppercase tracking-wider">
                                  <Zap className="h-2.5 w-2.5" /> Auto
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[8px] font-semibold text-slate-500 uppercase tracking-wider">
                                  <Lock className="h-2.5 w-2.5" /> Manual
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="text-[11px] font-black text-white font-mono">${parseFloat(tx.amount).toFixed(2)}</span>
                              <span className="text-[8px] text-slate-600 ml-1">USDC</span>
                            </td>
                            <td className="px-4 py-3 text-[10px] font-mono text-slate-500 whitespace-nowrap">
                              {fmtShortAddr(tx.user_address)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              {hash && hash.startsWith('0x') ? (
                                <a
                                  href={`${fromChain?.explorerUrl ?? 'https://testnet.arcscan.app'}/tx/${hash}`}
                                  target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[10px] text-[#D4A043] hover:text-amber-300 font-mono font-bold hover:underline"
                                >
                                  {hash.slice(0, 6)}…<ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              ) : (
                                <span className="text-slate-700">—</span>
                              )}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-900 pt-6 gap-3">
          <p className="text-[10px] text-slate-700 font-semibold">
            ArcShift Bridge · CCTP v2 Ledger & Diagnostics · {new Date().getFullYear()}
          </p>
          <div className="flex gap-4 text-[10px] font-bold text-slate-700">
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
