'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BarChart3, Users, Zap, ArrowRightLeft, ExternalLink, 
  RefreshCw, CheckCircle2, TrendingUp, ShieldCheck, Search,
  Award, Flame, MapPin, Compass
} from 'lucide-react';
import { getAllTxsFromSupabase, SupabaseTx } from '../../lib/supabase';
import { getChainById, SUPPORTED_CHAINS } from '../../constants/chains';

// ── Premium Stat Card ────────────────────────────────────────────────────────
interface StatCardProps {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  colorClass?: string;
  glowColor?: string;
}

function StatCard({
  icon: Icon, label, value, sub, colorClass = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', glowColor = 'from-emerald-500/5'
}: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3, scale: 1.01, transition: { duration: 0.2 } }}
      className="relative bg-[#0F172A]/40 backdrop-blur-xl border border-slate-800 hover:border-emerald-500/30 rounded-2xl p-5 transition-all duration-300 shadow-[0_4px_25px_rgba(0,0,0,0.6)] overflow-hidden group"
    >
      <div className={`absolute top-0 right-0 w-28 h-28 bg-gradient-to-br ${glowColor} to-transparent rounded-full blur-xl group-hover:scale-150 transition-transform duration-500`} />
      <div className="flex items-center justify-between mb-3.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
        <div className={`p-2 rounded-xl border ${colorClass} transition-all duration-300 group-hover:scale-110`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
      </div>
      <p className="text-2.5xl font-black text-white tracking-tight tabular-nums group-hover:text-emerald-400 transition-colors duration-300">{value}</p>
      {sub && <p className="text-[10px] text-slate-500 mt-2 font-semibold tracking-wide uppercase">{sub}</p>}
    </motion.div>
  );
}

