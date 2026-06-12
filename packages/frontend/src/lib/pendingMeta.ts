import type { PublicClient } from 'viem'
import { parseEventLogs } from 'viem'
import { FACTORY_ABI } from '@/config/contracts'
import { api } from '@/lib/api'

// The market question lives off-chain: after createMarket confirms, the
// frontend PATCHes it to the backend. If that PATCH fails (backend down,
// tab closed mid-flow), the market is stuck as "Market #N". To make the
// question survive that, we persist it here *before* the PATCH attempt,
// keyed by tx hash, and replay unsent entries on the next markets-page load.

const STORAGE_KEY = 'omnicurve.pendingMarketMeta'

export interface PendingMeta {
  txHash: string
  title: string
  category?: string
  // Filled in once the MarketCreated log has been parsed, so replays can
  // skip the receipt lookup.
  marketId?: string
}

function load(): PendingMeta[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingMeta[]) : []
  } catch {
    return []
  }
}

function store(entries: PendingMeta[]) {
  try {
    if (entries.length === 0) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // localStorage unavailable (private mode quota etc.) — degrade silently
  }
}

export function savePendingMeta(entry: PendingMeta) {
  store([...load().filter((e) => e.txHash !== entry.txHash), entry])
}

export function updatePendingMeta(txHash: string, patch: Partial<PendingMeta>) {
  store(load().map((e) => (e.txHash === txHash ? { ...e, ...patch } : e)))
}

export function removePendingMeta(txHash: string) {
  store(load().filter((e) => e.txHash !== txHash))
}

/**
 * Retries any market-question saves that never reached the backend.
 * Resolves each entry's market id from its tx receipt if needed, PATCHes the
 * metadata, and drops the entry on success. Returns true if anything was sent.
 */
export async function flushPendingMeta(publicClient: PublicClient | undefined): Promise<boolean> {
  const entries = load()
  if (entries.length === 0) return false

  let sent = false
  for (const entry of entries) {
    try {
      let marketId = entry.marketId
      if (!marketId) {
        if (!publicClient) continue
        const receipt = await publicClient.getTransactionReceipt({
          hash: entry.txHash as `0x${string}`,
        })
        if (receipt.status === 'reverted') {
          removePendingMeta(entry.txHash)
          continue
        }
        const [created] = parseEventLogs({
          abi: FACTORY_ABI,
          logs: receipt.logs,
          eventName: 'MarketCreated',
        }) as unknown as { args: { market_id: bigint } }[]
        if (!created) {
          removePendingMeta(entry.txHash)
          continue
        }
        marketId = created.args.market_id.toString()
        updatePendingMeta(entry.txHash, { marketId })
      }
      await api.updateMarketMetadata(marketId, {
        title: entry.title,
        ...(entry.category ? { category: entry.category } : {}),
      })
      removePendingMeta(entry.txHash)
      sent = true
    } catch (err) {
      // Backend or RPC still unreachable — keep the entry for the next load.
      console.warn('[pendingMeta] replay failed for', entry.txHash, err)
    }
  }
  return sent
}
