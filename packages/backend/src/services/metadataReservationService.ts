/**
 * In-memory store of market questions announced by creators *before* their
 * createMarket transaction lands. The browser-side metadata PATCH (sent after
 * the tx confirms) is fragile — RPC timeouts, closed tabs — so the frontend
 * reserves the question here first, and the chain watcher applies it when it
 * sees the MarketCreated event from that creator.
 *
 * Keyed by lowercased creator address; one pending reservation per creator
 * (a new reservation replaces the previous one). Entries expire after 2h.
 */

export interface MetadataReservation {
  title: string;
  category?: string;
  reservedAt: number;
}

const TTL_MS = 2 * 60 * 60 * 1000;

const reservations = new Map<string, MetadataReservation>();

export function reserveMetadata(creator: string, meta: { title: string; category?: string }): void {
  reservations.set(creator.toLowerCase(), { ...meta, reservedAt: Date.now() });
}

/** Returns and removes the creator's pending reservation, if still fresh. */
export function consumeMetadata(creator: string): MetadataReservation | undefined {
  const key = creator.toLowerCase();
  const entry = reservations.get(key);
  if (!entry) return undefined;
  reservations.delete(key);
  if (Date.now() - entry.reservedAt > TTL_MS) return undefined;
  return entry;
}
