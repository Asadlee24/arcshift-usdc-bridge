// lib/registry/pauseControls.ts
// Emergency pause controls per-route and global kill-switch.
// Pausing prevents NEW burns while leaving status lookup, attestation polling, and manual claims fully functional.

export interface RoutePauseState {
  isPaused: boolean;
  reason?: string;
  allowRecovery: boolean;
}

/**
 * Checks if bridging for a given route is currently paused via environment configuration or dynamic flag.
 */
export function isRoutePaused(fromChainId: number, toChainId: number): RoutePauseState {
  if (typeof process === 'undefined' || !process.env) {
    return { isPaused: false, allowRecovery: true };
  }

  // Global pause switch
  if (process.env.NEXT_PUBLIC_PAUSE_ALL_TRANSFERS === 'true') {
    return {
      isPaused: true,
      reason: 'Cross-chain bridging is temporarily paused for maintenance. Existing transfers can still be recovered.',
      allowRecovery: true,
    };
  }

  // Specific route pause flags (e.g. NEXT_PUBLIC_PAUSE_ROUTE_5042_8453)
  const routeKey = `NEXT_PUBLIC_PAUSE_ROUTE_${fromChainId}_${toChainId}`;
  const reverseRouteKey = `NEXT_PUBLIC_PAUSE_ROUTE_${toChainId}_${fromChainId}`;

  if (process.env[routeKey] === 'true' || process.env[reverseRouteKey] === 'true') {
    return {
      isPaused: true,
      reason: `Transfers between chain ${fromChainId} and chain ${toChainId} are temporarily paused.`,
      allowRecovery: true,
    };
  }

  return { isPaused: false, allowRecovery: true };
}
