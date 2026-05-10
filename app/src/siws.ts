/**
 * Sign-In With Solana (SIWS) — issuer session helpers.
 *
 * Per the Solana wallet-standard `solana:signIn` feature, a SIWS popup
 * presents a structured login challenge to the user (domain, statement,
 * chain, nonce, expiration) and returns a signed canonical message.
 *
 * For MetaHook this gives us a portable session token: an off-chain
 * artifact that proves "this issuer pubkey was signed in to this dApp at
 * this domain at this time, and consented to the listed statement". An
 * audit tool, regulator filing, or compliance dashboard can store the
 * artifact and replay the verification later — no on-chain footprint.
 *
 * We persist the session in localStorage keyed by issuer pubkey so it
 * survives page reloads. Sessions are clock-bound: 1 hour expiration
 * window matches the SIWS expirationTime claim we set on the input.
 */
import { PublicKey } from "@solana/web3.js";
import type { PhantomWallet, SiwsInput, SiwsOutput } from "./wallet";

const SIWS_DOMAIN = location.hostname || "yonkoo11.github.io";
const SIWS_STATEMENT =
  "Sign in to MetaHook to authorise compliance-state changes on your Token-2022 mint. " +
  "This signature does not move funds. The session expires in 60 minutes.";
const SIWS_VERSION = "1";
// CAIP-2: solana:103 = devnet, solana:101 = mainnet, solana:102 = testnet
const SIWS_CHAIN_ID_DEVNET = "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1";
const SESSION_TTL_MS = 60 * 60 * 1000;

export interface SiwsSession {
  issuer: string;             // base58 pubkey
  signedMessage: string;      // utf-8 canonical SIWS message Phantom built
  signatureBase58: string;    // ed25519 signature (base58)
  domain: string;
  chainId: string;
  issuedAt: string;
  expiresAt: string;
}

const STORAGE_PREFIX = "multihook:siws:";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function bytesToBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) return "";
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits: number[] = [];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      const val = digits[j] * 256 + carry;
      digits[j] = val % 58;
      carry = (val / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = "";
  for (let i = 0; i < zeros; i++) out += "1";
  for (let i = digits.length - 1; i >= 0; i--) out += BASE58_ALPHABET[digits[i]];
  return out;
}

function randomNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Trigger the SIWS popup and persist the resulting session.
 */
export async function issuerSignIn(wallet: PhantomWallet): Promise<SiwsSession> {
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + SESSION_TTL_MS);

  const input: SiwsInput = {
    domain: SIWS_DOMAIN,
    address: wallet.publicKey.toBase58(),
    statement: SIWS_STATEMENT,
    uri: location.origin + location.pathname,
    version: SIWS_VERSION,
    chainId: SIWS_CHAIN_ID_DEVNET,
    nonce: randomNonce(),
    issuedAt: issuedAt.toISOString(),
    expirationTime: expiresAt.toISOString(),
  };

  const result: SiwsOutput = await wallet.signIn(input);

  const session: SiwsSession = {
    issuer: wallet.publicKey.toBase58(),
    signedMessage: new TextDecoder().decode(result.signedMessage),
    signatureBase58: bytesToBase58(result.signature),
    domain: SIWS_DOMAIN,
    chainId: SIWS_CHAIN_ID_DEVNET,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  saveSession(session);
  return session;
}

export function loadSession(pubkey: PublicKey): SiwsSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + pubkey.toBase58());
    if (!raw) return null;
    const sess = JSON.parse(raw) as SiwsSession;
    if (Date.now() > new Date(sess.expiresAt).getTime()) {
      localStorage.removeItem(STORAGE_PREFIX + pubkey.toBase58());
      return null;
    }
    return sess;
  } catch {
    return null;
  }
}

export function saveSession(session: SiwsSession): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + session.issuer, JSON.stringify(session));
  } catch {
    /* localStorage full or disabled — not critical */
  }
}

export function clearSession(pubkey: PublicKey): void {
  localStorage.removeItem(STORAGE_PREFIX + pubkey.toBase58());
}

export function isExpired(session: SiwsSession): boolean {
  return Date.now() > new Date(session.expiresAt).getTime();
}
