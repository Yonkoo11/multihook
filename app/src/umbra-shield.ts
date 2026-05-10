/**
 * Umbra integration — shield a Token-2022 balance from a public ATA into
 * an encrypted Umbra account.
 *
 * The composition story (this is what makes it depth-3+):
 *   - MetaHook controls WHO can receive the token (allowlist, sanctions,
 *     SNS-domain ownership, etc.)
 *   - Umbra controls who can SEE the balance (Arcium MPC-encrypted
 *     account; balance hidden from public block explorer view)
 *   - The two compose orthogonally. The shield call is itself a
 *     Token-2022 transfer (source ATA → Umbra's program-controlled
 *     destination), which means it triggers our metahook + the policy
 *     verdicts. Issuers add Umbra's program PDA to their allowlist;
 *     after that, every shield-out is automatically compliance-vetted
 *     even though the balance becomes private.
 *
 * Honest caveats:
 *   - Umbra's SDK uses the wallet-standard registry (`getWallets()`).
 *     Phantom auto-registers as a wallet-standard wallet, so we can
 *     hand it over without re-prompting connect — but the discovery
 *     happens via name match; if Phantom changes its registered name
 *     we'll need to update this file.
 *   - The shield call WILL revert if the Umbra destination PDA isn't
 *     on the user's allowlist. The audit feed below the demo shows
 *     this clearly as `policy.allowlist.fail`. Adding the Umbra PDA
 *     to the allowlist is the natural next step in V1.1.
 */
import { getWallets } from "@wallet-standard/app";
import { StandardConnect } from "@wallet-standard/features";
import {
  createSignerFromWalletAccount,
  getPublicBalanceToEncryptedBalanceDirectDepositorFunction,
  getUmbraClient,
} from "@umbra-privacy/sdk";

const UMBRA_INDEXER_DEVNET = "https://utxo-indexer-devnet.api.umbraprivacy.com";
// Umbra Solana devnet program (per docs.umbraprivacy.com).
export const UMBRA_DEVNET_PROGRAM_ID =
  "DSuKkyqGVGgo4QtPABfxKJKygUDACbUhirnuv63mEpAJ";

export interface ShieldRequest {
  mintBase58: string;
  /**
   * Destination of the encrypted balance. For self-deposit pass the same
   * pubkey as the connected wallet. Umbra derives the encrypted token
   * account internally from this address + mint.
   */
  recipientBase58: string;
  amountTokens: bigint;
  rpcUrl: string;
}

export interface ShieldResult {
  signature: string;
  shieldedAmount: bigint;
}

/**
 * Locate the Phantom wallet via the wallet-standard registry, build an
 * Umbra client around its signer, and shield `amountTokens` of
 * `mintBase58` from the user's source ATA. Throws on any failure; UI
 * handles the message + audit-feed correlation.
 */
export async function shieldViaUmbra(req: ShieldRequest): Promise<ShieldResult> {
  const wallets = getWallets().get();
  if (wallets.length === 0) {
    throw new Error(
      "No wallet-standard wallets discovered. Refresh after Phantom finishes loading."
    );
  }

  // Prefer Phantom by name; fall back to any wallet that exposes the
  // standard:connect feature so dev test-providers also work.
  const phantom =
    wallets.find((w) => w.name.toLowerCase().includes("phantom")) ??
    wallets.find((w) => StandardConnect in w.features);
  if (!phantom) {
    throw new Error("Phantom not found in wallet-standard registry");
  }

  const connectFeature = phantom.features[StandardConnect] as {
    connect: () => Promise<{ accounts: ReadonlyArray<unknown> }>;
  };
  const { accounts } = await connectFeature.connect();
  if (accounts.length === 0) {
    throw new Error("Phantom returned no accounts after standard:connect");
  }
  const account = accounts[0] as Parameters<typeof createSignerFromWalletAccount>[1];

  const signer = createSignerFromWalletAccount(phantom as any, account);

  // Derive the WSS subscription URL from the HTTPS RPC URL. Umbra falls
  // back to polling if the WSS endpoint refuses; we still provide it for
  // efficiency on networks that support it.
  const wssUrl = req.rpcUrl
    .replace(/^https:/, "wss:")
    .replace(/^http:/, "ws:");

  const client = await getUmbraClient({
    signer,
    network: "devnet",
    rpcUrl: req.rpcUrl,
    rpcSubscriptionsUrl: wssUrl,
    indexerApiEndpoint: UMBRA_INDEXER_DEVNET,
    deferMasterSeedSignature: true,
  });

  const deposit = getPublicBalanceToEncryptedBalanceDirectDepositorFunction({
    client,
  });

  // The U64 + Address types are nominally branded but accept the raw
  // primitives at runtime; we cast through `any` to avoid pulling Umbra's
  // private brand machinery into our public surface.
  const result = await (deposit as any)(
    req.recipientBase58,
    req.mintBase58,
    req.amountTokens
  );

  // DepositResult shape: { signature: string, ... }; surface the signature
  // so the audit feed can correlate.
  const signature: string =
    typeof result === "string"
      ? result
      : (result?.signature as string) ?? "";

  return {
    signature,
    shieldedAmount: req.amountTokens,
  };
}
