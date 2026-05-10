/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional Helius devnet API key. When set, the dApp routes RPC calls
   * through Helius for higher rate limits + better simulation latency.
   * Falls back to public devnet RPC when unset so the project still
   * builds without secrets.
   */
  readonly VITE_HELIUS_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