export default function AnalyticsPage() {
  const [allTxs, setAllTxs] = useState<SupabaseTx[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChainFilter, setSelectedChainFilter] = useState<string>('all');

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

  // Filter out any pending or failed transactions entirely
  const successfulTxs = useMemo(() => {
    return allTxs.filter((t) => t.status === 'success');
  }, [allTxs]);

  // Derived Statistics from successful transactions only
  const stats = useMemo(() => {
    const totalCount = successfulTxs.length;
    const uniqueWallets = new Set(successfulTxs.map((t) => t.user_address.toLowerCase())).size;
    const totalVolume = successfulTxs.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);
    const avgTxSize = totalCount > 0 ? totalVolume / totalCount : 0;

    // Source Chain Distribution
    const chainDistribution: Record<string, { count: number; volume: number; color: string; id: number }> = {};
    successfulTxs.forEach((t) => {
      const chain = getChainById(t.from_chain_id);
      const name = chain?.shortName || `Chain ${t.from_chain_id}`;
      if (!chainDistribution[name]) {
        chainDistribution[name] = { count: 0, volume: 0, color: chain?.color || '#10B981', id: t.from_chain_id };
      }
      chainDistribution[name].count += 1;
      chainDistribution[name].volume += parseFloat(t.amount || '0');
    });

    const sortedDistribution = Object.entries(chainDistribution)
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.volume - a.volume);

    // Top Routes Distribution
    const routeDistribution: Record<string, { count: number; volume: number; from: string; to: string }> = {};
    successfulTxs.forEach((t) => {
      const fromChain = getChainById(t.from_chain_id);
      const toChain = getChainById(t.to_chain_id);
      const fromName = fromChain?.shortName || `Chain ${t.from_chain_id}`;
      const toName = toChain?.shortName || `Chain ${t.to_chain_id}`;
      const routeKey = `${fromName} → ${toName}`;

      if (!routeDistribution[routeKey]) {
        routeDistribution[routeKey] = { count: 0, volume: 0, from: fromName, to: toName };
      }
      routeDistribution[routeKey].count += 1;
      routeDistribution[routeKey].volume += parseFloat(t.amount || '0');
    });

    const sortedRoutes = Object.entries(routeDistribution)
      .map(([route, data]) => ({ route, ...data }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 3);

    // Top Bridgers Leaderboard
    const walletDistribution: Record<string, { volume: number; count: number }> = {};
    successfulTxs.forEach((t) => {
      const wallet = t.user_address.toLowerCase();
      if (!walletDistribution[wallet]) {
        walletDistribution[wallet] = { volume: 0, count: 0 };
      }
      walletDistribution[wallet].volume += parseFloat(t.amount || '0');
      walletDistribution[wallet].count += 1;
    });

    const leaderboard = Object.entries(walletDistribution)
      .map(([wallet, data]) => ({ wallet, ...data }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5);

    return { totalCount, uniqueWallets, totalVolume, avgTxSize, sortedDistribution, sortedRoutes, leaderboard };
  }, [successfulTxs]);

  // Apply search query and chain filters to the displayed list
  const filteredTxs = useMemo(() => {
    return successfulTxs.filter((tx) => {
      const fromChain = getChainById(tx.from_chain_id);
      const toChain = getChainById(tx.to_chain_id);
      const matchesSearch = 
        tx.user_address.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.burn_tx_hash && tx.burn_tx_hash.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.mint_tx_hash && tx.mint_tx_hash.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesChain = 
        selectedChainFilter === 'all' ||
        String(tx.from_chain_id) === selectedChainFilter ||
        String(tx.to_chain_id) === selectedChainFilter;

      return matchesSearch && matchesChain;
    });
  }, [successfulTxs, searchQuery, selectedChainFilter]);

  return (
    <div className="min-h-screen bg-[#070B13] text-white font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-x-hidden relative">
      {/* Background Cyber Glow Effects */}
      <div className="absolute top-[-5%] left-[-5%] w-[45%] h-[45%] bg-emerald-500/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-5%] right-[-5%] w-[45%] h-[45%] bg-indigo-500/5 rounded-full blur-[140px] pointer-events-none" />

      {/* Sticky Header */}
      <div className="border-b border-slate-900 bg-[#070B13]/90 backdrop-blur-xl sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8.5 w-8.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <BarChart3 className="h-4.5 w-4.5 text-emerald-400" />
            </div>
            <span className="font-black text-lg tracking-tight">
              Arc<span className="text-emerald-400">Shift</span>
              <span className="ml-2 text-slate-500 font-semibold text-[10px] uppercase tracking-widest hidden sm:inline-block">/ Analytics</span>
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider hidden md:block">
                Refreshed: {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 px-3.5 py-2 rounded-xl transition-all cursor-pointer border border-slate-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <a
              href="/"
              className="text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2 rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:shadow-[0_0_20px_rgba(16,185,129,0.4)]"
            >
              Launch Bridge
            </a>
          </div>
        </div>
      </div>

      {/* Live Attestation / Bridge Activity Ticker */}
      <div className="bg-[#0b1320] border-b border-slate-900 py-2.5 overflow-hidden relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider shrink-0 animate-pulse">
            <Flame className="h-3 w-3" /> Live Feed
          </div>
          <div className="flex-1 overflow-hidden relative h-5">
            <div className="absolute inset-0 flex items-center whitespace-nowrap animate-[marquee_25s_linear_infinite] hover:[animation-play-state:paused] gap-10">
              {successfulTxs.slice(0, 5).map((t, idx) => {
                const fromChain = getChainById(t.from_chain_id);
                const toChain = getChainById(t.to_chain_id);
                return (
                  <span key={idx} className="text-[11px] font-bold text-slate-400 inline-flex items-center gap-2">
                    <span className="text-white font-mono">{t.user_address.slice(0, 6)}...{t.user_address.slice(-4)}</span>
                    <span>bridged</span>
                    <span className="text-emerald-400">${parseFloat(t.amount).toFixed(2)} USDC</span>
                    <span className="text-slate-500 font-semibold">{fromChain?.shortName} → {toChain?.shortName}</span>
                  </span>
                );
              })}
              {successfulTxs.length === 0 && (
                <span className="text-[11px] font-bold text-slate-500">Awaiting live bridge swap events...</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 relative z-10">
        
        {/* Title */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="mb-8"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-3">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified Ledger (Supabase Secure Node)
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Network Diagnostics & Logs</h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-3xl">
            Real-time analytics engine processing successful cross-chain USDC transfers on Circle CCTP v2 infrastructure. 
            All data is permanently verified against the <span className="text-emerald-400 font-bold">Arc Network Ledger</span>.
          </p>
        </motion.div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard 
            icon={ArrowRightLeft} 
            label="Completed Bridges" 
            value={loading ? '—' : stats.totalCount} 
            sub="Successful Transfers" 
            colorClass="text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
            glowColor="from-emerald-500/5"
          />
          <StatCard 
            icon={Zap} 
            label="Total Volume" 
            value={loading ? '—' : `$${stats.totalVolume.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
            sub="Aggregated USDC value" 
            colorClass="text-yellow-400 bg-yellow-500/10 border-yellow-500/20"
            glowColor="from-yellow-500/5"
          />
          <StatCard 
            icon={Users} 
            label="Unique Bridgers" 
            value={loading ? '—' : stats.uniqueWallets} 
            sub="Active Wallet Addresses" 
            colorClass="text-blue-400 bg-blue-500/10 border-blue-500/20"
            glowColor="from-blue-500/5"
          />
          <StatCard 
            icon={Compass} 
            label="Avg Transfer Size" 
            value={loading ? '—' : `$${stats.avgTxSize.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
            sub="Avg volume per transaction" 
            colorClass="text-purple-400 bg-purple-500/10 border-purple-500/20"
            glowColor="from-purple-500/5"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          
          {/* Left Column - Shares and Charts */}
          <div className="flex flex-col gap-6 lg:col-span-1">
            
            {/* Source Chain Share */}
            <motion.div 
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#0F172A]/40 backdrop-blur-xl border border-slate-800 rounded-2xl p-5"
            >
              <h2 className="font-bold text-xs text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Source Chains Share
              </h2>
              
              {loading ? (
                <div className="py-12 text-center text-slate-500 text-xs">Syncing source metrics...</div>
              ) : stats.sortedDistribution.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-xs">No active volume records.</div>
              ) : (
                <div className="flex flex-col gap-4">
                  {stats.sortedDistribution.slice(0, 5).map((chain) => {
                    const percent = stats.totalVolume > 0 ? (chain.volume / stats.totalVolume) * 100 : 0;
                    return (
                      <div key={chain.name} className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-300">{chain.name}</span>
                          <span className="text-slate-400 font-mono text-[10px]">${chain.volume.toFixed(2)} ({percent.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                          <div 
                            className="h-full rounded-full" 
                            style={{ 
                              width: `${percent}%`, 
                              backgroundColor: chain.color 
                            }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

            {/* Top Routes Visualizer */}
            <motion.div 
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#0F172A]/40 backdrop-blur-xl border border-slate-800 rounded-2xl p-5"
            >
              <h2 className="font-bold text-xs text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
                <MapPin className="h-4 w-4 text-emerald-400" />
                Popular Routes
              </h2>
              
              {loading ? (
                <div className="py-12 text-center text-slate-500 text-xs">Syncing routes...</div>
              ) : stats.sortedRoutes.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-xs">No route logs available.</div>
              ) : (
                <div className="flex flex-col gap-3">
                  {stats.sortedRoutes.map((r, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-900/40 border border-slate-800/60 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2 text-xs font-extrabold">
                        <span className="text-slate-300">{r.from}</span>
                        <ArrowRightLeft className="h-3 w-3 text-emerald-400/80" />
                        <span className="text-emerald-400">{r.to}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-mono font-bold text-white">${r.volume.toFixed(2)}</p>
                        <p className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">{r.count} Swap{r.count > 1 ? 's' : ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Top Bridgers Leaderboard */}
            <motion.div 
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#0F172A]/40 backdrop-blur-xl border border-slate-800 rounded-2xl p-5"
            >
              <h2 className="font-bold text-xs text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
                <Award className="h-4 w-4 text-emerald-400" />
                Top Bridgers
              </h2>
              
              {loading ? (
                <div className="py-12 text-center text-slate-500 text-xs">Loading leaderboard...</div>
              ) : stats.leaderboard.length === 0 ? (
                <div className="py-12 text-center text-slate-600 text-xs">No active wallet metrics.</div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {stats.leaderboard.map((user, idx) => {
                    const medals = ['🥇', '🥈', '🥉'];
                    return (
                      <div key={user.wallet} className="flex items-center justify-between text-xs py-1 border-b border-slate-900/60 last:border-0 pb-2 last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm shrink-0 w-5">{medals[idx] || `${idx + 1}`}</span>
                          <span className="font-mono font-bold text-slate-300">{user.wallet.slice(0, 6)}...{user.wallet.slice(-4)}</span>
                        </div>
                        <div className="text-right font-bold text-white">
                          <p className="text-[11.5px] font-mono">${user.volume.toFixed(2)}</p>
                          <p className="text-[8px] text-slate-500 uppercase tracking-wider">{user.count} Tx{user.count > 1 ? 's' : ''}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>

          </div>

          {/* Right Column - Filters and Transaction Registry Table */}
          <div className="flex flex-col gap-6 lg:col-span-2">
            <motion.div 
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-[#0F172A]/40 backdrop-blur-xl border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between"
            >
              {/* Header + Search Tools */}
              <div>
                <div className="px-5 py-4.5 border-b border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h2 className="font-bold text-sm text-white flex items-center gap-2 uppercase tracking-wide">
                      <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
                      Transaction Registry
                    </h2>
                    <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                      Showing {filteredTxs.length} verified successful transfer{filteredTxs.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Chain Dropdown Filter */}
                  <select
                    value={selectedChainFilter}
                    onChange={(e) => setSelectedChainFilter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-xs font-bold text-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    <option value="all">Filter: All Chains</option>
                    {SUPPORTED_CHAINS.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Search Bar */}
                <div className="px-5 py-3 border-b border-slate-900 bg-slate-950/20 flex items-center gap-2">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search by wallet address or transaction hash..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-transparent border-0 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-0"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-[10px] font-black uppercase text-slate-500 hover:text-white px-2 py-0.5 bg-slate-800/40 rounded cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Table Data */}
                {loading ? (
                  <div className="flex items-center justify-center py-24 gap-3 text-slate-500">
                    <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Synchronizing ledger...</span>
                  </div>
                ) : filteredTxs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
                    <Compass className="h-10 w-10 opacity-30 text-emerald-400 animate-pulse" />
                    <div className="text-center">
                      <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">No matching transaction records.</p>
                      <p className="text-[10px] text-slate-500 mt-1">Initiate a swap or change your search filters.</p>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-[580px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-900 text-slate-500 bg-slate-950/40 sticky top-0 backdrop-blur-md">
                          {['Time', 'Route', 'Amount', 'Wallet', 'Status', 'Explorer'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-[9px] font-black uppercase tracking-widest text-slate-500">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900/60">
                        {filteredTxs.map((tx) => {
                          const fromChain = getChainById(tx.from_chain_id);
                          const toChain = getChainById(tx.to_chain_id);
                          const date = new Date(tx.timestamp);
                          const hash = tx.burn_tx_hash || tx.id;

                          return (
                            <tr
                              key={tx.id}
                              className="hover:bg-slate-900/30 transition-colors"
                            >
                              <td className="px-4 py-3 text-[11px] text-slate-500 font-mono whitespace-nowrap">
                                {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="px-4 py-3 text-xs font-extrabold whitespace-nowrap">
                                <span className="text-slate-300">{fromChain?.shortName ?? tx.from_chain_id}</span>
                                <span className="text-slate-500 mx-1">→</span>
                                <span className="text-emerald-400">{toChain?.shortName ?? tx.to_chain_id}</span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs font-bold text-white font-mono">
                                  ${parseFloat(tx.amount).toFixed(2)}
                                </span>
                                <span className="text-[9px] font-black text-slate-500 ml-1">USDC</span>
                              </td>
                              <td className="px-4 py-3 text-xs font-mono text-slate-400">
                                {tx.user_address.slice(0, 6)}...{tx.user_address.slice(-4)}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-400 uppercase tracking-wider">
                                  <CheckCircle2 className="h-3 w-3" /> Success
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {hash && hash.startsWith('0x') ? (
                                  <a
                                    href={`${fromChain?.explorerUrl ?? 'https://testnet.arcscan.app'}/tx/${hash}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-mono hover:underline font-bold"
                                  >
                                    {hash.slice(0, 6)}...
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-600">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-900 pt-6 text-xs text-slate-600">
          <p>
            ArcShift USDC Bridge · Live Sandbox Registry
          </p>
          <div className="flex gap-4 mt-2 sm:mt-0 font-medium">
            <a href="https://x.com/asadleo416" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">
              X (Twitter)
            </a>
            <span>·</span>
            <a href="https://github.com/Asadlee24/arcshift-usdc-bridge" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">
              GitHub Repo
            </a>
            <span>·</span>
            <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" className="hover:text-emerald-400 transition-colors">
              Arc Explorer
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
