/**
 * GoldRush (Covalent) integration for the Live Mint Analytics panel.
 *
 * Two endpoints used:
 *   1. token_holders_v2 — paginated list of all wallets holding the mint;
 *      we surface the top 5 by balance + a total-holder count
 *   2. transactions_v3 — recent transactions involving the mint address;
 *      we surface the most recent 10 with their block-time + signature
 *
 * Why this matters for MetaHook: a compliance-gated mint with a transfer
 * hook is opaque from a vanilla block explorer because:
 *   - holder counts ignore the policy verdicts (they include addresses
 *     that received tokens before allowlist changes)
 *   - tx-history doesn't surface the per-transfer policy verdicts that
 *     live in the program logs
 * GoldRush gives us the foundation (holders + raw tx list); we layer the
 * verdict decoding on top in the UI to produce the "compliance dashboard"
 * view that issuers actually want.
 *
 * CORS: GoldRush serves CORS headers permitting browser calls when the
 * Authorization header carries a Bearer token. Free-tier rate limit is
 * generous enough for a dApp panel that loads once on connect.
 */

const GOLDRUSH_BASE = "https://api.covalenthq.com";

export interface GoldRushHolder {
  address: string;
  balance: string;       // raw u64-as-string
  balance_quote?: number; // USD quote when available
}

export interface GoldRushTx {
  signature: string;
  block_signed_at: string; // ISO timestamp
  fees_paid?: string;
  successful: boolean;
}

export interface GoldRushSnapshot {
  mint: string;
  topHolders: GoldRushHolder[];
  totalHolders: number;
  recentTxs: GoldRushTx[];
  fetchedAt: string;
}

class GoldRushError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Reads VITE_GOLDRUSH_KEY at call time. Throws if unset so callers can
 * render the "configure to activate" placeholder without trying the API.
 */
function requireKey(): string {
  // Literal env access — see programs.ts note on Vite static substitution.
  const k = (import.meta.env.VITE_GOLDRUSH_KEY as string | undefined)?.trim();
  if (!k) throw new GoldRushError(0, "VITE_GOLDRUSH_KEY not set");
  return k;
}

async function get<T>(path: string): Promise<T> {
  const key = requireKey();
  const url = `${GOLDRUSH_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    method: "GET",
  });
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch { /* keep empty */ }
    throw new GoldRushError(res.status, `GoldRush ${path} → ${res.status}: ${body.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

/**
 * Fetch the holders + recent-tx snapshot for a mainnet mint. Returns a
 * normalised view; callers don't see GoldRush's response envelope.
 */
export async function fetchMintSnapshot(mint: string): Promise<GoldRushSnapshot> {
  const chain = "solana-mainnet";

  // Run both requests in parallel — they don't depend on each other.
  const [holdersResp, txsResp] = await Promise.all([
    get<{
      data: {
        items: Array<{
          address: string;
          balance: string;
          quote?: number;
        }>;
        pagination?: { total_count?: number };
      };
    }>(`/v1/${chain}/tokens/address/${mint}/token_holders_v2/?page-size=50`),
    get<{
      data: {
        items: Array<{
          tx_hash?: string;
          signature?: string;
          block_signed_at: string;
          fees_paid?: string;
          successful: boolean;
        }>;
      };
    }>(`/v1/${chain}/address/${mint}/transactions_v3/?page-size=10`),
  ]);

  const holderItems = holdersResp.data?.items ?? [];
  const topHolders: GoldRushHolder[] = holderItems
    .slice(0, 5)
    .map((h) => ({
      address: h.address,
      balance: h.balance,
      balance_quote: h.quote,
    }));

  const txItems = txsResp.data?.items ?? [];
  const recentTxs: GoldRushTx[] = txItems.map((t) => ({
    // GoldRush has used both `signature` and `tx_hash` historically; tolerate both
    signature: t.signature ?? t.tx_hash ?? "",
    block_signed_at: t.block_signed_at,
    fees_paid: t.fees_paid,
    successful: t.successful,
  }));

  return {
    mint,
    topHolders,
    totalHolders: holdersResp.data?.pagination?.total_count ?? holderItems.length,
    recentTxs,
    fetchedAt: new Date().toISOString(),
  };
}
