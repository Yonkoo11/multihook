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

// One stub OFAC entry for the demo (acts like a known sanctioned wallet).
// We re-derive it as a fresh keypair each session and feed it into the OFAC PDA
// during provisioning so each user's demo includes a sanctioned-destination
// scenario should they wish to test step 2 alternatives.
export const DEMO_RPC = "https://api.devnet.solana.com";

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
