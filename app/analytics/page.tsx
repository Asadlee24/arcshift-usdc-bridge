// app/analytics/page.tsx — ArcShift Analytics v6
// Wallet copy, wallet history search, 24h/7d/30d filters, clean professional design

'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3, Users, Zap, ArrowRightLeft, ExternalLink,
  RefreshCw, TrendingUp, ShieldCheck, Search,
  Award, MapPin, Download, Activity, Layers,
  Globe, Clock, ChevronUp, ChevronDown, Wifi, CheckCircle2,
  Sun, Moon, Target, Hash, Percent, Timer, Trophy, Copy, X, Eye
} from 'lucide-react';
import { getAllTxsFromSupabase, SupabaseTx } from '../../lib/supabase';
import { getChainById, SUPPORTED_CHAINS } from '../../constants/chains';
import { measureChainLatency } from '../../lib/rpcClient';

// ─────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────

const fmtUSDC = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
  : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
  : `$${n.toFixed(2)}`;

const fmtNum = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}K`
  : n.toLocaleString();

const shortAddr = (addr: string) => `${addr.slice(0, 8)}...${addr.slice(-6)}`;

// ─────────────────────────────────────────────────────────────
// Copy hook
// ─────────────────────────────────────────────────────────────

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1800);
    });
  }, []);
  return { copied, copy };
}

// ─────────────────────────────────────────────────────────────
// SVG Line Chart
// ─────────────────────────────────────────────────────────────

function LineChart({
  data, color = '#C8922A', height = 100, dark
}: { data: { label: string; value: number }[]; color?: string; height?: number; dark: boolean }) {
  const W = 480; const H = height;
  const PAD = { t: 10, r: 8, b: 26, l: 8 };
  const max = Math.max(...data.map(d => d.value), 1);
  const pts = data.map((d, i) => ({
    ...d,
    x: PAD.l + (data.length > 1 ? i / (data.length - 1) : 0.5) * (W - PAD.l - PAD.r),
    y: PAD.t + (1 - d.value / max) * (H - PAD.t - PAD.b),
  }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `M${pts[0]?.x ?? 0},${H - PAD.b} ` + pts.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + ` L${pts.at(-1)?.x ?? 0},${H - PAD.b} Z`;
  const gId = `g${color.replace('#', '')}`;

  return (
    <div style={{ height }} className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible" style={{ color: dark ? '#334155' : '#cbd5e1' }}>
        <defs>
          <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(f => (
          <line key={f}
            x1={PAD.l} y1={PAD.t + (1 - f) * (H - PAD.t - PAD.b)}
            x2={W - PAD.r} y2={PAD.t + (1 - f) * (H - PAD.t - PAD.b)}
            stroke="currentColor" strokeWidth="1" strokeDasharray="5 5" />
        ))}
        {pts.length > 1 && (
          <>
            <motion.path d={area} fill={`url(#${gId})`}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
            <motion.path d={line} fill="none" stroke={color} strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: 1.3, ease: 'easeOut' }} />
          </>
        )}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="4" fill={color} stroke={dark ? '#0C1525' : '#fff'} strokeWidth="2" />
            <text x={p.x} y={H - 6} textAnchor="middle" fontSize="9" fill="currentColor" fontWeight="700" fontFamily="monospace">
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Horizontal Bar
// ─────────────────────────────────────────────────────────────

