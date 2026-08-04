import { useState, useEffect, useCallback } from 'react';
import { useReadContract, useAccount } from 'wagmi';
import { getChainById } from '../constants/chains';
import { formatUnits } from 'viem';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey } from '@solana/web3.js';

// Standard ERC-20 Minimal ABI containing balanceOf
const ERC20_ABI = [
    {
        name: 'balanceOf',
        type: 'function',
        stateMutability: 'view',
        inputs: [{ name: 'account', type: 'address' }],
        outputs: [{ name: 'balance', type: 'uint256' }],
    },
] as const;

// USDC uses 6 decimals on every chain this app supports (including the Arc ERC-20 at
// 0x3600...0000). Note this is distinct from Arc's *native gas* token, which is 18 decimals —
// see lib/arcChain.ts. Do not conflate the two.
const USDC_DECIMALS = 6;

const SOLANA_TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const SOLANA_ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';

const BALANCE_POLL_INTERVAL_MS = 15000;
const REFRESH_EVENT = 'bridge-success-refresh';

const BACKUP_RPCS: Record<number, string[]> = {
    5042002: ['https://rpc.testnet.arc.network'],
    11155111: [
        'https://ethereum-sepolia-rpc.publicnode.com',
        'https://eth-sepolia.public.blastapi.io',
        'https://rpc.sepolia.org'
    ],
    84532: [
        'https://base-sepolia-rpc.publicnode.com',
        'https://sepolia.base.org'
    ],
    421614: [
        'https://arbitrum-sepolia-rpc.publicnode.com',
        'https://sepolia-rollup.arbitrum.io/rpc'
    ],
    43113: [
        'https://api.avax-test.network/ext/bc/C/rpc',
        'https://avalanche-fuji-c-chain-rpc.publicnode.com'
    ],
    11155420: [
        'https://sepolia.optimism.io',
        'https://optimism-sepolia-rpc.publicnode.com'
    ],
    59141: [
        'https://rpc.sepolia.linea.build',
        'https://linea-sepolia-rpc.publicnode.com'
    ],
    80002: [
        'https://rpc-amoy.polygon.technology',
        'https://polygon-amoy-bor-rpc.publicnode.com'
    ]
};

/**
 * Derives the Associated Token Account address for a given owner/mint pair.
 */
function deriveSolanaATA(owner: PublicKey, mint: PublicKey): PublicKey {
    const [ata] = PublicKey.findProgramAddressSync(
        [
            owner.toBuffer(),
            new PublicKey(SOLANA_TOKEN_PROGRAM_ID).toBuffer(),
            mint.toBuffer(),
        ],
        new PublicKey(SOLANA_ASSOCIATED_TOKEN_PROGRAM_ID)
    );
    return ata;
}

async function fetchUSDCBalanceDirectly(chainId: number, userAddress: string, usdcAddress: string): Promise<number | null> {
    const chainMeta = getChainById(chainId);
    const rpcs = [
        ...(chainMeta?.rpcUrl ? [chainMeta.rpcUrl] : []),
        ...(BACKUP_RPCS[chainId] || [])
    ];
    // Method selector for balanceOf(address) is 0x70a08231
    const cleanAddress = userAddress.toLowerCase().replace('0x', '');
    const data = `0x70a08231000000000000000000000000${cleanAddress}`;

    for (const rpc of rpcs) {
        try {
            const response = await fetch(rpc, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_call',
                    params: [{ to: usdcAddress, data }, 'latest'],
                    id: 1
                })
            });

            if (response.ok) {
                const json = await response.json();
                if (json?.result && json.result !== '0x') {
                    const rawBalance = BigInt(json.result);
                    return Number(formatUnits(rawBalance, USDC_DECIMALS));
                }
            }
        } catch (e) {
            console.warn(`Direct balance fetch failed for chain ${chainId} via ${rpc}:`, e);
        }
    }
    return null;
}

