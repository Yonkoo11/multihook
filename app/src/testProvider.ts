/**
 * Dev-only mock Phantom provider, gated by `import.meta.env.DEV` so it cannot
 * ship to a production build. Lets us drive the whole demo end-to-end via
 * puppeteer without a real Phantom extension installed.
 *
 * Activate by appending `?testKey=<base58 secret>` to the dev URL.
 */
import { Keypair, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

function bs58decode(b58: string): Uint8Array {
  // tiny inline base58 decoder — avoid pulling another dep
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const map = new Map<string, number>();
  for (let i = 0; i < ALPHABET.length; i++) map.set(ALPHABET[i], i);
  let bytes: number[] = [0];
  for (const ch of b58) {
    const v = map.get(ch);
    if (v === undefined) throw new Error("bad base58 char");
    let carry = v;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const ch of b58) {
    if (ch === "1") bytes.push(0);
    else break;
  }
  return Uint8Array.from(bytes.reverse());
}

function parseSecret(input: string): Uint8Array {
  // accept JSON array form, comma list, or base58
  const trimmed = input.trim();
  if (trimmed.startsWith("[")) return Uint8Array.from(JSON.parse(trimmed));
  if (trimmed.includes(",")) return Uint8Array.from(trimmed.split(",").map((s) => parseInt(s.trim(), 10)));
  return bs58decode(trimmed);
}

export async function maybeInstallTestProvider(): Promise<boolean> {
  (window as any).__tp = { entered: true, dev: import.meta.env.DEV, search: window.location.search };
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  let raw = params.get("testKey");
  if (!raw && params.get("test") === "1") {
    try {
      const r = await fetch("/.dev-key.json");
      (window as any).__tp.fetchOk = r.ok;
      if (r.ok) raw = await r.text();
    } catch (e) {
      (window as any).__tp.fetchErr = String(e);
    }
  }
  (window as any).__tp.hasRaw = !!raw;
  if (!raw) return false;

  const secret = parseSecret(raw);
  const kp = Keypair.fromSecretKey(secret);

  const listeners: Record<string, Array<(...a: any[]) => void>> = {};

  const provider = {
    isPhantom: true,
    isConnected: false,
    publicKey: kp.publicKey as unknown as { toString(): string },
    connect: async () => {
      provider.isConnected = true;
      return { publicKey: kp.publicKey };
    },
    disconnect: async () => {
      provider.isConnected = false;
      (listeners["disconnect"] ?? []).forEach((cb) => cb());
    },
    signTransaction: async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      if (tx instanceof VersionedTransaction) {
        tx.sign([kp]);
      } else {
        (tx as Transaction).partialSign(kp);
      }
      return tx;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
      for (const tx of txs) {
        if (tx instanceof VersionedTransaction) tx.sign([kp]);
        else (tx as Transaction).partialSign(kp);
      }
      return txs;
    },
    /**
     * Mock signMessage for the dev test provider. Returns a deterministic
     * 64-byte signature derived from sha-256(secret || message) — NOT a real
     * ed25519 signature. The puppeteer harness only verifies the receipt UI
     * renders; cryptographic validity is checked by real Phantom in prod.
     */
    signMessage: async (message: Uint8Array, _encoding?: string) => {
      const combined = new Uint8Array(kp.secretKey.length + message.length);
      combined.set(kp.secretKey, 0);
      combined.set(message, kp.secretKey.length);
      const hash = await crypto.subtle.digest("SHA-256", combined);
      const a = new Uint8Array(hash);
      const sig = new Uint8Array(64);
      sig.set(a, 0);
      sig.set(a, 32);
      return { signature: sig, publicKey: kp.publicKey };
    },
    /**
     * Mock signIn for SIWS. Builds the canonical SIWS message string from
     * the input and signs it the same way mock signMessage does. Real
     * Phantom does proper ed25519 over the canonical message.
     */
    signIn: async (input: any) => {
      const lines = [
        `${input.domain ?? "(no-domain)"} wants you to sign in with your Solana account:`,
        kp.publicKey.toBase58(),
        "",
        input.statement ?? "",
        "",
        `URI: ${input.uri ?? ""}`,
        `Version: ${input.version ?? "1"}`,
        `Chain ID: ${input.chainId ?? ""}`,
        `Nonce: ${input.nonce ?? ""}`,
        `Issued At: ${input.issuedAt ?? new Date().toISOString()}`,
      ];
      if (input.expirationTime) lines.push(`Expiration Time: ${input.expirationTime}`);
      const signedMessage = new TextEncoder().encode(lines.join("\n"));
      const combined = new Uint8Array(kp.secretKey.length + signedMessage.length);
      combined.set(kp.secretKey, 0);
      combined.set(signedMessage, kp.secretKey.length);
      const hash = await crypto.subtle.digest("SHA-256", combined);
      const a = new Uint8Array(hash);
      const signature = new Uint8Array(64);
      signature.set(a, 0);
      signature.set(a, 32);
      return { signature, signedMessage, address: kp.publicKey.toBase58() };
    },
    on: (event: string, cb: (...a: any[]) => void) => {
      (listeners[event] ??= []).push(cb);
    },
    removeListener: (event: string, cb: (...a: any[]) => void) => {
      listeners[event] = (listeners[event] ?? []).filter((x) => x !== cb);
    },
  };

  (window as any).solana = provider;
  (window as any).phantom = { solana: provider };
  console.warn(
    `[testProvider] dev-only mock Phantom installed for ${kp.publicKey.toBase58()}`
  );
  // expose for tests to introspect
  (window as any).__testWalletPubkey = kp.publicKey.toBase58();
  return true;
}

// Suppress unused warning when build strips the function out
export const _ = PublicKey;
