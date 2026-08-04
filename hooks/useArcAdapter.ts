// hooks/useArcAdapter.ts
// SSR-safe wallet provider adapter hook to create a Viem adapter from window.ethereum

import { useState, useCallback } from 'react';
import { createViemAdapterFromProvider } from '@circle-fin/adapter-viem-v2';

export function useArcAdapter() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getAdapter = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (typeof window === 'undefined') {
        throw new Error('Cannot access browser environment on server side.');
      }

      // Check if wallet provider is injected (MetaMask, OKX, Rabby, Coinbase, etc. all inject this)
      if (!window.ethereum) {
        throw new Error('EVM Wallet provider not detected. Please connect MetaMask, OKX, or Rabby.');
      }

      // Instantiate the official Circle CCTP adapter for Viem
      const adapter = await createViemAdapterFromProvider({
        provider: window.ethereum as any, // Cast window.ethereum provider to Viem's provider shape
      });

      return adapter;
    } catch (err: any) {
      const parsedError = err instanceof Error ? err : new Error(err?.message || 'Failed to create wallet adapter');
      setError(parsedError);
      console.error('Error instantiating Circle Adapter:', parsedError);
      throw parsedError;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    getAdapter,
    isLoading,
    error,
  };
}