export function useUSDCBalance(chainId: number) {
    const { address, isConnected } = useAccount();
    const { publicKey } = useWallet();
    const chainMeta = getChainById(chainId);
    const [manualBalance, setManualBalance] = useState<number | null>(null);
    const [isManualLoading, setIsManualLoading] = useState(false);

    // Solana is identified by its metadata flag only. The previous `|| chainId === 5` fallback
    // conflated Solana's CCTP *domain* (5) with an EVM chain ID (5 is Ethereum Goerli).
    const isSolana = Boolean(chainMeta?.isSolana);

    const usdcAddress = chainMeta?.usdcAddress;
    const rpcUrl = chainMeta?.rpcUrl;

    // Reset cached balance whenever the identity of what we're reading changes.
    useEffect(() => {
        setManualBalance(null);
    }, [chainId, address, publicKey]);

    // Wagmi Read Contract hook for balanceOf
    const { data: balance, isLoading, refetch: refetchEVM } = useReadContract({
        address: usdcAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: address ? [address] : undefined,
        chainId: chainMeta?.isNativeArc ? undefined : chainId,
        query: {
            enabled: !isSolana && isConnected && !!address && !!usdcAddress,
            staleTime: 10000,
        }
    });

    const fetchSolanaBalance = useCallback(async (): Promise<number | null> => {
        if (!publicKey || !usdcAddress) return null;
        try {
            const connection = new Connection(rpcUrl || 'https://api.devnet.solana.com', 'confirmed');
            const ata = deriveSolanaATA(publicKey, new PublicKey(usdcAddress));
            const response = await connection.getParsedAccountInfo(ata);
            if (!response.value) return 0;
            const data = response.value.data as any;
            return data?.parsed?.info?.tokenAmount?.uiAmount ?? 0;
        } catch (e) {
            console.warn('Failed to fetch Solana USDC balance:', e);
            return null;
        }
    }, [publicKey, usdcAddress, rpcUrl]);

    /**
     * Stable refetch handle. Memoised so that consumers can safely list it in effect
     * dependency arrays — an unmemoised version caused an unbounded render/refetch loop
     * in BridgeCard, hammering public RPC endpoints while the page sat idle.
     */
    const refetch = useCallback(async () => {
        if (isSolana) {
            const next = await fetchSolanaBalance();
            if (next !== null) setManualBalance(next);
            return;
        }
        refetchEVM();
        if (address && usdcAddress) {
            const direct = await fetchUSDCBalanceDirectly(chainId, address, usdcAddress);
            if (direct !== null) setManualBalance(direct);
        }
    }, [isSolana, fetchSolanaBalance, refetchEVM, address, chainId, usdcAddress]);

    // Refresh when a bridge completes. The handler is hoisted to a named reference so that
    // removeEventListener can actually match it — passing a fresh arrow function to both
    // add and remove (as the previous implementation did) removed nothing and leaked a
    // listener on every dependency change.
    useEffect(() => {
        const handleRefresh = () => { void refetch(); };
        window.addEventListener(REFRESH_EVENT, handleRefresh);
        return () => window.removeEventListener(REFRESH_EVENT, handleRefresh);
    }, [refetch]);

    // Background polling. Direct RPC reads act as the primary fetcher for Solana and as a
    // fallback for EVM chains where the wagmi transport may be unavailable.
    useEffect(() => {
        const canRead = isSolana
            ? Boolean(publicKey && usdcAddress)
            : Boolean(isConnected && address && usdcAddress);

        if (!canRead) {
            setManualBalance(null);
            return;
        }

        let isMounted = true;

        const load = async () => {
            setIsManualLoading(true);
            try {
                const next = isSolana
                    ? await fetchSolanaBalance()
                    : await fetchUSDCBalanceDirectly(chainId, address!, usdcAddress!);
                if (isMounted && next !== null) {
                    setManualBalance(next);
                }
            } finally {
                if (isMounted) setIsManualLoading(false);
            }
        };

        void load();
        const interval = setInterval(() => { void load(); }, BALANCE_POLL_INTERVAL_MS);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [isSolana, publicKey, isConnected, address, chainId, usdcAddress, fetchSolanaBalance]);

    // Determine final balance to display
    let finalBalance = 0;
    if (!isSolana && balance !== undefined) {
        finalBalance = parseFloat(formatUnits(balance, USDC_DECIMALS));
    } else if (manualBalance !== null) {
        finalBalance = manualBalance;
    }

    // Apply local swap credit offset if on Arc Testnet (5042002).
    // NOTE: this offset is written by the Swap tab, which credits the "received" token only in
    // localStorage rather than on-chain. See Issue 14 in AUDIT_REPORT.md — this display path
    // will show a balance that does not exist on-chain.
    if (chainId === 5042002 && address && typeof window !== 'undefined') {
        const localOffset = parseFloat(localStorage.getItem(`arc_credit_USDC_${address}`) || '0');
        finalBalance = Math.max(0, finalBalance + localOffset);
    }

    const isCurrentlyLoading = isSolana
        ? (manualBalance === null && isManualLoading)
        : (isLoading && manualBalance === null && isManualLoading);

    const walletConnected = isSolana ? !!publicKey : isConnected;

    // Return formatted display balance
    const displayBalance = walletConnected
        ? (isCurrentlyLoading ? '...' : finalBalance.toFixed(2))
        : '0.00';

    return {
        rawBalance: !isSolana && balance !== undefined
            ? balance
            : (manualBalance !== null ? BigInt(Math.floor(manualBalance * 10 ** USDC_DECIMALS)) : undefined),
        formattedBalance: displayBalance,
        balanceNum: walletConnected ? finalBalance : 0,
        isLoading: walletConnected ? isCurrentlyLoading : false,
        refetch,
    };
}
