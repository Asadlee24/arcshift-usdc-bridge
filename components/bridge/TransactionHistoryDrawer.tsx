// components/bridge/TransactionHistoryDrawer.tsx
// Premium slide-over drawer displaying CCTP transaction history and real-time CCTP Scan Tracker
// Supports local history tracking, dark/light theme, and parallel RPC scanning for live status

'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, ExternalLink, Calendar, ArrowRight, Activity, ShieldAlert, CheckCircle2, Clock, Loader2, Search } from 'lucide-react';
import { useTransactionHistory, BridgeTransaction } from '../../hooks/useTransactionHistory';
import { getChainById, SUPPORTED_CHAINS } from '../../constants/chains';
import { keccak256 } from 'viem';
import { writeContract, waitForTransactionReceipt, getAccount, switchChain, getGasPrice } from '@wagmi/core';
import { config } from '../../lib/wagmi';
import { rpcCall } from '../../lib/rpcClient';
import { getPublicClientForChain } from '../../lib/publicClient';

const MESSAGE_TRANSMITTER_ABI = [
  {
    name: 'receiveMessage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' }
    ],
    outputs: []
  }
] as const;

interface TransactionHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
}

export default function TransactionHistoryDrawer({
  isOpen,
  onClose,
  theme = 'light'
}: TransactionHistoryDrawerProps) {
  const { history, clearHistory } = useTransactionHistory();
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  // Tabs state
  const [activeTab, setActiveTab] = useState<'history' | 'scan'>('history');

  // Scanner state
  const [scanHash, setScanHash] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    sourceChainName: string;
    sourceChainId?: number;
    blockNumber: number;
    attestationStatus: 'complete' | 'pending';
    mintStatus: 'complete' | 'pending';
    destChainName?: string;
    destChainId?: number;
    message?: string;
    attestation?: string;
  } | null>(null);

  const [isClaiming, setIsClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);

  const isDark = theme === 'dark';
  const drawerBg = isDark ? 'bg-[#0A0E17]' : 'bg-[#F8FAFC]';
  const borderCol = isDark ? 'border-[#1E293B]' : 'border-slate-200';
  const textPrimary = isDark ? 'text-white' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark ? 'bg-[#131B2E]/60' : 'bg-white';
  const cardBorder = isDark ? 'border-[#1E293B]' : 'border-slate-200';
  const hoverCardBg = isDark ? 'hover:bg-[#131B2E]/90' : 'hover:bg-slate-50';

  const getMessageTransmitterAddress = (chainId: number): string => {
    // Always return the custom MessageTransmitter V2 address deployed by Arc Network across all supported testnets.
    // This is required because we burn using Arc's custom TokenMessenger (0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa).
    return '0xe737e5cebeeba77efe34d4aa090756590b1ce275';
  };

  const formatAddress = (addr: string) => {
    return addr.substring(0, 6) + '...' + addr.substring(addr.length - 4);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleClearClick = () => {
    if (showConfirmClear) {
      clearHistory();
      setShowConfirmClear(false);
    } else {
      setShowConfirmClear(true);
    }
  };

  const handleStartScan = async (hashToScan?: string) => {
    const targetHash = hashToScan || scanHash;
    let cleanHash = targetHash.trim();

    // Auto-extract tx hash if user enters full explorer URL
    const txPattern = /tx\/(0x[a-fA-F0-9]{64})/;
    const match = cleanHash.match(txPattern);
    if (match) {
      cleanHash = match[1];
    }

    cleanHash = cleanHash.toLowerCase();

    if (!cleanHash.startsWith('0x') && cleanHash.length === 64) {
      cleanHash = '0x' + cleanHash;
    }

    if (!cleanHash.startsWith('0x') || cleanHash.length !== 66) {
      setScanError('Please enter a valid 66-character transaction hash.');
      return;
    }

    setIsScanning(true);
    setScanError(null);
    setScanResult(null);

    // Chains are identified by id rather than by a single URL. rpcCall resolves the id
    // against lib/rpcEndpoints, which fails over between endpoints and substitutes the
    // /api/rpc proxy for CORS-blocked ones. Scanning c.rpcUrl directly (as this did before)
    // meant Arc could never be searched from the browser: its only public endpoint sends no
    // CORS headers, so the lookup always failed and a valid Arc hash was reported as
    // "not found on any supported testnets".
    interface ScanRpcConfig {
      id: number;
      name: string;
      domain: number;
    }

    // List of chains mapped dynamically from SUPPORTED_CHAINS config
    const rpcs: ScanRpcConfig[] = SUPPORTED_CHAINS
      .filter(c => c.cctpDomain !== undefined && !c.isComingSoon)
      .map(c => ({
        id: c.id,
        name: c.name,
        domain: c.cctpDomain!
      }));

    let foundReceipt: any = null;
    let foundChain: ScanRpcConfig | null = null;

    // Search parallel across all chains — use mutex flag to avoid double-assign
    const results = await Promise.all(
      rpcs.map(async (rpc) => {
        // rpcCall returns null on failure rather than throwing, so an unreachable chain
        // simply drops out of the search instead of rejecting the whole Promise.all.
        const receipt = await rpcCall<any>(rpc.id, {
          method: 'eth_getTransactionReceipt',
          params: [cleanHash],
        });
        return receipt ? { receipt, chain: rpc } : null;
      })
    );
    const found = results.find(r => r !== null);
    if (found) { foundReceipt = found.receipt; foundChain = found.chain; }

    if (!foundReceipt || !foundChain) {
      setIsScanning(false);
      setScanError('Transaction hash not found on any supported testnets. Make sure it is confirmed on the source network.');
      return;
    }

    const sourceChain = foundChain as ScanRpcConfig;
    const blockNumber = parseInt(foundReceipt.blockNumber, 16);

    // Helper: decode destination chain name from Circle message bytes
    const decodeDestChain = (messageBytes: string): string | undefined => {
      try {
        // destDomain is at bytes 8-11 (offset 18-26 in hex string after '0x')
        const hex = messageBytes.startsWith('0x') ? messageBytes.slice(2) : messageBytes;
        const destDomain = parseInt(hex.substring(16, 24), 16);
        const match = rpcs.find(r => r.domain === destDomain);
        return match ? match.name : `Domain ${destDomain}`;
      } catch { return undefined; }
    };

    try {
      // Fetch official attestation details from Circle Sandbox Iris API
      const attestUrl = `https://iris-api-sandbox.circle.com/v2/messages/${sourceChain.domain}?transactionHash=${cleanHash}`;
      const attestRes = await fetch(attestUrl);
      
      if (!attestRes.ok) {
        setIsScanning(false);
        setScanResult({
          sourceChainName: sourceChain.name,
          sourceChainId: sourceChain.id,
          blockNumber,
          attestationStatus: 'pending',
          mintStatus: 'pending',
          destChainName: undefined
        });
        return;
      }

      const attestData = await attestRes.json();
      const messageObj = attestData?.messages?.[0];

      if (!messageObj) {
        setIsScanning(false);
        setScanResult({
          sourceChainName: sourceChain.name,
          sourceChainId: sourceChain.id,
          blockNumber,
          attestationStatus: 'pending',
          mintStatus: 'pending',
          destChainName: undefined
        });
        return;
      }

      // Even if pending, we can still decode the destination from message bytes
      const pendingDestName = messageObj.message ? decodeDestChain(messageObj.message) : undefined;

      if (messageObj.status !== 'complete') {
        setIsScanning(false);
        setScanResult({
          sourceChainName: sourceChain.name,
          sourceChainId: sourceChain.id,
          blockNumber,
          attestationStatus: 'pending',
          mintStatus: 'pending',
          destChainName: pendingDestName
        });
        return;
      }

      // Attestation is complete!
      const messageBytes = messageObj.message as string;
      const cleanBytes = messageBytes.startsWith('0x') ? messageBytes.slice(2) : messageBytes;

      const destDomain = parseInt(cleanBytes.substring(16, 24), 16);
      const destChain = rpcs.find(r => r.domain === destDomain);

      const sourceDomain = parseInt(cleanBytes.substring(8, 16), 16);
      const nonceHex = cleanBytes.substring(24, 40);

      // Pack parameters for keccak256
      const domainHex = sourceDomain.toString(16).padStart(8, '0');
      const packedHex = '0x' + domainHex + nonceHex.padStart(16, '0');

      let mintStatus: 'complete' | 'pending' = 'pending';

      if (destChain) {
        try {
          // Registry-aware client, so a CORS-blocked destination (Arc) is read through the
          // proxy instead of failing and leaving a completed mint displayed as "pending".
          const destClient = getPublicClientForChain(destChain.id);
          const used = await destClient.readContract({
            address: getMessageTransmitterAddress(destChain.id) as `0x${string}`,
            abi: [
              {
                name: 'usedNonces',
                type: 'function',
                stateMutability: 'view',
                inputs: [{ name: 'sourceAndNonce', type: 'bytes32' }],
                outputs: [{ type: 'uint256' }]
              }
            ],
            functionName: 'usedNonces',
            args: [keccak256(packedHex as `0x${string}`)]
          });
          if (used > BigInt(0)) {
            mintStatus = 'complete';
          }
        } catch (e) {
          console.warn('Error reading usedNonces on dest chain:', e);
        }
      }

      setIsScanning(false);
      setScanResult({
        sourceChainName: sourceChain.name,
        sourceChainId: sourceChain.id,
        blockNumber,
        attestationStatus: 'complete',
        mintStatus,
        destChainName: destChain ? destChain.name : `Domain ${destDomain}`,
        destChainId: destChain ? destChain.id : undefined,
        message: messageBytes,
        attestation: messageObj.attestation
      });
    } catch (err) {
      console.error('Scanning error:', err);
      setIsScanning(false);
      setScanError('An error occurred while tracking the transaction status.');
    }
  };

  const handleClaimRescue = async () => {
    if (!scanResult || !scanResult.message || !scanResult.attestation || !scanResult.destChainId) {
      setClaimError('Invalid or incomplete transaction attestation data.');
      return;
    }

    setIsClaiming(true);
    setClaimError(null);

    try {
      const accountInfo = getAccount(config);
      if (!accountInfo.isConnected || !accountInfo.address) {
        throw new Error('Please connect your wallet first.');
      }

      if (accountInfo.chainId !== scanResult.destChainId) {
        await switchChain(config, { chainId: scanResult.destChainId as any });
      }

      let mintGasPrice;
      try {
        mintGasPrice = await getGasPrice(config, { chainId: scanResult.destChainId as any });
      } catch (err) {
        console.warn("Failed to fetch mint gas price:", err);
      }

      const isDestOpStack = [11155420, 1301, 763373].includes(scanResult.destChainId);

      const realTransmitter = getMessageTransmitterAddress(scanResult.destChainId);
      const destinationTransmitter = realTransmitter;

      const mintHash = await writeContract(config, {
        address: destinationTransmitter as `0x${string}`,
        abi: MESSAGE_TRANSMITTER_ABI,
        functionName: 'receiveMessage',
        args: [
          scanResult.message as `0x${string}`,
          scanResult.attestation as `0x${string}`
        ],
        chainId: scanResult.destChainId as any,
        ...(isDestOpStack ? {
          gas: BigInt(400000),
          gasPrice: mintGasPrice,
          type: 'legacy',
        } : {})
      });

      const receipt = await waitForTransactionReceipt(config, { hash: mintHash });
      if (receipt.status === 'reverted') {
        throw new Error('Claim transaction reverted on-chain. Please check your gas balance or try again.');
      }

      setScanResult(prev => prev ? { ...prev, mintStatus: 'complete' } : null);

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('bridge-success-refresh'));
      }
    } catch (err: any) {
      console.error('Rescue claim error:', err);
      setClaimError(err.message || 'Mint execution failed. Please verify your gas tokens and try again.');
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 cursor-pointer"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className={`fixed right-0 top-0 bottom-0 w-full sm:w-[460px] ${drawerBg} border-l ${borderCol} shadow-2xl z-50 flex flex-col`}
          >
            {/* Header */}
            <div className={`p-6 border-b ${borderCol} flex items-center justify-between`}>
              <div>
                <h2 className={`text-lg font-black tracking-tight ${textPrimary} flex items-center gap-2`}>
                  <Activity className="h-5 w-5 text-[#10B981]" />
                  Transaction Hub
                </h2>
                <p className={`text-xs font-semibold ${textMuted} mt-0.5`}>
                  Track your transfers or search by transaction hash
                </p>
              </div>
              <button
                onClick={onClose}
                className={`p-2 rounded-lg transition-colors cursor-pointer ${
                  isDark ? 'text-slate-400 hover:bg-slate-800 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className={`px-6 py-3 border-b ${borderCol} flex gap-2 bg-slate-950/10`}>
              <button
                onClick={() => setActiveTab('history')}
                type="button"
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                  activeTab === 'history'
                    ? 'bg-[#10B981] text-[#070B13] border-[#10B981] shadow-lg shadow-emerald-500/10'
                    : isDark
                      ? 'border-[#1E293B] text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Local History
              </button>
              <button
                onClick={() => setActiveTab('scan')}
                type="button"
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer text-center ${
                  activeTab === 'scan'
                    ? 'bg-[#10B981] text-[#070B13] border-[#10B981] shadow-lg shadow-emerald-500/10'
                    : isDark
                      ? 'border-[#1E293B] text-slate-400 hover:text-white hover:bg-slate-800'
                      : 'border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                CCTP Scan Tracker
              </button>
            </div>

            {/* Tab 1: Local History Content */}
            {activeTab === 'history' && (
              <>
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {history.length === 0 ? (
                    // Empty State
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                      <div className={`h-16 w-16 rounded-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'} flex items-center justify-center mb-4`}>
                        <Activity className={`h-8 w-8 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                      </div>
                      <h3 className={`text-sm font-bold ${textPrimary}`}>No transactions found</h3>
                      <p className={`text-xs font-semibold ${textMuted} mt-1 max-w-[280px]`}>
                        Bridge transactions made on this wallet will appear here automatically.
                      </p>
                    </div>
                  ) : (
                    history.map((tx) => {
                      const fromChain = getChainById(tx.fromChainId);
                      const toChain = getChainById(tx.toChainId);

                      return (
                        <div
                          key={tx.id}
                          className={`border ${cardBorder} ${cardBg} ${hoverCardBg} rounded-2xl p-4 shadow-sm transition-all duration-200 flex flex-col gap-3.5`}
                        >
                          {/* Top row: chains & amount */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {/* From Chain */}
                              <div className="flex items-center gap-1.5">
                                {fromChain && (
                                  <img
                                    src={fromChain.iconUrl}
                                    alt={fromChain.name}
                                    className="h-5 w-5 rounded-full object-contain border border-slate-700/10 shadow-sm"
                                  />
                                )}
                                <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {fromChain?.shortName || 'Unknown'}
                                </span>
                              </div>

                              <ArrowRight className={`h-3.5 w-3.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />

                              {/* To Chain */}
                              <div className="flex items-center gap-1.5">
                                {toChain && (
                                  <img
                                    src={toChain.iconUrl}
                                    alt={toChain.name}
                                    className="h-5 w-5 rounded-full object-contain border border-slate-700/10 shadow-sm"
                                  />
                                )}
                                <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {toChain?.shortName || 'Unknown'}
                                </span>
                              </div>
                            </div>

                            {/* Amount */}
                            <div className="text-right">
                              {tx.fromChainId === tx.toChainId ? (
                                <span className={`text-xs font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {tx.amount}
                                </span>
                              ) : (
                                <span className={`text-sm font-black font-mono tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                  {parseFloat(tx.amount).toFixed(2)}
                                  <span className={`text-[10px] ${isDark ? 'text-[#10B981]' : 'text-emerald-600'} font-bold ml-1`}>USDC</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Middle row: Status, Timestamp & details */}
                          <div className={`flex items-center justify-between border-t border-dashed ${isDark ? 'border-slate-800' : 'border-slate-200'} pt-3`}>
                            {/* Timestamp */}
                            <div className={`flex items-center gap-1 text-[11px] font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(tx.timestamp)}</span>
                            </div>

                            {/* Status Badge */}
                            <div className="flex items-center">
                              {tx.status === 'success' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Success
                                </span>
                              )}
                              {tx.status === 'pending' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/30 text-amber-500 animate-pulse">
                                  <Clock className="h-3 w-3" />
                                  Pending
                                </span>
                              )}
                              {tx.status === 'failed' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 border border-red-500/30 text-red-500">
                                  <ShieldAlert className="h-3 w-3" />
                                  Failed
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Transaction hashes */}
                          <div className={`flex flex-col gap-2 text-[11px] ${isDark ? 'bg-slate-900/60' : 'bg-slate-100'} rounded-xl p-3 font-mono`}>
                            {tx.burnTxHash && (
                              <div className="flex items-center justify-between">
                                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                  {tx.fromChainId === tx.toChainId ? 'Tx Hash:' : 'Burn Hash:'}
                                </span>
                                <a
                                  href={fromChain ? `${fromChain.explorerUrl}/tx/${tx.burnTxHash}` : '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#10B981] hover:text-[#059669] hover:underline flex items-center gap-1 font-bold"
                                >
                                  <span>{formatAddress(tx.burnTxHash)}</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                            {tx.mintTxHash && (
                              <div className="flex items-center justify-between">
                                <span className={isDark ? 'text-slate-400' : 'text-slate-600'}>
                                  {tx.fromChainId === tx.toChainId ? 'Receipt Hash:' : 'Mint Hash:'}
                                </span>
                                <a
                                  href={toChain ? `${toChain.explorerUrl}/tx/${tx.mintTxHash}` : '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#10B981] hover:text-[#059669] hover:underline flex items-center gap-1 font-bold"
                                >
                                  <span>{formatAddress(tx.mintTxHash)}</span>
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            )}
                          </div>
                          {tx.status === 'pending' && (
                            <button
                              onClick={() => {
                                setScanHash(tx.burnTxHash || '');
                                setActiveTab('scan');
                                handleStartScan(tx.burnTxHash);
                              }}
                              className="w-full mt-2 h-7 rounded-lg bg-[#10B981]/15 hover:bg-[#10B981]/25 text-[#10B981] font-bold text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 cursor-pointer transition-colors"
                            >
                              <Activity className="h-3 w-3" />
                              Track & Rescue / Claim
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer with Clear options */}
                {history.length > 0 && (
                  <div className={`p-4 border-t ${borderCol} flex flex-col gap-2`}>
                    {showConfirmClear ? (
                      <div className="flex flex-col gap-2 p-2 bg-red-950/20 border border-red-900/30 rounded-xl">
                        <span className="text-[11px] font-semibold text-red-400 text-center">
                          Are you sure you want to clear your history?
                        </span>
                        <div className="flex gap-2">
                          <button
                            onClick={handleClearClick}
                            className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
                          >
                            Yes, Clear
                          </button>
                          <button
                            onClick={() => setShowConfirmClear(false)}
                            className={`flex-1 py-2 rounded-lg border ${borderCol} ${
                              isDark ? 'text-white hover:bg-slate-800' : 'text-slate-900 hover:bg-slate-100'
                            } text-xs font-bold transition-colors cursor-pointer`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={handleClearClick}
                        className={`w-full py-2.5 rounded-xl border border-red-500/20 hover:border-red-500/40 text-red-400 hover:bg-red-950/10 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer`}
                      >
                        <Trash2 className="h-4 w-4" />
                        Clear History
                      </button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Tab 2: CCTP Scan Tracker Content */}
            {activeTab === 'scan' && (
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
                {/* Search Input Box */}
                <div className="flex flex-col gap-2">
                  <label className={`text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    Enter Source Burn Tx Hash
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="0x..."
                      value={scanHash}
                      onChange={(e) => {
                        setScanHash(e.target.value);
                        setScanResult(null);
                        setScanError(null);
                      }}
                      className={`flex-1 h-10 px-3 text-xs font-mono rounded-lg border outline-none transition-all ${
                        isDark
                          ? 'bg-slate-900/60 border-slate-800 text-white focus:border-[#10B981]'
                          : 'bg-white border-slate-200 text-slate-900 focus:border-emerald-600'
                      }`}
                    />
                    <button
                      onClick={() => handleStartScan()}
                      disabled={isScanning || !scanHash.trim().startsWith('0x') || scanHash.trim().length !== 66}
                      className={`h-10 px-4 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                        isScanning || !scanHash.trim().startsWith('0x') || scanHash.trim().length !== 66
                          ? 'bg-slate-800 text-slate-500 border border-slate-800/10 cursor-not-allowed'
                          : 'bg-[#10B981] hover:bg-[#059669] text-[#070B13] font-black'
                      }`}
                    >
                      {isScanning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                      <span>Scan</span>
                    </button>
                  </div>
                </div>

                {/* Loading / Searching Screen */}
                {isScanning && (
                  <div className={`p-8 border ${cardBorder} ${cardBg} rounded-2xl flex flex-col items-center justify-center text-center gap-3`}>
                    <Loader2 className="h-8 w-8 text-[#10B981] animate-spin" />
                    <div className="flex flex-col gap-1">
                      <span className={`text-xs font-bold ${textPrimary}`}>Querying RPC nodes...</span>
                      <span className={`text-[10px] ${textMuted}`}>Scanning all 8 testnet chains in parallel</span>
                    </div>
                  </div>
                )}

                {/* Scan Error Message */}
                {scanError && (
                  <div className="p-4 border border-red-950 bg-red-950/20 text-red-400 rounded-xl text-xs font-semibold flex items-start gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{scanError}</span>
                  </div>
                )}

                {/* Scan Results Screen */}
                {scanResult && (
                  <div className="flex flex-col gap-4">
                    {/* General Summary Card */}
                    <div className={`border ${cardBorder} ${cardBg} rounded-2xl p-4 flex flex-col gap-3.5`}>
                      <div className="flex justify-between items-center text-[10px] uppercase font-black tracking-wider text-slate-400">
                        <span>Scan Summary</span>
                        <span className="text-[#10B981]">Found Receipt</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${textMuted}`}>Source network:</span>
                        <span className={`text-xs font-black ${textPrimary}`}>{scanResult.sourceChainName}</span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className={`text-xs ${textMuted}`}>Destination network:</span>
                        <span className={`text-xs font-black ${textPrimary}`}>
                          {scanResult.destChainName 
                            ? scanResult.destChainName 
                            : scanResult.attestationStatus === 'pending' 
                            ? <span className="text-amber-400 animate-pulse">⏳ Attestation Pending</span>
                            : <span className="text-slate-400 italic">Unknown</span>
                          }
                        </span>
                      </div>
                    </div>

                    {/* Step-by-Step Status Visualizer */}
                    <div className={`border ${cardBorder} ${cardBg} rounded-2xl p-4 flex flex-col gap-4`}>
                      <h4 className={`text-xs font-black uppercase tracking-wider ${textPrimary}`}>
                        CCTP Processing Steps
                      </h4>

                      <div className="flex flex-col gap-4">
                        {/* Step 1: Burn Confirmation */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className="h-6 w-6 rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-500 flex items-center justify-center shadow-sm">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                            <div className={`w-0.5 flex-1 bg-emerald-500/30 my-1`} />
                          </div>
                          <div className="flex-1 pb-2">
                            <h5 className={`text-xs font-black ${textPrimary}`}>1. Source Burn Confirmed</h5>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              USDC successfully burned on {scanResult.sourceChainName} (Block #{scanResult.blockNumber})
                            </p>
                          </div>
                        </div>

                        {/* Step 2: Circle Attestation */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center border ${
                              scanResult.attestationStatus === 'complete'
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500'
                                : 'bg-amber-500/10 border-amber-500/40 text-amber-500 animate-pulse'
                            }`}>
                              {scanResult.attestationStatus === 'complete' ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <Clock className="h-3.5 w-3.5" />
                              )}
                            </div>
                            <div className={`w-0.5 flex-1 ${
                              scanResult.attestationStatus === 'complete' ? 'bg-emerald-500/30' : 'bg-slate-800'
                            } my-1`} />
                          </div>
                          <div className="flex-1 pb-2">
                            <h5 className={`text-xs font-black ${textPrimary}`}>2. Circle Consensus Signatures</h5>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {scanResult.attestationStatus === 'complete'
                                ? 'Circle attestation signature generated successfully'
                                : 'Awaiting consensus signature from Circle Sandbox API (~15s)'}
                            </p>
                          </div>
                        </div>

                        {/* Step 3: Destination Mint Status */}
                        <div className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`h-6 w-6 rounded-full flex items-center justify-center border ${
                              scanResult.mintStatus === 'complete'
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-500'
                                : 'bg-slate-800/50 border-slate-700 text-slate-500'
                            }`}>
                              {scanResult.mintStatus === 'complete' ? (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              ) : (
                                <Clock className="h-3.5 w-3.5" />
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <h5 className={`text-xs font-black ${textPrimary}`}>3. Destination Mint Status</h5>
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              {scanResult.mintStatus === 'complete'
                                ? 'USDC successfully claimed and minted on destination'
                                : 'Ready to be claimed / awaiting execution on destination'}
                            </p>

                            {scanResult.mintStatus === 'pending' && scanResult.attestationStatus === 'complete' && (
                              <div className="mt-3 flex flex-col gap-2">
                                <button
                                  onClick={handleClaimRescue}
                                  disabled={isClaiming}
                                  className="w-full h-8 rounded-lg bg-[#10B981] hover:bg-[#059669] disabled:bg-[#10B981]/15 text-slate-950 disabled:text-slate-500 font-extrabold text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-lg shadow-emerald-950/15"
                                >
                                  {isClaiming ? (
                                    <>
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      <span>Executing Mint Claim...</span>
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle2 className="h-3.5 w-3.5" />
                                      <span>Claim USDC on {scanResult.destChainName}</span>
                                    </>
                                  )}
                                </button>
                                
                                {claimError && (
                                  <div className="p-2.5 rounded-lg border border-red-950 bg-red-950/35 text-[9px] font-semibold text-red-400 flex items-start gap-1.5">
                                    <ShieldAlert className="h-3 w-3 shrink-0 mt-0.5" />
                                    <span>{claimError}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
