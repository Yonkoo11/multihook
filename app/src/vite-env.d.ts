/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional Helius devnet API key. When set, the dApp routes RPC calls
   * through Helius for higher rate limits + better simulation latency.
   * Falls back to public devnet RPC when unset so the project still
   * builds without secrets.
   */
  readonly VITE_HELIUS_KEY?: string;

  /**
   * Optional QuickNode Solana devnet endpoint URL (full URL — QuickNode
   * endpoints have unique per-account hashes, not just keys). When set,
   * QuickNode takes priority over Helius for resilience: the dApp uses
   * QuickNode primary, Helius fallback, public devnet last-resort.
   * Single-provider failure no longer takes the demo down.
   */
  readonly VITE_QUICKNODE_DEVNET?: string;

  /**
   * Optional mainnet Token-2022 mint address protected by MetaHook. When
   * set, the dApp renders the "Live Mint Analytics" section that pulls
   * data from GoldRush + Birdeye + Dune for the production deployment.
   * Unset → analytics section shows a placeholder explaining how it
   * activates.
   */
  readonly VITE_MAINNET_MINT?: string;

  /**
   * GoldRush (Covalent) API key for the mainnet token-holders + tx-history
   * panel. Domain-restricted to yonkoo11.github.io in the Covalent
   * dashboard. Unset → GoldRush panel shows "configure to activate".
   */
  readonly VITE_GOLDRUSH_KEY?: string;

  /**
   * Birdeye API key for the mainnet mint analytics panel. Domain-restricted
   * to yonkoo11.github.io in the Birdeye dashboard. Unset → Birdeye panel
   * shows "configure to activate".
   */
  readonly VITE_BIRDEYE_KEY?: string;

  /**
   * Public Dune dashboard URL for the MetaHookAuditEvent materialized view.
   * Embedded as an iframe at the bottom of the analytics section. Unset →
   * iframe placeholder shows the SQL source path the dashboard is built
   * from.
   */
  readonly VITE_DUNE_DASHBOARD_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
