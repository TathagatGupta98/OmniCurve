/**
 * Turn a raw wallet/viem error into a short, human message.
 *
 * Two problems this solves:
 *  1. A user clicking "reject" in their wallet is NOT an error — it dumps a giant
 *     "User rejected the request. Request Arguments: …" blob. We detect it and show
 *     a calm one-liner (and callers can style it neutrally via `isUserRejection`).
 *  2. Contract reverts surface as opaque viem messages. We map the known revert
 *     strings from the OmniCurve contracts to plain English.
 */

// Revert reason strings emitted by the contracts → friendly copy.
const KNOWN_REVERTS: Record<string, string> = {
  // Factory errors
  CloneFailed: 'Factory failed to deploy a proxy contract (CREATE2 collision or out-of-gas).',
  InitFailed: 'Factory failed to initialize one of the market contracts — check implementation addresses.',
  'Already initialized': 'This contract is already initialized.',
  InsufficientLiquidity: 'Not enough liquidity in the pool to back this trade.',
  VarianceTooLow: 'Sigma is below the market minimum.',
  TradesAlreadyStarted: 'The curve is locked — trading has already started.',
  'Price is zero': 'Price rounds to zero at this strike — pick a strike closer to μ.',
  'Zero tokens': 'Stake is too small to mint any tokens.',
  ZeroAmount: 'Enter an amount greater than zero.',
  Reentrancy: 'Another transaction is still in progress — try again in a moment.',
  Unauthorized: 'Your wallet is not authorized to perform this action.',
  MarketNotResolved: 'This market has not been resolved yet.',
  PositionDidNotWin: 'This position did not win.',
  NoWinningTokens: 'You have no winning tokens to claim here.',
  UsdcTransferFailed: 'USDC transfer failed — check your balance and approval.',
  AmmCallFailed:
    'The pool cannot underwrite this bet — its worst-case payout exceeds the available liquidity. Lower your stake or pick a strike closer to μ.',
  InsufficientBalance: 'Insufficient balance.',
  'Already resolved': 'This market is already resolved.',
  'transfer amount exceeds balance': 'Insufficient USDC balance.',
  'transfer amount exceeds allowance': 'USDC approval is too low — approve again.',
}

/** True when the failure is the user declining the signature in their wallet. */
export function isUserRejection(error: unknown): boolean {
  if (!error) return false
  const e = error as { code?: number; name?: string; shortMessage?: string; message?: string }
  if (e.code === 4001) return true
  if (e.name === 'UserRejectedRequestError') return true
  const msg = `${e.shortMessage ?? ''} ${e.message ?? ''}`
  return /user rejected|user denied|denied transaction signature|rejected the request/i.test(msg)
}

/**
 * Try to decode raw Stylus revert bytes as a UTF-8 reason string.
 *
 * Stylus contracts return raw bytes (e.g. b"CloneFailed") rather than the
 * standard ABI-encoded Error(string) format viem expects. When viem can't
 * decode the revert data it leaves the reason blank. We walk the full viem
 * cause chain to find the hex revert data and decode it ourselves.
 */
function tryDecodeHex(raw: string): string | null {
  try {
    if (!raw || typeof raw !== 'string' || !raw.startsWith('0x')) return null
    const hex = raw.slice(2)
    if (!hex) return null
    const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)))
    const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    if (/^[\x20-\x7E]+$/.test(decoded)) return decoded
    return null
  } catch {
    return null
  }
}

function extractStylusRevertReason(error: unknown): string | null {
  // Walk the full cause chain — viem nests errors several levels deep.
  // The raw revert bytes can appear as .data or .cause.data at any level.
  const visited = new Set<unknown>()
  let node: unknown = error
  while (node && typeof node === 'object' && !visited.has(node)) {
    visited.add(node)
    const n = node as Record<string, unknown>

    // Check .data directly
    if (typeof n.data === 'string') {
      const decoded = tryDecodeHex(n.data)
      if (decoded) return decoded
    }

    // viem sometimes puts it under .cause.data (ContractFunctionRevertedError)
    if (n.cause && typeof n.cause === 'object') {
      const c = n.cause as Record<string, unknown>
      if (typeof c.data === 'string') {
        const decoded = tryDecodeHex(c.data)
        if (decoded) return decoded
      }
    }

    node = (n as { cause?: unknown }).cause
  }
  return null
}

/** Concise, user-facing message for any wallet/contract error. */
export function formatTxError(error: unknown): string {
  if (!error) return 'Transaction failed.'
  if (isUserRejection(error)) return 'Transaction rejected in your wallet.'

  const e = error as { shortMessage?: string; message?: string; details?: string }
  const haystack = `${e.shortMessage ?? ''} ${e.details ?? ''} ${e.message ?? ''}`

  // Transient infrastructure failures — not contract reverts. The public
  // Arbitrum Sepolia RPC rate-limits bursts, which used to surface as opaque
  // "reverts" at random points in multi-transaction flows.
  if (/429|rate limit|over rate|too many request/i.test(haystack)) {
    return 'The RPC node is rate-limiting requests — nothing failed on-chain. Wait a few seconds and try again.'
  }
  if (/HTTP request failed|fetch failed|timeout|network error|ECONNRESET/i.test(haystack)) {
    return 'Network hiccup talking to the RPC node — your funds are safe. Try again.'
  }
  if (/max fee per gas less than block base fee|fee cap less than block base fee|underpriced/i.test(haystack)) {
    return 'Gas fee estimate went stale (base fee rose). Try again — a fresh estimate will be used.'
  }

  for (const [key, friendly] of Object.entries(KNOWN_REVERTS)) {
    if (haystack.includes(key)) return friendly
  }

  // Stylus contracts emit raw UTF-8 bytes as revert data; try to surface them.
  const stylusReason = extractStylusRevertReason(error)
  if (stylusReason) {
    return KNOWN_REVERTS[stylusReason] ?? `Contract error: ${stylusReason}`
  }

  // Prefer viem's shortMessage; otherwise the first line of the raw message,
  // trimmed so we never render the multi-line "Request Arguments" dump.
  const concise = (e.shortMessage ?? e.message ?? 'Transaction failed.').split('\n')[0].trim()
  return concise.length > 160 ? `${concise.slice(0, 157)}…` : concise
}