function HBar({ name, value, max, color, count, dark }: {
  name: string; value: number; max: number; color: string; count: number; dark: boolean;
}) {
  return (
    <div className="flex items-center gap-3 group">
      <span className={`text-[10px] font-bold w-14 shrink-0 truncate ${dark ? 'text-slate-400' : 'text-slate-500'}`}>{name}</span>
      <div className={`flex-1 h-2 rounded-full overflow-hidden ${dark ? 'bg-slate-800' : 'bg-slate-100'}`}>
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full" style={{ backgroundColor: color }} />
      </div>
      <span className={`text-[10px] font-mono font-black w-16 text-right shrink-0 ${dark ? 'text-white' : 'text-slate-900'}`}>{fmtUSDC(value)}</span>
      <span className={`text-[9px] w-8 text-right shrink-0 ${dark ? 'text-slate-600' : 'text-slate-400'}`}>{count}x</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// KPI Stat Card
// ─────────────────────────────────────────────────────────────

function KPI({ icon: Icon, label, value, sub, accent = '#C8922A', dark }: {
  icon: any; label: string; value: string | number; sub?: string; accent?: string; dark: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ translateY: -3, transition: { duration: 0.15 } }}
      className={`relative rounded-2xl p-5 overflow-hidden border transition-all duration-200 ${
        dark ? 'bg-[#0D1B2E] border-slate-800/60 shadow-[0_4px_20px_rgba(0,0,0,0.5)]'
              : 'bg-white border-slate-200 shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
      }`}
    >
      <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl opacity-25 pointer-events-none"
        style={{ background: accent }} />
      <div className="flex items-start justify-between mb-3">
        <p className={`text-[9px] font-black uppercase tracking-[0.2em] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</p>
        <div className="p-2 rounded-xl" style={{ background: `${accent}18`, border: `1px solid ${accent}28` }}>
          <Icon className="h-3.5 w-3.5" style={{ color: accent }} />
        </div>
      </div>
      <p className={`text-2xl sm:text-[26px] font-black tracking-tight tabular-nums leading-none ${dark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      {sub && <p className={`text-[9px] mt-2 font-semibold uppercase tracking-wide ${dark ? 'text-slate-600' : 'text-slate-400'}`}>{sub}</p>}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────
// Wallet History Modal
// ─────────────────────────────────────────────────────────────

function WalletModal({ wallet, txs, dark, onClose }: {
  wallet: string; txs: SupabaseTx[]; dark: boolean; onClose: () => void;
}) {
  const { copied, copy } = useCopy();
  const walletTxs = txs.filter(t => t.user_address.toLowerCase() === wallet.toLowerCase())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const totalVol = walletTxs.reduce((s, t) => s + parseFloat(t.amount || '0'), 0);
  const successCount = walletTxs.filter(t => t.status === 'success').length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className={`w-full max-w-2xl max-h-[80vh] rounded-2xl border overflow-hidden flex flex-col ${dark ? 'bg-[#0D1B2E] border-slate-800' : 'bg-white border-slate-200'}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Modal header */}
          <div className={`px-6 py-4 border-b flex items-center justify-between ${dark ? 'border-slate-800' : 'border-slate-100'}`}>
            <div>
              <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Wallet History</p>
              <div className="flex items-center gap-2">
                <span className={`font-mono text-sm font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{shortAddr(wallet)}</span>
                <button
                  onClick={() => copy(wallet, 'modal')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${dark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} ${copied === 'modal' ? 'text-emerald-400' : dark ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {copied === 'modal' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className={`text-lg font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{fmtUSDC(totalVol)}</p>
                <p className={`text-[9px] font-bold uppercase ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{walletTxs.length} transfers</p>
              </div>
              <button onClick={onClose} className={`p-2 rounded-xl cursor-pointer transition-all ${dark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
          {/* Stats row */}
          <div className={`px-6 py-3 grid grid-cols-3 gap-4 border-b ${dark ? 'border-slate-800 bg-slate-900/30' : 'border-slate-100 bg-slate-50'}`}>
            {[
              { label: 'Total Volume', value: fmtUSDC(totalVol) },
              { label: 'Successful', value: `${successCount} / ${walletTxs.length}` },
              { label: 'Avg Transfer', value: walletTxs.length > 0 ? fmtUSDC(totalVol / walletTxs.length) : '$0' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-sm font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{s.value}</p>
                <p className={`text-[8px] font-bold uppercase tracking-wider ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{s.label}</p>
              </div>
            ))}
          </div>
          {/* TX list */}
          <div className="flex-1 overflow-y-auto">
            {walletTxs.length === 0 ? (
              <div className={`py-16 text-center text-sm ${dark ? 'text-slate-600' : 'text-slate-400'}`}>No transactions found</div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className={`border-b sticky top-0 ${dark ? 'bg-[#0D1B2E] border-slate-800' : 'bg-white border-slate-100'}`}>
                    {['Time', 'Route', 'Amount', 'Status', 'Tx'].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-left text-[9px] font-black uppercase tracking-widest ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {walletTxs.map(tx => {
                    const fc = getChainById(tx.from_chain_id);
                    const tc = getChainById(tx.to_chain_id);
                    const d = new Date(tx.timestamp);
                    const hash = tx.burn_tx_hash || tx.id;
                    return (
                      <tr key={tx.id} className={`border-b transition-colors ${dark ? 'border-slate-900 hover:bg-slate-900/40' : 'border-slate-50 hover:bg-slate-50'}`}>
                        <td className={`px-4 py-3 font-mono text-[10px] ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {d.toLocaleDateString()}<br/>
                          <span className={dark ? 'text-slate-600' : 'text-slate-400'}>{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </td>
                        <td className="px-4 py-3 font-bold">
                          <span className={dark ? 'text-slate-300' : 'text-slate-600'}>{fc?.shortName}</span>
                          <span className={`mx-1 ${dark ? 'text-slate-700' : 'text-slate-300'}`}>to</span>
                          <span className="text-amber-500">{tc?.shortName}</span>
                        </td>
                        <td className={`px-4 py-3 font-mono font-black ${dark ? 'text-white' : 'text-slate-900'}`}>
                          ${parseFloat(tx.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                            tx.status === 'success' ? 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20'
                            : tx.status === 'pending' ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20'
                            : 'text-red-500 bg-red-500/10 border border-red-500/20'
                          }`}>{tx.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          {hash?.startsWith('0x') ? (
                            <a href={`${fc?.explorerUrl ?? '#'}/tx/${hash}`} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-amber-500 hover:text-amber-400 font-mono font-bold hover:underline">
                              {hash.slice(0, 6)}<ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          ) : <span className={dark ? 'text-slate-700' : 'text-slate-300'}>N/A</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [dark, setDark] = useState(true);
  const [allTxs, setAllTxs] = useState<SupabaseTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [walletSearch, setWalletSearch] = useState('');
  const [selectedChainFilter, setSelectedChainFilter] = useState('all');
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [chainLatencies, setChainLatencies] = useState<Record<number, number>>({});
  const [sortKey, setSortKey] = useState<'time' | 'amount'>('time');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [walletModal, setWalletModal] = useState<string | null>(null);
  const { copied, copy } = useCopy();

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

  // Timeframe filter
  const successTxs = useMemo(() => {
    const now = Date.now();
    const spans: Record<string, number> = { '24h': 86_400_000, '7d': 7 * 86_400_000, '30d': 30 * 86_400_000 };
    return allTxs.filter(t => {
      if (t.status !== 'success') return false;
      if (timeframe === 'all') return true;
      return now - new Date(t.timestamp).getTime() <= spans[timeframe];
    });
  }, [allTxs, timeframe]);

  // Stats
  const stats = useMemo(() => {
    const totalCount = successTxs.length;
    const pending = allTxs.filter(t => t.status === 'pending').length;
    const failed = allTxs.filter(t => t.status === 'failed').length;
    const successRate = allTxs.length > 0 ? (totalCount / allTxs.length) * 100 : 0;
    const amounts = successTxs.map(t => parseFloat(t.amount || '0'));
    const totalVolume = amounts.reduce((a, b) => a + b, 0);
    const avgTx = totalCount > 0 ? totalVolume / totalCount : 0;
    const maxTx = amounts.length > 0 ? Math.max(...amounts) : 0;
    const uniqueWallets = new Set(successTxs.map(t => t.user_address.toLowerCase())).size;
    const uniqueSrc = new Set(successTxs.map(t => t.from_chain_id)).size;

    const fromDist: Record<string, { count: number; volume: number; color: string }> = {};
    successTxs.forEach(t => {
      const ch = getChainById(t.from_chain_id);
      const n = ch?.shortName || String(t.from_chain_id);
      if (!fromDist[n]) fromDist[n] = { count: 0, volume: 0, color: ch?.color || '#C8922A' };
      fromDist[n].count++; fromDist[n].volume += parseFloat(t.amount || '0');
    });
    const sortedFrom = Object.entries(fromDist).map(([n, d]) => ({ name: n, ...d })).sort((a, b) => b.volume - a.volume);

    const toDist: Record<string, { count: number; volume: number; color: string }> = {};
    successTxs.forEach(t => {
      const ch = getChainById(t.to_chain_id);
      const n = ch?.shortName || String(t.to_chain_id);
      if (!toDist[n]) toDist[n] = { count: 0, volume: 0, color: ch?.color || '#10B981' };
      toDist[n].count++; toDist[n].volume += parseFloat(t.amount || '0');
    });
    const sortedTo = Object.entries(toDist).map(([n, d]) => ({ name: n, ...d })).sort((a, b) => b.volume - a.volume);

    const routeDist: Record<string, { count: number; volume: number; from: string; to: string }> = {};
    successTxs.forEach(t => {
      const f = getChainById(t.from_chain_id)?.shortName || String(t.from_chain_id);
      const to = getChainById(t.to_chain_id)?.shortName || String(t.to_chain_id);
      const k = `${f}___${to}`;
      if (!routeDist[k]) routeDist[k] = { count: 0, volume: 0, from: f, to };
      routeDist[k].count++; routeDist[k].volume += parseFloat(t.amount || '0');
    });
    const sortedRoutes = Object.entries(routeDist).map(([, d]) => d).sort((a, b) => b.volume - a.volume).slice(0, 8);

    const walletDist: Record<string, { volume: number; count: number }> = {};
    successTxs.forEach(t => {
      const w = t.user_address.toLowerCase();
      if (!walletDist[w]) walletDist[w] = { volume: 0, count: 0 };
      walletDist[w].volume += parseFloat(t.amount || '0');
      walletDist[w].count++;
    });
    const leaderboard = Object.entries(walletDist).map(([wallet, d]) => ({ wallet, ...d })).sort((a, b) => b.volume - a.volume).slice(0, 10);

    // Time buckets — 14 points
    const NUM = 14;
    const now = Date.now();
    const spanMs = timeframe === '24h' ? 86_400_000 : timeframe === '7d' ? 7 * 86_400_000 : timeframe === '30d' ? 30 * 86_400_000 : 60 * 86_400_000;
    const bMs = spanMs / NUM;
    const buckets = Array.from({ length: NUM }, (_, i) => {
      const t0 = now - spanMs + i * bMs;
      const label = timeframe === '24h' ? `${new Date(t0).getHours()}h`
        : timeframe === '7d' ? ['Su','Mo','Tu','We','Th','Fr','Sa'][new Date(t0).getDay()]
        : `D${i + 1}`;
      return { label, volume: 0, count: 0 };
    });
    successTxs.forEach(t => {
      const age = now - new Date(t.timestamp).getTime();
      const idx = Math.floor((spanMs - age) / bMs);
      if (idx >= 0 && idx < NUM) { buckets[idx].volume += parseFloat(t.amount || '0'); buckets[idx].count++; }
    });

    // Heatmap 7x24
    const heatmap: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    allTxs.filter(t => t.status === 'success').forEach(t => {
      const d = new Date(t.timestamp);
      heatmap[d.getDay()][d.getHours()]++;
    });
    const heatMax = Math.max(...heatmap.flat(), 1);

    // Amount buckets
    const amtBuckets = [
      { label: 'Under $1', min: 0, max: 1, count: 0 },
      { label: '$1 to $10', min: 1, max: 10, count: 0 },
      { label: '$10 to $100', min: 10, max: 100, count: 0 },
      { label: '$100 to $1K', min: 100, max: 1000, count: 0 },
      { label: 'Over $1K', min: 1000, max: Infinity, count: 0 },
    ];
    successTxs.forEach(t => {
      const a = parseFloat(t.amount || '0');
      amtBuckets.find(b => a >= b.min && a < b.max)!.count++;
    });

    const hourlyVol = Array(24).fill(0);
    successTxs.forEach(t => { hourlyVol[new Date(t.timestamp).getHours()] += parseFloat(t.amount || '0'); });
    const peakHour = hourlyVol.indexOf(Math.max(...hourlyVol));

    return {
      totalCount, pending, failed, successRate, totalVolume, avgTx, maxTx,
      uniqueWallets, uniqueSrc,
      sortedFrom, sortedTo, sortedRoutes, leaderboard,
      buckets, heatmap, heatMax, amtBuckets, peakHour,
    };
  }, [successTxs, allTxs, timeframe]);

  // Filtered tx table
  const filteredTxs = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const wq = walletSearch.toLowerCase();
    return successTxs.filter(tx => {
      const matchSearch = !q || tx.user_address.toLowerCase().includes(q) || (tx.burn_tx_hash?.toLowerCase().includes(q));
      const matchWallet = !wq || tx.user_address.toLowerCase().includes(wq);
      const matchChain = selectedChainFilter === 'all' || String(tx.from_chain_id) === selectedChainFilter || String(tx.to_chain_id) === selectedChainFilter;
      return matchSearch && matchWallet && matchChain;
    }).sort((a, b) => {
      const diff = sortKey === 'amount'
        ? parseFloat(a.amount) - parseFloat(b.amount)
        : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      return sortDir === 'desc' ? -diff : diff;
    });
  }, [successTxs, searchQuery, walletSearch, selectedChainFilter, sortKey, sortDir]);

  const handleCSV = () => {
    if (!filteredTxs.length) return;
    const rows = filteredTxs.map(t => [
      `"${new Date(t.timestamp).toISOString()}"`,
      getChainById(t.from_chain_id)?.shortName || t.from_chain_id,
      getChainById(t.to_chain_id)?.shortName || t.to_chain_id,
      t.amount, 'CCTP Auto-Relay', `"${t.user_address}"`, `"${t.burn_tx_hash || ''}"`,
    ].join(','));
    const blob = new Blob([['Time,From,To,USDC,Mode,Wallet,Burn Tx', ...rows].join('\n')], { type: 'text/csv' });
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `arcshift-${new Date().toISOString().slice(0, 10)}.csv` }).click();
  };

  const onlineChains = SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana && chainLatencies[c.id] !== -1 && chainLatencies[c.id] !== undefined).length;
  const probedChains = SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana && chainLatencies[c.id] !== undefined).length;
  const avgLat = probedChains > 0 ? Math.round(Object.values(chainLatencies).filter(v => v !== -1).reduce((a, b) => a + b, 0) / Math.max(1, Object.values(chainLatencies).filter(v => v !== -1).length)) : 0;

  // Theme classes
  const C = {
    bg: dark ? 'bg-[#060D1A]' : 'bg-slate-50',
    card: dark ? 'bg-[#0D1B2E] border-slate-800/60' : 'bg-white border-slate-200',
    cardAlt: dark ? 'bg-[#0A1520] border-slate-800/60' : 'bg-slate-50/80 border-slate-200',
    hdr: dark ? 'bg-[#060D1A]/95 border-slate-900' : 'bg-white/95 border-slate-200',
    text: dark ? 'text-white' : 'text-slate-900',
    sub: dark ? 'text-slate-500' : 'text-slate-500',
    divider: dark ? 'border-slate-800/60' : 'border-slate-100',
    input: dark ? 'bg-slate-900 border-slate-800 text-white placeholder-slate-600 focus:border-amber-500/50' : 'bg-white border-slate-200 text-slate-900 placeholder-slate-400 focus:border-amber-400',
    row: dark ? 'border-slate-900/60 hover:bg-slate-900/30' : 'border-slate-100 hover:bg-slate-50',
    pill: dark ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-100 border-slate-200 text-slate-600',
  };

  const GOLD = '#C8922A'; const GREEN = '#10B981'; const BLUE = '#3B82F6'; const VIOLET = '#8B5CF6';

  return (
    <div className={`min-h-screen ${C.bg} ${C.text} font-sans overflow-x-hidden transition-colors duration-300`}>
      {/* Wallet modal */}
      {walletModal && (
        <WalletModal wallet={walletModal} txs={allTxs} dark={dark} onClose={() => setWalletModal(null)} />
      )}

      {/* Glow */}
      {dark && (
        <>
          <div className="fixed top-0 left-0 w-[600px] h-[600px] rounded-full blur-[200px] pointer-events-none opacity-60"
            style={{ background: 'rgba(200,146,42,0.04)', transform: 'translate(-40%, -40%)' }} />
          <div className="fixed bottom-0 right-0 w-[500px] h-[500px] rounded-full blur-[180px] pointer-events-none opacity-60"
            style={{ background: 'rgba(16,185,129,0.04)', transform: 'translate(40%, 40%)' }} />
        </>
      )}

      {/* ── Sticky Header ─────────────────────────────────────────── */}
      <div className={`border-b ${C.hdr} backdrop-blur-2xl sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <a href="/" className="group shrink-0">
              <img src="https://i.ibb.co/x8BwmWJR/6ceb4b2f-4218-408d-b61a-c34d0f3f181e.png" alt="ArcShift" className="h-9 w-auto object-contain group-hover:scale-105 transition-transform" />
            </a>
            <div className={`hidden sm:flex items-center gap-2 border-l ${C.divider} pl-3`}>
              <BarChart3 className="h-3.5 w-3.5" style={{ color: GOLD }} />
              <span className={`text-[11px] font-black uppercase tracking-[0.18em] ${C.sub}`}>Analytics</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Timeframe */}
            <div className={`flex p-1 rounded-xl border ${dark ? 'bg-slate-900/80 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              {(['24h', '7d', '30d', 'all'] as const).map(tf => (
                <button key={tf} onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    timeframe === tf ? 'text-white shadow-lg' : `${C.sub} hover:${C.text}`
                  }`}
                  style={timeframe === tf ? { background: GOLD, boxShadow: `0 2px 12px ${GOLD}35` } : {}}>
                  {tf === 'all' ? 'All' : tf}
                </button>
              ))}
            </div>
            <button onClick={() => setDark(d => !d)}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${dark ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' : 'bg-slate-100 border-slate-200 text-slate-500 hover:bg-slate-200'}`}>
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={loadData} disabled={loading}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer border ${dark ? 'text-slate-300 hover:text-white bg-slate-900 border-slate-800 hover:bg-slate-800' : 'text-slate-600 hover:text-slate-900 bg-slate-100 border-slate-200 hover:bg-slate-200'}`}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} style={{ color: loading ? GOLD : undefined }} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            {lastRefresh && (
              <span className={`hidden md:flex items-center gap-1 text-[9px] font-mono ${C.sub}`}>
                <Clock className="h-3 w-3" /> {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <a href="/" className="text-[11px] font-black text-white px-4 py-1.5 rounded-xl"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #E8A830)`, boxShadow: `0 4px 15px ${GOLD}30` }}>
              Bridge Now
            </a>
          </div>
        </div>
      </div>

      {/* ── Live Ticker ───────────────────────────────────────────── */}
      <div className={`border-b overflow-hidden py-2 ${dark ? 'bg-[#0A1220] border-slate-900' : 'bg-slate-100 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-wider shrink-0"
            style={{ background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)', color: '#10B981' }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
          </div>
          <div className="flex-1 overflow-hidden h-5 relative">
            <div className="absolute inset-0 flex items-center whitespace-nowrap animate-[marquee_40s_linear_infinite] hover:[animation-play-state:paused] gap-10">
              {successTxs.slice(0, 12).map((t, i) => {
                const fc = getChainById(t.from_chain_id); const tc = getChainById(t.to_chain_id);
                return (
                  <span key={i} className={`inline-flex items-center gap-2 text-[11px] font-semibold shrink-0 ${C.sub}`}>
                    <span className={`font-mono font-bold ${C.text}`}>{shortAddr(t.user_address)}</span>
                    <span className="font-mono font-black" style={{ color: GOLD }}>${parseFloat(t.amount).toFixed(2)} USDC</span>
                    <span>{fc?.shortName} to {tc?.shortName}</span>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border ${dark ? 'text-emerald-400 bg-emerald-400/8 border-emerald-400/20' : 'text-emerald-600 bg-emerald-50 border-emerald-200'}`}>Auto-Relayed</span>
                  </span>
                );
              })}
              {successTxs.length === 0 && <span className={`text-[11px] ${C.sub}`}>No activity yet</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Page title ───────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-wrap gap-2 mb-4">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest`}
              style={{ background: `${GOLD}12`, borderColor: `${GOLD}28`, color: GOLD }}>
              <ShieldCheck className="h-3 w-3" /> CCTP v2 Verified
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${dark ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600'}`}>
              <Wifi className="h-3 w-3" /> {onlineChains} of {probedChains} Networks Online
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest ${dark ? 'bg-violet-500/8 border-violet-500/20 text-violet-400' : 'bg-violet-50 border-violet-200 text-violet-600'}`}>
              <Zap className="h-3 w-3" /> 100 Percent Auto Relay
            </span>
          </div>
          <h1 className={`text-4xl sm:text-5xl font-black tracking-tight mb-2 ${dark ? 'bg-gradient-to-br from-white via-slate-200 to-slate-500 bg-clip-text text-transparent' : ''}`}>
            Bridge Analytics
          </h1>
          <p className={`text-sm max-w-2xl leading-relaxed ${C.sub}`}>
            Real-time CCTP v2 metrics covering volume, chain distribution, relay performance, wallet history, and on-chain diagnostics. All routes are fully auto-relayed with a single wallet signature.
          </p>
        </motion.div>

        {/* ── KPIs Row 1 ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <KPI dark={dark} icon={ArrowRightLeft} label="Total Bridges" accent={GOLD}
            value={loading ? '...' : fmtNum(stats.totalCount)} sub="Verified auto-relayed" />
          <KPI dark={dark} icon={Layers} label="Total Volume" accent={GREEN}
            value={loading ? '...' : fmtUSDC(stats.totalVolume)} sub="USDC bridged" />
          <KPI dark={dark} icon={Users} label="Unique Wallets" accent={BLUE}
            value={loading ? '...' : fmtNum(stats.uniqueWallets)} sub="Active addresses" />
          <KPI dark={dark} icon={Percent} label="Success Rate" accent={VIOLET}
            value={loading ? '...' : `${stats.successRate.toFixed(1)}%`} sub={`${stats.failed} failed, ${stats.pending} pending`} />
        </div>

        {/* ── KPIs Row 2 ───────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPI dark={dark} icon={Target} label="Avg Transfer Size" accent="#F59E0B"
            value={loading ? '...' : fmtUSDC(stats.avgTx)} sub="Per transaction" />
          <KPI dark={dark} icon={Trophy} label="Largest Transfer" accent="#EF4444"
            value={loading ? '...' : fmtUSDC(stats.maxTx)} sub="Single record" />
          <KPI dark={dark} icon={Hash} label="Source Chains Used" accent={GREEN}
            value={loading ? '...' : stats.uniqueSrc} sub={`${stats.sortedRoutes.length} unique routes`} />
          <KPI dark={dark} icon={Timer} label="Peak Activity Hour" accent={GOLD}
            value={loading ? '...' : `${stats.peakHour}:00`} sub="Highest volume time" />
        </div>

        {/* ── CCTP Status Banner ────────────────────────────────────── */}
        <div className={`mb-8 rounded-2xl border overflow-hidden ${dark ? 'border-emerald-500/15' : 'border-emerald-200'}`}
          style={{ background: dark ? 'linear-gradient(135deg, rgba(16,185,129,0.06) 0%, rgba(13,27,46,0.8) 50%, rgba(13,27,46,0.6) 100%)' : 'linear-gradient(135deg, #f0fdf4, #fff)' }}>
          <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-2xl ${dark ? 'bg-emerald-500/12 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                <Zap className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className={`font-black text-sm uppercase tracking-widest ${C.text}`}>CCTP Forwarding Service Active</p>
                <p className={`text-[11px] mt-1 ${C.sub}`}>
                  All routes use <span className="text-emerald-500 font-black font-mono">depositForBurnWithHook</span>. No manual mint transaction required. Circle handles attestation and minting on the destination chain automatically.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              {[
                { label: 'Relay Rate', value: '100%', color: '#10B981' },
                { label: 'Auto-Relayed', value: fmtNum(stats.totalCount), color: C.text === 'text-white' ? '#fff' : '#0f172a' },
                { label: 'Pending', value: String(stats.pending), color: '#F59E0B' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-2xl font-black" style={{ color: s.color }}>{loading ? '...' : s.value}</p>
                  <p className={`text-[8px] font-black uppercase tracking-widest ${C.sub}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Volume Line Chart ─────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          className={`mb-6 rounded-2xl border p-6 ${C.card}`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className={`font-black text-xs uppercase tracking-[0.18em] flex items-center gap-2 ${C.text}`}>
                <TrendingUp className="h-4 w-4" style={{ color: GOLD }} /> Volume Over Time
              </h2>
              <p className={`text-[9px] mt-1 ${C.sub}`}>USDC bridged per time bucket</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black" style={{ color: GOLD }}>{loading ? '...' : fmtUSDC(stats.totalVolume)}</p>
              <p className={`text-[9px] ${C.sub} uppercase tracking-wider font-bold`}>Total in period</p>
            </div>
          </div>
          <LineChart data={stats.buckets.map(b => ({ label: b.label, value: b.volume }))} color={GOLD} height={130} dark={dark} />
          <div className={`mt-4 pt-4 border-t ${C.divider} flex flex-wrap gap-5 text-[10px] font-bold uppercase tracking-wider ${C.sub}`}>
            <span>Peak bucket: {fmtUSDC(Math.max(...stats.buckets.map(b => b.volume)))}</span>
            <span>Active buckets: {stats.buckets.filter(b => b.volume > 0).length} of {stats.buckets.length}</span>
            <span>Transactions: {fmtNum(stats.totalCount)}</span>
          </div>
        </motion.div>

        {/* ── TX Count Line Chart ───────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className={`mb-8 rounded-2xl border p-6 ${C.card}`}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className={`font-black text-xs uppercase tracking-[0.18em] flex items-center gap-2 ${C.text}`}>
                <Activity className="h-4 w-4" style={{ color: GREEN }} /> Transaction Count Over Time
              </h2>
              <p className={`text-[9px] mt-1 ${C.sub}`}>Number of successful bridges per bucket</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black" style={{ color: GREEN }}>{loading ? '...' : fmtNum(stats.totalCount)}</p>
              <p className={`text-[9px] ${C.sub} uppercase tracking-wider font-bold`}>Total transfers</p>
            </div>
          </div>
          <LineChart data={stats.buckets.map(b => ({ label: b.label, value: b.count }))} color={GREEN} height={110} dark={dark} />
        </motion.div>

        {/* ── Source + Dest + Routes ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Source */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
            className={`rounded-2xl border p-5 ${C.card}`}>
            <h2 className={`font-black text-xs uppercase tracking-[0.18em] flex items-center gap-2 mb-5 ${C.text}`}>
              <BarChart3 className="h-4 w-4" style={{ color: GOLD }} /> Source Chains
            </h2>
            {loading ? <div className={`py-10 text-center text-xs ${C.sub}`}>Loading...</div>
              : stats.sortedFrom.length === 0 ? <div className={`py-10 text-center text-xs ${C.sub}`}>No data</div>
              : <div className="flex flex-col gap-3">
                  {stats.sortedFrom.slice(0, 8).map(d => (
                    <HBar key={d.name} name={d.name} value={d.volume} max={stats.sortedFrom[0].volume} color={d.color} count={d.count} dark={dark} />
                  ))}
                </div>
            }
          </motion.div>

          {/* Destination */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className={`rounded-2xl border p-5 ${C.card}`}>
            <h2 className={`font-black text-xs uppercase tracking-[0.18em] flex items-center gap-2 mb-5 ${C.text}`}>
              <MapPin className="h-4 w-4" style={{ color: GREEN }} /> Destination Chains
            </h2>
            {loading ? <div className={`py-10 text-center text-xs ${C.sub}`}>Loading...</div>
              : stats.sortedTo.length === 0 ? <div className={`py-10 text-center text-xs ${C.sub}`}>No data</div>
              : <div className="flex flex-col gap-3">
                  {stats.sortedTo.slice(0, 8).map(d => (
                    <HBar key={d.name} name={d.name} value={d.volume} max={stats.sortedTo[0].volume} color={d.color} count={d.count} dark={dark} />
                  ))}
                </div>
            }
          </motion.div>

          {/* Routes */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
            className={`rounded-2xl border p-5 ${C.card}`}>
            <h2 className={`font-black text-xs uppercase tracking-[0.18em] flex items-center gap-2 mb-5 ${C.text}`}>
              <ArrowRightLeft className="h-4 w-4" style={{ color: GOLD }} /> Top Routes
            </h2>
            {loading ? <div className={`py-10 text-center text-xs ${C.sub}`}>Loading...</div>
              : stats.sortedRoutes.length === 0 ? <div className={`py-10 text-center text-xs ${C.sub}`}>No routes yet</div>
              : <div className="flex flex-col gap-2">
                  {stats.sortedRoutes.map((r, i) => (
                    <motion.div key={`${r.from}${r.to}`} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.04 }}
                      className={`flex items-center justify-between rounded-xl px-3 py-2.5 border transition-all ${dark ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300'}`}>
                      <div className={`flex items-center gap-1.5 text-[11px] font-bold min-w-0`}>
                        <span className={dark ? 'text-slate-300' : 'text-slate-700'}>{r.from}</span>
                        <ArrowRightLeft className="h-3 w-3 shrink-0" style={{ color: GOLD }} />
                        <span style={{ color: '#D4A043' }}>{r.to}</span>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className={`text-[11px] font-mono font-black ${C.text}`}>{fmtUSDC(r.volume)}</p>
                        <p className={`text-[8px] font-bold uppercase ${C.sub}`}>{r.count} transfers</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
            }
          </motion.div>
        </div>

        {/* ── Transfer Size + Heatmap ───────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Size distribution */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
            className={`rounded-2xl border p-5 ${C.card}`}>
            <h2 className={`font-black text-xs uppercase tracking-[0.18em] flex items-center gap-2 mb-5 ${C.text}`}>
              <Layers className="h-4 w-4" style={{ color: VIOLET }} /> Transfer Size Distribution
            </h2>
            <div className="flex flex-col gap-3">
              {stats.amtBuckets.map((b, i) => {
                const max = Math.max(...stats.amtBuckets.map(x => x.count), 1);
                const colors = [GOLD, BLUE, VIOLET, GREEN, '#EF4444'];
                return (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold w-20 shrink-0 ${C.sub}`}>{b.label}</span>
                    <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${dark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${max > 0 ? (b.count / max) * 100 : 0}%` }}
                        transition={{ duration: 0.8, delay: i * 0.07 }}
                        className="h-full rounded-full" style={{ backgroundColor: colors[i] }} />
                    </div>
                    <span className={`text-[10px] font-mono font-black w-6 text-right shrink-0 ${C.text}`}>{b.count}</span>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Heatmap */}
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}
            className={`rounded-2xl border p-5 ${C.card}`}>
            <h2 className={`font-black text-xs uppercase tracking-[0.18em] flex items-center gap-2 mb-5 ${C.text}`}>
              <Activity className="h-4 w-4" style={{ color: GOLD }} /> Activity Heatmap
              <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${dark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>Day x Hour</span>
            </h2>
            <div className="overflow-x-auto">
              <div className="min-w-[360px]">
                <div className="flex mb-1.5 ml-6">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className={`flex-1 text-center text-[7px] font-bold ${C.sub}`}>
                      {h % 6 === 0 ? `${h}h` : ''}
                    </div>
                  ))}
                </div>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, di) => (
                  <div key={day} className="flex items-center gap-0.5 mb-0.5">
                    <span className={`text-[8px] font-bold w-5 shrink-0 text-right mr-1 ${C.sub}`}>{day}</span>
                    {stats.heatmap[di]?.map((val, hi) => {
                      const p = stats.heatMax > 0 ? val / stats.heatMax : 0;
                      return (
                        <div key={hi} className="flex-1 aspect-square rounded-sm" title={`${val} txs`}
                          style={{ background: `rgba(200,146,42,${0.06 + p * 0.88})` }} />
                      );
                    })}
                  </div>
                ))}
                <div className="flex items-center gap-1.5 mt-3 ml-6">
                  <span className={`text-[8px] font-bold ${C.sub}`}>Low</span>
                  {[0.1, 0.3, 0.55, 0.75, 0.95].map(o => (
                    <div key={o} className="w-3.5 h-3.5 rounded-sm" style={{ background: `rgba(200,146,42,${0.06 + o * 0.88})` }} />
                  ))}
                  <span className={`text-[8px] font-bold ${C.sub}`}>High</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Network Health ─────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }}
          className={`mb-8 rounded-2xl border p-5 ${C.card}`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`font-black text-xs uppercase tracking-[0.18em] flex items-center gap-2 ${C.text}`}>
              <Globe className="h-4 w-4" style={{ color: GOLD }} /> Network Health Matrix
            </h2>
            <div className="flex items-center gap-4 text-[9px] font-bold">
              <span className="flex items-center gap-1.5 text-emerald-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500" /> Under 150ms
              </span>
              <span className="flex items-center gap-1.5 text-amber-500">
                <div className="w-2 h-2 rounded-full bg-amber-500" /> 150 to 400ms
              </span>
              <span className="flex items-center gap-1.5 text-red-500">
                <div className="w-2 h-2 rounded-full bg-red-500" /> Slow or Offline
              </span>
              <span className={C.sub}>Avg: {avgLat > 0 ? `${avgLat}ms` : 'Probing...'}</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {SUPPORTED_CHAINS.filter(c => !c.isComingSoon && !c.isSolana).map(c => {
              const lat = chainLatencies[c.id];
              const isOnline = lat !== undefined && lat !== -1;
              const dotColor = lat === undefined ? '#475569' : lat === -1 ? '#EF4444' : lat < 150 ? '#10B981' : lat < 400 ? '#F59E0B' : '#EF4444';
              const latText = lat === undefined ? 'Probing' : lat === -1 ? 'Offline' : `${lat}ms`;
              const latColor = lat === undefined ? C.sub : lat === -1 ? 'text-red-500' : lat < 150 ? 'text-emerald-500' : lat < 400 ? 'text-amber-500' : 'text-red-500';
              return (
                <div key={c.id} className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
                  isOnline ? dark ? 'bg-slate-900/50 border-slate-800 hover:border-slate-700' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                           : dark ? 'bg-red-950/10 border-red-900/20' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor,
                      boxShadow: lat !== undefined && lat !== -1 && lat < 150 ? '0 0 5px rgba(16,185,129,0.6)' : 'none' }} />
                    <span className={`text-[10px] font-bold truncate ${dark ? 'text-slate-300' : 'text-slate-700'}`}>{c.shortName}</span>
                  </div>
                  <span className={`text-[9px] font-mono font-black ${latColor}`}>{latText}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Leaderboard + Transaction Table ───────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">

          {/* Leaderboard */}
          <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className={`rounded-2xl border p-5 ${C.card}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className={`font-black text-xs uppercase tracking-[0.18em] flex items-center gap-2 ${C.text}`}>
                <Award className="h-4 w-4" style={{ color: GOLD }} /> Top Bridgers
              </h2>
            </div>
            {/* Wallet search */}
            <div className={`flex items-center gap-2 mb-4 rounded-xl border px-3 py-2 ${dark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
              <Search className={`h-3.5 w-3.5 shrink-0 ${C.sub}`} />
              <input
                type="text"
                placeholder="Search wallet address..."
                value={walletSearch}
                onChange={e => setWalletSearch(e.target.value)}
                className={`flex-1 bg-transparent text-[11px] focus:outline-none ${dark ? 'text-white placeholder-slate-600' : 'text-slate-900 placeholder-slate-400'}`}
              />
              {walletSearch && (
                <button onClick={() => setWalletSearch('')} className={`${C.sub} hover:${C.text} cursor-pointer`}>
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {loading ? (
              <div className={`py-10 text-center text-xs ${C.sub}`}>Loading...</div>
            ) : stats.leaderboard.length === 0 ? (
              <div className={`py-10 text-center text-xs ${C.sub}`}>No data yet</div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {stats.leaderboard
                  .filter(u => !walletSearch || u.wallet.toLowerCase().includes(walletSearch.toLowerCase()))
                  .map((user, idx) => {
                    const rankColors = ['#F59E0B', '#94A3B8', '#B45309'];
                    const rankBg = idx < 3 ? `${rankColors[idx]}15` : 'transparent';
                    return (
                      <div key={user.wallet}
                        className={`flex items-center justify-between py-2.5 px-2 rounded-xl border transition-all ${dark ? 'border-transparent hover:border-slate-800 hover:bg-slate-900/40' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}`}
                        style={{ background: rankBg }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-black text-[10px] w-5 text-center shrink-0" style={{ color: idx < 3 ? rankColors[idx] : dark ? '#64748B' : '#94A3B8' }}>
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className={`font-mono font-bold text-[11px] truncate ${dark ? 'text-slate-200' : 'text-slate-800'}`}>{shortAddr(user.wallet)}</p>
                            <p className={`text-[9px] ${C.sub}`}>{user.count} transfers</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 ml-1">
                          <p className={`text-[12px] font-mono font-black ${C.text}`}>{fmtUSDC(user.volume)}</p>
                          {/* Copy button */}
                          <button
                            onClick={() => copy(user.wallet, user.wallet)}
                            title="Copy wallet address"
                            className={`p-1 rounded-lg transition-all cursor-pointer ${dark ? 'text-slate-600 hover:text-slate-300 hover:bg-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
                          >
                            {copied === user.wallet ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                          </button>
                          {/* View history */}
                          <button
                            onClick={() => setWalletModal(user.wallet)}
                            title="View wallet history"
                            className={`p-1 rounded-lg transition-all cursor-pointer ${dark ? 'text-slate-600 hover:text-amber-400 hover:bg-slate-800' : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100'}`}
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </motion.div>

          {/* Transaction Registry */}
          <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
            className={`lg:col-span-3 rounded-2xl border overflow-hidden flex flex-col ${C.card}`}>
            {/* Controls */}
            <div className={`px-5 py-4 border-b ${C.divider} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
              <div>
                <h2 className={`font-black text-sm uppercase tracking-wide flex items-center gap-2 ${C.text}`}>
                  <ArrowRightLeft className="h-4 w-4" style={{ color: GOLD }} /> Transfer Registry
                </h2>
                <p className={`text-[9px] font-bold uppercase tracking-wider mt-0.5 ${C.sub}`}>
                  Showing {filteredTxs.length} record{filteredTxs.length !== 1 ? 's' : ''} {walletSearch ? `for ${shortAddr(walletSearch)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleCSV} disabled={!filteredTxs.length}
                  className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer border disabled:opacity-30 ${dark ? 'text-slate-300 hover:text-white bg-slate-900 border-slate-800 hover:border-slate-700' : 'text-slate-600 hover:text-slate-900 bg-slate-100 border-slate-200 hover:bg-slate-200'}`}>
                  <Download className="h-3.5 w-3.5" style={{ color: GOLD }} />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
                <select value={selectedChainFilter} onChange={e => setSelectedChainFilter(e.target.value)}
                  className={`text-[11px] font-bold rounded-xl px-3 py-1.5 focus:outline-none cursor-pointer border ${dark ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700'}`}>
                  <option value="all">All Chains</option>
                  {SUPPORTED_CHAINS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {/* Search */}
            <div className={`px-5 py-2.5 border-b ${C.divider} ${dark ? 'bg-slate-950/20' : 'bg-slate-50'} flex items-center gap-2`}>
              <Search className={`h-3.5 w-3.5 shrink-0 ${C.sub}`} />
              <input type="text" placeholder="Search by wallet or transaction hash..."
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className={`flex-1 bg-transparent text-[11px] focus:outline-none ${dark ? 'text-white placeholder-slate-600' : 'text-slate-900 placeholder-slate-400'}`} />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className={`text-[9px] font-black uppercase px-2 py-0.5 rounded cursor-pointer ${dark ? 'text-slate-500 hover:text-white bg-slate-800' : 'text-slate-400 hover:text-slate-700 bg-slate-200'}`}>Clear</button>
              )}
            </div>
            {/* Table */}
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-3">
                <RefreshCw className="h-5 w-5 animate-spin" style={{ color: GOLD }} />
                <span className={`text-xs font-bold uppercase tracking-wider ${C.sub}`}>Syncing ledger...</span>
              </div>
            ) : filteredTxs.length === 0 ? (
              <div className={`flex flex-col items-center justify-center py-20 gap-3 ${C.sub}`}>
                <Search className="h-10 w-10 opacity-20" style={{ color: GOLD }} />
                <p className="text-xs font-bold uppercase tracking-wider">No matching records</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={`border-b sticky top-0 backdrop-blur-md ${dark ? 'border-slate-900 bg-[#0D1B2E]/90' : 'border-slate-100 bg-white/95'}`}>
                      {[
                        { label: 'Time', key: 'time' as const },
                        { label: 'Route', key: null },
                        { label: 'Relay', key: null },
                        { label: 'Amount', key: 'amount' as const },
                        { label: 'Wallet', key: null },
                        { label: 'Explorer', key: null },
                      ].map(col => (
                        <th key={col.label}
                          onClick={() => { if (!col.key) return; if (sortKey === col.key) setSortDir(d => d === 'desc' ? 'asc' : 'desc'); else { setSortKey(col.key!); setSortDir('desc'); }}}
                          className={`px-4 py-3 text-left text-[9px] font-black uppercase tracking-[0.18em] ${C.sub} ${col.key ? 'cursor-pointer hover:text-amber-500 transition-colors select-none' : ''}`}>
                          <span className="flex items-center gap-1">
                            {col.label}
                            {col.key && sortKey === col.key && (sortDir === 'desc' ? <ChevronDown className="h-3 w-3" style={{ color: GOLD }} /> : <ChevronUp className="h-3 w-3" style={{ color: GOLD }} />)}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxs.map((tx, ri) => {
                      const fc = getChainById(tx.from_chain_id);
                      const tc = getChainById(tx.to_chain_id);
                      const d = new Date(tx.timestamp);
                      const hash = tx.burn_tx_hash || tx.id;
                      return (
                        <motion.tr key={tx.id}
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ri * 0.008 }}
                          className={`border-b transition-colors ${dark ? 'border-slate-900/60 hover:bg-slate-900/30' : 'border-slate-100 hover:bg-slate-50'}`}>
                          <td className={`px-4 py-3 text-[10px] font-mono whitespace-nowrap ${C.sub}`}>
                            {d.toLocaleDateString()}
                            <br/>
                            <span className={dark ? 'text-slate-700' : 'text-slate-400'}>{d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>
                          <td className="px-4 py-3 text-[11px] font-bold whitespace-nowrap">
                            <span className={dark ? 'text-slate-300' : 'text-slate-700'}>{fc?.shortName ?? tx.from_chain_id}</span>
                            <span className={`mx-1.5 ${dark ? 'text-slate-700' : 'text-slate-300'}`}>to</span>
                            <span style={{ color: '#D4A043' }}>{tc?.shortName ?? tx.to_chain_id}</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 text-[8px] font-black uppercase px-2 py-0.5 rounded-full border"
                              style={{ color: '#10B981', background: 'rgba(16,185,129,0.08)', borderColor: 'rgba(16,185,129,0.2)' }}>
                              <Zap className="h-2 w-2" /> Auto
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`text-[11px] font-black font-mono ${C.text}`}>${parseFloat(tx.amount).toFixed(2)}</span>
                            <span className={`text-[8px] ml-1 ${C.sub}`}>USDC</span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-mono ${C.sub}`}>{shortAddr(tx.user_address)}</span>
                              <button onClick={() => copy(tx.user_address, tx.id + 'w')} title="Copy wallet"
                                className={`p-0.5 rounded cursor-pointer transition-all ${dark ? 'text-slate-700 hover:text-slate-300' : 'text-slate-300 hover:text-slate-600'}`}>
                                {copied === tx.id + 'w' ? <CheckCircle2 className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                              </button>
                              <button onClick={() => setWalletModal(tx.user_address)} title="View history"
                                className={`p-0.5 rounded cursor-pointer transition-all ${dark ? 'text-slate-700 hover:text-amber-400' : 'text-slate-300 hover:text-amber-500'}`}>
                                <Eye className="h-3 w-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {hash?.startsWith('0x') ? (
                              <a href={`${fc?.explorerUrl ?? 'https://testnet.arcscan.app'}/tx/${hash}`}
                                target="_blank" rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-mono font-bold hover:underline"
                                style={{ color: '#D4A043' }}>
                                {hash.slice(0, 8)}<ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            ) : <span className={dark ? 'text-slate-700' : 'text-slate-300'}>N/A</span>}
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
        <div className={`flex flex-col sm:flex-row items-center justify-between border-t ${C.divider} pt-6 gap-3`}>
          <p className={`text-[10px] font-semibold ${C.sub}`}>
            ArcShift Bridge · Circle CCTP v2 Forwarding Service · {new Date().getFullYear()}
          </p>
          <div className={`flex gap-5 text-[10px] font-bold ${C.sub}`}>
            <a href="https://x.com/asadleo416" target="_blank" rel="noreferrer" className="hover:text-amber-500 transition-colors">Twitter</a>
            <a href="https://github.com/Asadlee24/arcshift-usdc-bridge" target="_blank" rel="noreferrer" className="hover:text-amber-500 transition-colors">GitHub</a>
            <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" className="hover:text-amber-500 transition-colors">Arc Explorer</a>
          </div>
        </div>

      </div>
    </div>
  );
}
