import { Keypair, PublicKey } from "@solana/web3.js";

/**
 * Per-wallet demo state, persisted to localStorage so the user can refresh
 * the page mid-flow without losing their mint or destination keypair.
 */
export interface DemoState {
  mintSecret: number[];        // Token-2022 mint keypair (we generated it)
  destSecret: number[];        // ephemeral destination wallet keypair
  sanctionedDestSecret: number[]; // optional alt scenario; not exposed in v1 UI
  provisioned: boolean;        // mint + ATAs + meta list created
  allowlisted: boolean;        // dest added to allowlist
  succeeded: boolean;          // final demo transfer succeeded
}

const STORAGE_PREFIX = "multihook:demo:";

export function loadState(walletPk: PublicKey): DemoState | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + walletPk.toBase58());
    if (!raw) return null;
    return JSON.parse(raw) as DemoState;
  } catch {
    return null;
  }
}

export function saveState(walletPk: PublicKey, s: DemoState) {
  localStorage.setItem(STORAGE_PREFIX + walletPk.toBase58(), JSON.stringify(s));
}

export function clearState(walletPk: PublicKey) {
  localStorage.removeItem(STORAGE_PREFIX + walletPk.toBase58());
}

export function makeFreshState(): DemoState {
  return {
    mintSecret: Array.from(Keypair.generate().secretKey),
    destSecret: Array.from(Keypair.generate().secretKey),
    sanctionedDestSecret: Array.from(Keypair.generate().secretKey),
    provisioned: false,
    allowlisted: false,
    succeeded: false,
  };
}

export function mintKp(s: DemoState): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(s.mintSecret));
}
export function destKp(s: DemoState): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(s.destSecret));
}
export function sanctionedKp(s: DemoState): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(s.sanctionedDestSecret));
}
