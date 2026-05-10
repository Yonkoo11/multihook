/**
 * Birdeye integration for the Live Mint Analytics panel.
 *
 * Two endpoints:
 *   1. /defi/token_overview — single shot of price, market cap, holder count,
 *      24h volume + change. The "vital signs" card row.
 *   2. /defi/history_price — 24h hourly closes for the sparkline below the
 *      vital-signs row.
 *
 * Why this matters for MetaHook: a Token-2022 mint with a custom transfer
 * hook is technically novel and judges + issuers want signal that it's
 * indexable by mainstream tooling. Birdeye is the dominant Solana token-data
 * surface; if our hook-protected mint shows up in their feeds with normal
 * price/volume/holder metrics, that's the strongest possible "this composes
 * with the existing Solana ecosystem" proof.
 *
 * CORS: Birdeye's documented client-side flow uses the `X-API-KEY` header.
 * Their free tier has a per-second rate limit; we cache the snapshot on the
 * caller's side rather than re-fetching on every tab focus.
 */

const BIRDEYE_BASE = "https://public-api.birdeye.so";

export interface BirdeyeOverview {
  mint: string;
  symbol?: string;
  name?: string;
  decimals: number;
  priceUsd: number | null;
  priceChange24h: number | null;
  marketCap: number | null;
  liquidity: number | null;
  holders: number | null;
  volume24h: number | null;
  fetchedAt: string;
}

export interface BirdeyePricePoint {
  unixTime: number;
  value: number;
}

export interface BirdeyeSnapshot {
  overview: BirdeyeOverview;
  priceHistory24h: BirdeyePricePoint[];
}

class BirdeyeError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function requireKey(): string {
  // Literal env access — see programs.ts note on Vite static substitution.
  const k = (import.meta.env.VITE_BIRDEYE_KEY as string | undefined)?.trim();
  if (!k) throw new BirdeyeError(0, "VITE_BIRDEYE_KEY not set");
  return k;
}

async function get<T>(path: string): Promise<T> {
  const key = requireKey();
  const url = `${BIRDEYE_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      "X-API-KEY": key,
      Accept: "application/json",
      "x-chain": "solana",
    },
    method: "GET",
  });
  if (!res.ok) {
    let body = "";
    try { body = await res.text(); } catch { /* keep empty */ }
    throw new BirdeyeError(res.status, `Birdeye ${path} → ${res.status}: ${body.slice(0, 240)}`);
  }
  return (await res.json()) as T;
}

/**
 * Fetch the overview + 24h price history for a mainnet mint. Birdeye returns
 * `success: false` with HTTP 200 for unsupported/unrecognised mints; we
 * surface that as `priceUsd: null` so the UI can show "no market data yet"
 * rather than crashing.
 */
export async function fetchMintAnalytics(mint: string): Promise<BirdeyeSnapshot> {
  const now = Math.floor(Date.now() / 1000);
  const dayAgo = now - 24 * 60 * 60;

  const [overviewResp, historyResp] = await Promise.all([
    get<{
      success?: boolean;
      data?: {
        symbol?: string;
        name?: string;
        decimals?: number;
        price?: number;
        priceChange24hPercent?: number;
        mc?: number;
        liquidity?: number;
        holder?: number;
        v24hUSD?: number;
      };
    }>(`/defi/token_overview?address=${mint}`),
    get<{
      success?: boolean;
      data?: { items?: BirdeyePricePoint[] };
    }>(`/defi/history_price?address=${mint}&address_type=token&type=1H&time_from=${dayAgo}&time_to=${now}`),
  ]);

  const od = overviewResp.data ?? {};
  const overview: BirdeyeOverview = {
    mint,
    symbol: od.symbol,
    name: od.name,
    decimals: od.decimals ?? 0,
    priceUsd: od.price ?? null,
    priceChange24h: od.priceChange24hPercent ?? null,
    marketCap: od.mc ?? null,
    liquidity: od.liquidity ?? null,
    holders: od.holder ?? null,
    volume24h: od.v24hUSD ?? null,
    fetchedAt: new Date().toISOString(),
  };

  return {
    overview,
    priceHistory24h: historyResp.data?.items ?? [],
  };
}
