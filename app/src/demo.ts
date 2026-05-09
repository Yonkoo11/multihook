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
    await conn.confirmTransaction(
      { signature: sig, blockhash: latest.blockhash, lastValidBlockHeight: latest.lastValidBlockHeight },
      "confirmed"
    );
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
 * Step 1: provision allowlist + ofac PDAs (per-user PDAs), seed an OFAC
 * stub address, then create the Token-2022 mint with TransferHook ext +
 * ExtraAccountMetaList, then ATAs, then mint to source.
 *
 * Idempotent: skips any account that already exists on-chain.
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

  // --- 1a. Allowlist + OFAC PDAs (skip if already exist) ---------------------
  const allowPda = allowlistPda(me);
  const ofac = ofacPda(me);

  const allowInfo = await conn.getAccountInfo(allowPda, "confirmed");
  const ofacInfo = await conn.getAccountInfo(ofac, "confirmed");

  const initIxs: TransactionInstruction[] = [];
  if (!allowInfo) {
    log("creating allowlist PDA…", "info");
    initIxs.push(
      await programs.allowlist.methods
        .initialize()
        .accountsPartial({
          authority: me,
          allowlist: allowPda,
          systemProgram: SystemProgram.programId,
        })
        .instruction()
    );
  } else {
    log("allowlist PDA already exists", "dim");
  }
  if (!ofacInfo) {
    log("creating OFAC PDA…", "info");
    initIxs.push(
      await programs.sanctions.methods
        .initialize()
        .accountsPartial({
          authority: me,
          ofacList: ofac,
          systemProgram: SystemProgram.programId,
        })
        .instruction()
    );
    initIxs.push(
      await programs.sanctions.methods
        .addSanctioned(sanctioned.publicKey)
        .accountsPartial({ authority: me, ofacList: ofac })
        .instruction()
    );
    log(`seeded stub sanctioned wallet ${sanctioned.publicKey.toBase58().slice(0, 12)}…`, "dim");
  } else {
    log("OFAC PDA already exists", "dim");
  }
  if (initIxs.length) {
    await sendTx(programs, initIxs, [], log);
  }

  // --- 1b. Token-2022 mint with TransferHook extension -----------------------
  const mintInfo = await conn.getAccountInfo(mint.publicKey, "confirmed");
  if (!mintInfo) {
    const mintLen = getMintLen([ExtensionType.TransferHook]);
    const lamports = await conn.getMinimumBalanceForRentExemption(mintLen);
    log("creating Token-2022 mint with TransferHook ext…", "info");
    await sendTx(
      programs,
      [
        SystemProgram.createAccount({
          fromPubkey: me,
          newAccountPubkey: mint.publicKey,
          space: mintLen,
          lamports,
          programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeTransferHookInstruction(
          mint.publicKey,
          me,
          programs.metahook.programId,
          TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMintInstruction(
          mint.publicKey,
          0,
          me,
          null,
          TOKEN_2022_PROGRAM_ID
        ),
      ],
      [mint],
      log
    );
  } else {
    log("mint already exists", "dim");
  }

  // --- 1c. ExtraAccountMetaList PDA ------------------------------------------
  const extras = extraMetaListPda(mint.publicKey);
  const extrasInfo = await conn.getAccountInfo(extras, "confirmed");
  if (!extrasInfo) {
    log("initializing ExtraAccountMetaList…", "info");
    await sendTx(
      programs,
      [
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
          .instruction(),
      ],
      [],
      log
    );
  } else {
    log("ExtraAccountMetaList already exists", "dim");
  }

  // --- 1d. ATAs + initial mint ----------------------------------------------
  const sourceAta = getAssociatedTokenAddressSync(
    mint.publicKey,
    me,
    false,
    TOKEN_2022_PROGRAM_ID
  );
  const destAta = getAssociatedTokenAddressSync(
    mint.publicKey,
    dest.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID
  );

  const ataIxs: TransactionInstruction[] = [];
  const sourceAtaInfo = await conn.getAccountInfo(sourceAta, "confirmed");
  if (!sourceAtaInfo) {
    ataIxs.push(
      createAssociatedTokenAccountInstruction(
        me, sourceAta, me, mint.publicKey, TOKEN_2022_PROGRAM_ID
      )
    );
  }
  const destAtaInfo = await conn.getAccountInfo(destAta, "confirmed");
  if (!destAtaInfo) {
    ataIxs.push(
      createAssociatedTokenAccountInstruction(
        me, destAta, dest.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID
      )
    );
  }

  // mint 1000 tokens to source if balance is currently 0
  let needsMint = true;
  if (sourceAtaInfo) {
    try {
      const acct = await getAccount(conn, sourceAta, "confirmed", TOKEN_2022_PROGRAM_ID);
      needsMint = acct.amount === 0n;
    } catch {
      needsMint = true;
    }
  }
  if (needsMint) {
    ataIxs.push(
      createMintToInstruction(
        mint.publicKey,
        sourceAta,
        me,
        1000,
        [],
        TOKEN_2022_PROGRAM_ID
      )
    );
  }

  if (ataIxs.length) {
    log(`finalizing ATAs (${ataIxs.length} ix)…`, "info");
    await sendTx(programs, ataIxs, [], log);
  } else {
    log("ATAs + supply already in place", "dim");
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
