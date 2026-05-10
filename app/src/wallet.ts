import {
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

/**
 * Minimal Anchor-compatible wallet adapter wrapping window.solana (Phantom).
 * Anchor's `Wallet` interface needs `publicKey`, `signTransaction`, and
 * `signAllTransactions`. Phantom exposes all three.
 */
export class PhantomWallet {
  publicKey!: PublicKey;
  private provider: any;

  constructor(provider: any) {
    this.provider = provider;
    if (provider.publicKey) this.publicKey = new PublicKey(provider.publicKey.toString());
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    return await this.provider.signTransaction(tx);
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    return await this.provider.signAllTransactions(txs);
  }

  /**
   * Phantom signMessage. Returns the raw 64-byte ed25519 signature bytes.
   * The wallet popup shows the message to the user verbatim, so we encode it
   * as utf8 plain text so the issuer can read what they're attesting to.
   */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (!this.provider.signMessage) {
      throw new Error("Wallet does not support signMessage");
    }
    const result = await this.provider.signMessage(message, "utf8");
    if (result?.signature instanceof Uint8Array) return result.signature;
    if (result instanceof Uint8Array) return result;
    if (Array.isArray(result?.signature)) return Uint8Array.from(result.signature);
    throw new Error("Unexpected signMessage response shape");
  }

  // anchor's Wallet interface also requires `payer`, but it's only used by
  // server-side flows. Browser flows never call it; expose a throwing stub.
  get payer(): never {
    throw new Error("PhantomWallet.payer is not available in the browser");
  }
}

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey: { toString(): string } | null;
  isConnected: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: <T>(tx: T) => Promise<T>;
  signAllTransactions: <T>(txs: T[]) => Promise<T[]>;
  signMessage?: (
    message: Uint8Array,
    encoding?: "utf8" | "hex"
  ) => Promise<{ signature: Uint8Array; publicKey?: PublicKey } | Uint8Array>;
  on: (event: string, cb: (...args: any[]) => void) => void;
  removeListener?: (event: string, cb: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const p = window.phantom?.solana ?? window.solana;
  if (p?.isPhantom) return p;
  return null;
}

/**
 * Best-effort SOL top-up. Uses the public devnet faucet via airdrop. Devnet
 * caps to 2 SOL per request; we ask for what we need.
 */
export async function ensureMinBalance(
  conn: Connection,
  pubkey: PublicKey,
  minSol: number,
  log: (msg: string, kind?: string) => void
): Promise<void> {
  const lamports = await conn.getBalance(pubkey, "confirmed");
  const sol = lamports / 1e9;
  if (sol >= minSol) {
    log(`balance ok — ${sol.toFixed(4)} SOL`, "dim");
    return;
  }
  log(`balance low (${sol.toFixed(4)} SOL); requesting devnet airdrop…`, "warn");
  try {
    const sig = await conn.requestAirdrop(pubkey, 2 * 1e9);
    const latest = await conn.getLatestBlockhash("confirmed");
    await conn.confirmTransaction({ signature: sig, ...latest }, "confirmed");
    const after = (await conn.getBalance(pubkey, "confirmed")) / 1e9;
    log(`airdrop confirmed; balance now ${after.toFixed(4)} SOL`, "ok");
  } catch (e: any) {
    log(
      `airdrop failed (${e.message ?? e}). Use https://faucet.solana.com if needed and retry.`,
      "bad"
    );
  }
}
