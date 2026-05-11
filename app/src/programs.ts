import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";

import metahookIdl from "./idl_metahook.json";
import allowlistIdl from "./idl_policy_allowlist.json";
import sanctionsIdl from "./idl_policy_sanctions_ofac.json";

import type { Metahook } from "./type_metahook";
import type { PolicyAllowlist } from "./type_policy_allowlist";
import type { PolicySanctionsOfac } from "./type_policy_sanctions_ofac";
import type { PhantomWallet } from "./wallet";

export const METAHOOK_ID = new PublicKey(
  "4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d"
);
export const POLICY_ALLOWLIST_ID = new PublicKey(
  "GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn"
);
export const POLICY_SANCTIONS_ID = new PublicKey(
  "5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt"
);

// RPC endpoint resolution. Multi-provider priority for resilience:
//   1. RPC Fast  (if VITE_RPCFAST_DEVNET is set)    — primary
//   2. QuickNode (if VITE_QUICKNODE_DEVNET is set)  — secondary
//   3. Helius    (if VITE_HELIUS_KEY is set)        — fallback
//   4. Public devnet                                — last resort
//
// All keys plumbed via Vite env vars at build time so they can be
// domain-restricted in their respective dashboards rather than embedded
// as long-lived secrets.
//
// Why multi-provider: the original public-devnet RPC was rate-limiting tx
// simulation hard enough that Phantom's Confirm button couldn't enable in
// our puppeteer tests. Single-provider failure mode is the worst possible
// for a live demo — judges hitting a 429 see a frozen UI. Three paid-tier
// providers + a public-devnet floor reduces that to a non-event.
//
// Priority order matches sponsor commitment: RPC Fast and QuickNode are
// each a Frontier sidetrack ($10K + $20K respectively) — using them first
// honours the integration. Helius keeps the depth-3 sponsor slot it
// already had via the audit-feed integration.
//
// Vite static substitution requires the literal `import.meta.env.VITE_*`
// form (no optional chain).
const RPCFAST_URL = (import.meta.env.VITE_RPCFAST_DEVNET as string | undefined) ?? "";
const QUICKNODE_URL = (import.meta.env.VITE_QUICKNODE_DEVNET as string | undefined) ?? "";
const HELIUS_KEY = (import.meta.env.VITE_HELIUS_KEY as string | undefined) ?? "";

export const DEMO_RPC: string = RPCFAST_URL
  ? RPCFAST_URL
  : QUICKNODE_URL
  ? QUICKNODE_URL
  : HELIUS_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_KEY}`
  : "https://api.devnet.solana.com";

export const RPC_PROVIDER:
  | "rpcfast"
  | "quicknode"
  | "helius"
  | "public" = RPCFAST_URL
  ? "rpcfast"
  : QUICKNODE_URL
  ? "quicknode"
  : HELIUS_KEY
  ? "helius"
  : "public";

export const RPC_FALLBACKS: string[] = [
  RPCFAST_URL,
  QUICKNODE_URL,
  HELIUS_KEY ? `https://devnet.helius-rpc.com/?api-key=${HELIUS_KEY}` : "",
  "https://api.devnet.solana.com",
].filter((u) => u.length > 0);

export interface Programs {
  provider: AnchorProvider;
  metahook: Program<Metahook>;
  allowlist: Program<PolicyAllowlist>;
  sanctions: Program<PolicySanctionsOfac>;
}

export function buildPrograms(connection: Connection, wallet: PhantomWallet): Programs {
  const provider = new AnchorProvider(connection, wallet as any, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  const metahook = new Program<Metahook>(metahookIdl as any, provider);
  const allowlist = new Program<PolicyAllowlist>(allowlistIdl as any, provider);
  const sanctions = new Program<PolicySanctionsOfac>(sanctionsIdl as any, provider);
  return { provider, metahook, allowlist, sanctions };
}

export function reentrancyGuardPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("reentrancy-guard")],
    METAHOOK_ID
  );
  return pda;
}

export function allowlistPda(authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("allowlist"), authority.toBuffer()],
    POLICY_ALLOWLIST_ID
  );
  return pda;
}

export function ofacPda(authority: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("ofac-list"), authority.toBuffer()],
    POLICY_SANCTIONS_ID
  );
  return pda;
}

export function extraMetaListPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("extra-account-metas"), mint.toBuffer()],
    METAHOOK_ID
  );
  return pda;
}

/**
 * Per-mint MetaHookConfig PDA. Stores the issuer's authority + the active
 * policy set + aggregation mode. Lifted from the V1 hardcoded constants in
 * an earlier release — now any (program_id, policy_pda) pair the issuer
 * configures here is composable into the meta-hook without touching its code.
 */
export function metahookConfigPda(mint: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metahook-config"), mint.toBuffer()],
    METAHOOK_ID
  );
  return pda;
}

/**
 * Aggregation modes for V1. AND short-circuits on first policy failure.
 * V2 will add OR + weighted.
 */
export enum Aggregation {
  And = 0,
}
