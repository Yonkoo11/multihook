import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createMintToInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMintLen,
} from "@solana/spl-token";

import {
  Programs,
  allowlistPda,
  extraMetaListPda,
  ofacPda,
} from "./programs";
import { destKp, mintKp, DemoState, sanctionedKp } from "./state";

export type LogFn = (msg: string, kind?: string, link?: string) => void;

/**
 * HTTP-polling tx confirmation. Avoids the WebSocket subscription path that
 * hangs on restrictive networks. Polls getSignatureStatuses every 1s up to
 * lastValidBlockHeight + 30s safety margin.
 */
async function pollForConfirmation(
  conn: import("@solana/web3.js").Connection,
  signature: string,
  lastValidBlockHeight: number,
  pollMs = 1000,
  hardTimeoutMs = 90_000
): Promise<void> {
  const started = Date.now();
  while (true) {
    const { value } = await conn.getSignatureStatuses([signature], { searchTransactionHistory: false });
    const status = value[0];
    if (status) {
      if (status.err) throw Object.assign(new Error("transaction failed: " + JSON.stringify(status.err)), { logs: status.err });
      if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") return;
    }
    const blockHeight = await conn.getBlockHeight("confirmed").catch(() => null);
    if (blockHeight !== null && blockHeight > lastValidBlockHeight) {
      throw new Error("transaction expired (lastValidBlockHeight passed)");
    }
    if (Date.now() - started > hardTimeoutMs) {
      throw new Error("confirmation timeout (90s)");
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}

/**
 * One-shot send. Phantom signs the wallet's part; if any extra Keypairs are
 * provided (e.g. the mint keypair), we partial-sign with them locally first.
 */
async function sendTx(
  programs: Programs,
  ixs: TransactionInstruction[],
  signers: Keypair[],
  log: LogFn
): Promise<string> {
  const conn = programs.provider.connection;
  const wallet = programs.provider.wallet;
  const latest = await conn.getLatestBlockhash("confirmed");

  // small CU bump in case of an unlucky validator estimate; well under our
  // measured 33,346 ceiling but gives headroom for v2 policies later.
  const tx = new Transaction({
    feePayer: wallet.publicKey,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  })
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
    .add(...ixs);

  for (const s of signers) tx.partialSign(s);
  const signed = await wallet.signTransaction(tx);

  try {
    const sig = await conn.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    // HTTP polling instead of WebSocket subscription. WS subscriptions hang
    // in some restricted-network environments (corp proxies, headless Chrome
    // CORS for wss://). Polling is slightly slower but works everywhere.
    await pollForConfirmation(conn, sig, latest.lastValidBlockHeight);
    log(`→ confirmed: ${sig.slice(0, 12)}…`, "ok", `https://solscan.io/tx/${sig}?cluster=devnet`);
    return sig;
  } catch (e: any) {
    // Surface program logs when available — that's where the policy revert
    // string lives.
    const logs = e.logs ?? e?.transactionLogs ?? [];
    if (logs?.length) {
      log("program logs:", "dim");
      for (const l of logs) log("  " + l, "dim");
    }
    throw e;
  }
}

/**
 * Step 1: provision allowlist + ofac PDAs, seed an OFAC stub, create the
 * Token-2022 mint with TransferHook + ExtraAccountMetaList, create source +
 * dest ATAs, mint 1000 tokens to source.
 *
 * Bundles everything into a single transaction so Phantom's drainer-pattern
 * detection (multi-tx-after-trust-grant) doesn't flag the dApp as malicious.
 * Falls back to two transactions only if the bundled tx exceeds Solana's
 * 1232-byte legacy limit.
 *
 * Idempotent: skips any instruction whose target account already exists.
 */
export async function provision(
  programs: Programs,
  state: DemoState,
  log: LogFn
): Promise<void> {
  const { provider } = programs;
  const conn = provider.connection;
  const me = provider.wallet.publicKey!;
  const mint = mintKp(state);
  const dest = destKp(state);
  const sanctioned = sanctionedKp(state);

  log(`me: ${me.toBase58()}`, "dim");
  log(`mint: ${mint.publicKey.toBase58()}`, "dim");
  log(`demo dest: ${dest.publicKey.toBase58()}`, "dim");

  const allowPda = allowlistPda(me);
  const ofac = ofacPda(me);
  const extras = extraMetaListPda(mint.publicKey);
  const sourceAta = getAssociatedTokenAddressSync(mint.publicKey, me, false, TOKEN_2022_PROGRAM_ID);
  const destAta = getAssociatedTokenAddressSync(mint.publicKey, dest.publicKey, false, TOKEN_2022_PROGRAM_ID);

  // Probe on-chain state in parallel so we can skip what already exists.
  const [allowInfo, ofacInfo, mintInfo, extrasInfo, sourceAtaInfo, destAtaInfo] = await Promise.all([
    conn.getAccountInfo(allowPda, "confirmed"),
    conn.getAccountInfo(ofac, "confirmed"),
    conn.getAccountInfo(mint.publicKey, "confirmed"),
    conn.getAccountInfo(extras, "confirmed"),
    conn.getAccountInfo(sourceAta, "confirmed"),
    conn.getAccountInfo(destAta, "confirmed"),
  ]);

  // Build the single-tx bundle in dependency order.
  const ixs: TransactionInstruction[] = [];

  if (!allowInfo) {
    log("queue: init allowlist PDA", "info");
    ixs.push(
      await programs.allowlist.methods
        .initialize()
        .accountsPartial({ authority: me, allowlist: allowPda, systemProgram: SystemProgram.programId })
        .instruction()
    );
  } else log("allowlist PDA already exists", "dim");

  if (!ofacInfo) {
    log("queue: init OFAC PDA + seed stub", "info");
    ixs.push(
      await programs.sanctions.methods
        .initialize()
        .accountsPartial({ authority: me, ofacList: ofac, systemProgram: SystemProgram.programId })
        .instruction()
    );
    ixs.push(
      await programs.sanctions.methods
        .addSanctioned(sanctioned.publicKey)
        .accountsPartial({ authority: me, ofacList: ofac })
        .instruction()
    );
  } else log("OFAC PDA already exists", "dim");

  if (!mintInfo) {
    const mintLen = getMintLen([ExtensionType.TransferHook]);
    const lamports = await conn.getMinimumBalanceForRentExemption(mintLen);
    log("queue: create Token-2022 mint + TransferHook + initialize", "info");
    ixs.push(
      SystemProgram.createAccount({
        fromPubkey: me,
        newAccountPubkey: mint.publicKey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      })
    );
    ixs.push(
      createInitializeTransferHookInstruction(
        mint.publicKey, me, programs.metahook.programId, TOKEN_2022_PROGRAM_ID
      )
    );
    ixs.push(
      createInitializeMintInstruction(mint.publicKey, 0, me, null, TOKEN_2022_PROGRAM_ID)
    );
  } else log("mint already exists", "dim");

  if (!extrasInfo) {
    log("queue: init ExtraAccountMetaList", "info");
    ixs.push(
      await programs.metahook.methods
        .initializeExtraAccountMetaList()
        .accountsPartial({
          payer: me,
          extraAccountMetaList: extras,
          mint: mint.publicKey,
          allowlistAuthority: me,
          sanctionsAuthority: me,
          systemProgram: SystemProgram.programId,
        })
        .instruction()
    );
  } else log("ExtraAccountMetaList already exists", "dim");

  if (!sourceAtaInfo) {
    log("queue: create source ATA", "info");
    ixs.push(
      createAssociatedTokenAccountInstruction(me, sourceAta, me, mint.publicKey, TOKEN_2022_PROGRAM_ID)
    );
  }
  if (!destAtaInfo) {
    log("queue: create dest ATA", "info");
    ixs.push(
      createAssociatedTokenAccountInstruction(me, destAta, dest.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID)
    );
  }

  let needsMintTo = true;
  if (sourceAtaInfo) {
    try {
      const acct = await getAccount(conn, sourceAta, "confirmed", TOKEN_2022_PROGRAM_ID);
      needsMintTo = acct.amount === 0n;
    } catch {
      needsMintTo = true;
    }
  }
  if (needsMintTo) {
    log("queue: mint 1000 to source", "info");
    ixs.push(
      createMintToInstruction(mint.publicKey, sourceAta, me, 1000, [], TOKEN_2022_PROGRAM_ID)
    );
  }

  if (!ixs.length) {
    log("nothing to do — provision state is already on-chain", "ok");
    state.provisioned = true;
    return;
  }

  // We always need the mint Keypair as an extra signer when SystemProgram.createAccount(mint)
  // is in the bundle. If we skipped mint creation, no extra signers needed.
  const extraSigners: Keypair[] = mintInfo ? [] : [mint];

  log(`bundling ${ixs.length} instruction(s) into one signed transaction…`, "info");
  try {
    await sendTx(programs, ixs, extraSigners, log);
  } catch (e: any) {
    // If we hit the 1232-byte serialized limit, split into 2 txs.
    if (/Transaction too large|too large/i.test(String(e?.message ?? ""))) {
      log("bundle exceeded tx-size limit; splitting into two signatures", "warn");
      // Split: first half = PDAs + mint creation, second half = ExtraMetaList + ATAs + mint_to.
      const splitIdx = Math.ceil(ixs.length / 2);
      await sendTx(programs, ixs.slice(0, splitIdx), extraSigners, log);
      await sendTx(programs, ixs.slice(splitIdx), [], log);
    } else {
      throw e;
    }
  }

  state.provisioned = true;
  log("provision complete", "ok");
}

/**
 * Build the transfer-hook instruction. Token-2022 + spl-token resolves the
 * extra accounts (reentrancy guard, both child programs, both PDAs) by
 * fetching the ExtraAccountMetaList from the mint.
 */
async function buildTransferIx(
  programs: Programs,
  mint: PublicKey,
  dest: PublicKey,
  amount: bigint
): Promise<TransactionInstruction> {
  const me = programs.provider.wallet.publicKey!;
  const sourceAta = getAssociatedTokenAddressSync(mint, me, false, TOKEN_2022_PROGRAM_ID);
  const destAta = getAssociatedTokenAddressSync(mint, dest, false, TOKEN_2022_PROGRAM_ID);

  return await createTransferCheckedWithTransferHookInstruction(
    programs.provider.connection,
    sourceAta,
    mint,
    destAta,
    me,
    amount,
    0,
    [],
    "confirmed",
    TOKEN_2022_PROGRAM_ID
  );
}

/**
 * Step 2: try to transfer to non-allowlisted dest. Should revert.
 * Returns true if it reverted with the expected reason.
 */
export async function tryTransferExpectFail(
  programs: Programs,
  state: DemoState,
  log: LogFn
): Promise<{ failed: boolean; reason: string | null }> {
  const mint = mintKp(state).publicKey;
  const dest = destKp(state).publicKey;
  const ix = await buildTransferIx(programs, mint, dest, 100n);

  try {
    await sendTx(programs, [ix], [], log);
    return { failed: false, reason: null };
  } catch (e: any) {
    const logs: string[] = e.logs ?? e?.transactionLogs ?? [];
    const joined = logs.join("\n").toLowerCase();
    if (joined.includes("policy.allowlist.fail")) {
      log("MetaHook reverted with policy.allowlist.fail — exactly as expected.", "ok");
      return { failed: true, reason: "policy.allowlist.fail" };
    }
    if (joined.includes("policy.sanctions.fail")) {
      log("MetaHook reverted with policy.sanctions.fail (unexpected for this dest).", "warn");
      return { failed: true, reason: "policy.sanctions.fail" };
    }
    log(`reverted, but not with a recognized policy reason: ${e.message ?? e}`, "warn");
    return { failed: true, reason: null };
  }
}

/**
 * Step 3: add the demo destination owner to allowlist.
 */
export async function addDestinationToAllowlist(
  programs: Programs,
  state: DemoState,
  log: LogFn
): Promise<void> {
  const me = programs.provider.wallet.publicKey!;
  const dest = destKp(state).publicKey;
  const ix = await programs.allowlist.methods
    .addAllowed(dest)
    .accountsPartial({ authority: me, allowlist: allowlistPda(me) })
    .instruction();
  await sendTx(programs, [ix], [], log);
  state.allowlisted = true;
  log(`destination ${dest.toBase58().slice(0, 12)}… added to allowlist`, "ok");
}

/**
 * Step 4: retry the same transfer. Should succeed and emit the audit event.
 * Pulls the audit event from the transaction's program-data logs and returns
 * the parsed fields for UI display.
 */
export async function retryTransferExpectSuccess(
  programs: Programs,
  state: DemoState,
  log: LogFn
): Promise<AuditEvent | null> {
  const mint = mintKp(state).publicKey;
  const dest = destKp(state).publicKey;
  const conn = programs.provider.connection;
  const ix = await buildTransferIx(programs, mint, dest, 100n);

  const sig = await sendTx(programs, [ix], [], log);
  state.succeeded = true;

  // Fetch full tx to extract the audit event from logs.
  let tx = null as Awaited<ReturnType<typeof conn.getTransaction>>;
  for (let i = 0; i < 12; i++) {
    tx = await conn.getTransaction(sig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });
    if (tx?.meta?.logMessages?.length) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  const logs = tx?.meta?.logMessages ?? [];
  const evt = decodeAuditEvent(logs, programs);
  if (evt) {
    log(`MetaHookAuditEvent decoded — final=${evt.final ? "PASS" : "FAIL"}`, "ok");
  } else {
    log("transfer succeeded but no audit event in logs (rare lag — refresh tx in Solscan)", "warn");
  }
  return evt;
}

export interface AuditEvent {
  mint: string;
  source: string;
  destination: string;
  amount: string;
  allowlistPass: boolean;
  sanctionsPass: boolean;
  final: boolean;
  signature: string;
  rawBase64: string;
}

/**
 * Parse the MetaHookAuditEvent from a tx's `Program data:` logs. Anchor's
 * `emit!` macro writes the event as base64-encoded `[8-byte discriminator |
 * borsh-serialized fields]`. Fields here are 3 Pubkey + u64 + 3 bool.
 */
function decodeAuditEvent(logs: string[], programs: Programs): AuditEvent | null {
  const programDataLines = logs.filter((l) => l.startsWith("Program data:"));
  const idl = programs.metahook.idl as any;
  const eventDef = idl.events?.find(
    (e: any) => e.name.toLowerCase() === "metahookauditevent"
  );
  if (!eventDef?.discriminator) return null;
  const discriminator = Uint8Array.from(eventDef.discriminator);

  for (const line of programDataLines) {
    const b64 = line.replace("Program data: ", "").trim();
    let bytes: Uint8Array;
    try {
      bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    } catch {
      continue;
    }
    if (bytes.length < 8 + 32 * 3 + 8 + 3) continue;
    let match = true;
    for (let i = 0; i < 8; i++) {
      if (bytes[i] !== discriminator[i]) {
        match = false;
        break;
      }
    }
    if (!match) continue;

    const buf = bytes;
    let off = 8;
    const mint = new PublicKey(buf.slice(off, off + 32));
    off += 32;
    const source = new PublicKey(buf.slice(off, off + 32));
    off += 32;
    const destination = new PublicKey(buf.slice(off, off + 32));
    off += 32;
    const amount = new DataView(buf.buffer, buf.byteOffset + off, 8).getBigUint64(0, true);
    off += 8;
    const allowlistPass = buf[off++] === 1;
    const sanctionsPass = buf[off++] === 1;
    const final = buf[off++] === 1;

    return {
      mint: mint.toBase58(),
      source: source.toBase58(),
      destination: destination.toBase58(),
      amount: amount.toString(),
      allowlistPass,
      sanctionsPass,
      final,
      signature: "",
      rawBase64: b64,
    };
  }
  return null;
}
