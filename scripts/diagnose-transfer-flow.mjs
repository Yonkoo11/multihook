#!/usr/bin/env node
/**
 * End-to-end transfer-flow probe against the deployed V1.1 metahook on
 * devnet. Uses the test keypair (no Phantom) to:
 *   1. Reuse the provisioned mint from the test wallet's last successful
 *      diagnose-provision-live.mjs run (or provision a fresh one if none).
 *   2. Try a transfer to a non-allowlisted destination — expect REJECT
 *      with `policy.allowlist.fail` in the on-chain logs.
 *   3. Add the destination to the allowlist.
 *   4. Retry the transfer — expect APPROVE + MetaHookAuditEvent emitted.
 *   5. Decode the event with the V1.1 schema and verify
 *      `failed_policy_index = -1` + `final_decision = true`.
 *
 * This proves the V1.1 process_execute (config-driven dispatch + AND
 * aggregation + audit event) works against the actual on-chain bytecode,
 * not just the local validator.
 */
import {
  Connection, PublicKey, Keypair, Transaction, SystemProgram,
  ComputeBudgetProgram, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID, ExtensionType, getMintLen,
  createInitializeMintInstruction, createInitializeTransferHookInstruction,
  createAssociatedTokenAccountInstruction, createMintToInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const METAHOOK_ID = new PublicKey("4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d");
const POLICY_ALLOWLIST_ID = new PublicKey("GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn");
const POLICY_SANCTIONS_ID = new PublicKey("5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt");

const RPC = "https://api.devnet.solana.com";
const conn = new Connection(RPC, "confirmed");

const arr = JSON.parse(fs.readFileSync("/tmp/phantom-test-key.json", "utf8"));
const me = Keypair.fromSecretKey(Uint8Array.from(arr));
console.log(`test wallet: ${me.publicKey.toBase58()}`);
console.log(`balance:     ${(await conn.getBalance(me.publicKey)) / 1e9} SOL`);
console.log("");

// Generate fresh per-run mint + dest so we always start from a clean slate
// for the transfer-hook execution path.
const mint = Keypair.generate();
const dest = Keypair.generate();

const allowPda = PublicKey.findProgramAddressSync(
  [Buffer.from("allowlist"), me.publicKey.toBuffer()], POLICY_ALLOWLIST_ID,
)[0];
const ofacPda = PublicKey.findProgramAddressSync(
  [Buffer.from("ofac-list"), me.publicKey.toBuffer()], POLICY_SANCTIONS_ID,
)[0];
const configPda = PublicKey.findProgramAddressSync(
  [Buffer.from("metahook-config"), mint.publicKey.toBuffer()], METAHOOK_ID,
)[0];
const extras = PublicKey.findProgramAddressSync(
  [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()], METAHOOK_ID,
)[0];
const sourceAta = getAssociatedTokenAddressSync(mint.publicKey, me.publicKey, false, TOKEN_2022_PROGRAM_ID);
const destAta = getAssociatedTokenAddressSync(mint.publicKey, dest.publicKey, false, TOKEN_2022_PROGRAM_ID);

console.log(`fresh mint:  ${mint.publicKey.toBase58()}`);
console.log(`dest:        ${dest.publicKey.toBase58()}`);
console.log("");

const allowlistIdl = JSON.parse(fs.readFileSync(path.join(ROOT, "app/src/idl_policy_allowlist.json"), "utf8"));
const sanctionsIdl = JSON.parse(fs.readFileSync(path.join(ROOT, "app/src/idl_policy_sanctions_ofac.json"), "utf8"));
const metahookIdl = JSON.parse(fs.readFileSync(path.join(ROOT, "app/src/idl_metahook.json"), "utf8"));

const provider = new AnchorProvider(
  conn,
  { publicKey: me.publicKey, signTransaction: async tx => { tx.partialSign(me); return tx; }, signAllTransactions: async txs => { for (const t of txs) t.partialSign(me); return txs; } },
  { commitment: "confirmed" },
);
const allowlist = new Program(allowlistIdl, provider);
const sanctions = new Program(sanctionsIdl, provider);
const metahook = new Program(metahookIdl, provider);

// ---- STEP 1: provision a fresh mint with V1.1 config ----
console.log("[1/4] provisioning fresh mint with V1.1 config...");
const allowInfo = await conn.getAccountInfo(allowPda, "confirmed");
const ofacInfo = await conn.getAccountInfo(ofacPda, "confirmed");

const provisionIxs = [];
provisionIxs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
provisionIxs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));

if (!allowInfo) provisionIxs.push(await allowlist.methods.initialize().accountsPartial({
  authority: me.publicKey, allowlist: allowPda, systemProgram: SystemProgram.programId,
}).instruction());

if (!ofacInfo) {
  provisionIxs.push(await sanctions.methods.initialize().accountsPartial({
    authority: me.publicKey, ofacList: ofacPda, systemProgram: SystemProgram.programId,
  }).instruction());
}

const mintLen = getMintLen([ExtensionType.TransferHook]);
const lamports = await conn.getMinimumBalanceForRentExemption(mintLen);
provisionIxs.push(SystemProgram.createAccount({
  fromPubkey: me.publicKey, newAccountPubkey: mint.publicKey,
  space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID,
}));
provisionIxs.push(createInitializeTransferHookInstruction(mint.publicKey, me.publicKey, METAHOOK_ID, TOKEN_2022_PROGRAM_ID));
provisionIxs.push(createInitializeMintInstruction(mint.publicKey, 0, me.publicKey, null, TOKEN_2022_PROGRAM_ID));
provisionIxs.push(await metahook.methods.initializeConfig(
  [
    { programId: POLICY_ALLOWLIST_ID, policyPda: allowPda },
    { programId: POLICY_SANCTIONS_ID, policyPda: ofacPda },
  ], 0,
).accountsPartial({
  authority: me.publicKey, mint: mint.publicKey, config: configPda,
  systemProgram: SystemProgram.programId,
}).instruction());
provisionIxs.push(await metahook.methods.initializeExtraAccountMetaList().accountsPartial({
  payer: me.publicKey, extraAccountMetaList: extras, mint: mint.publicKey,
  config: configPda, systemProgram: SystemProgram.programId,
}).instruction());
provisionIxs.push(createAssociatedTokenAccountInstruction(me.publicKey, sourceAta, me.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID));
provisionIxs.push(createAssociatedTokenAccountInstruction(me.publicKey, destAta, dest.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID));
provisionIxs.push(createMintToInstruction(mint.publicKey, sourceAta, me.publicKey, 1000n, [], TOKEN_2022_PROGRAM_ID));

const latest1 = await conn.getLatestBlockhash("finalized");
const tx1 = new Transaction({
  feePayer: me.publicKey, blockhash: latest1.blockhash, lastValidBlockHeight: latest1.lastValidBlockHeight,
}).add(...provisionIxs);
tx1.partialSign(mint);
tx1.partialSign(me);
const provSize = tx1.serialize().length;
const provSig = await sendAndConfirmTransaction(conn, tx1, [me, mint], { commitment: "confirmed" });
console.log(`     provision tx: ${provSize} bytes, sig=${provSig.slice(0,16)}…`);
console.log(`     https://solscan.io/tx/${provSig}?cluster=devnet`);

// ---- STEP 2: try transfer to non-allowlisted dest, expect REJECT ----
console.log("");
console.log("[2/4] attempting transfer to non-allowlisted dest (expect REJECT)...");
const ixFail = await createTransferCheckedWithTransferHookInstruction(
  conn, sourceAta, mint.publicKey, destAta, me.publicKey,
  100n, 0, [], "confirmed", TOKEN_2022_PROGRAM_ID,
);
const tx2 = new Transaction({ feePayer: me.publicKey, blockhash: (await conn.getLatestBlockhash()).blockhash })
  .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })).add(ixFail);
let rejectedAsExpected = false;
let rejectLogs = [];
try {
  await sendAndConfirmTransaction(conn, tx2, [me], { commitment: "confirmed" });
  console.log("     ❌ EXPECTED FAILURE — transfer somehow succeeded for non-allowlisted dest");
} catch (e) {
  const logs = e.logs ?? e.transactionLogs ?? [];
  rejectLogs = logs;
  const joined = logs.join("\n");
  if (joined.includes("policy.allowlist.fail")) {
    rejectedAsExpected = true;
    console.log("     ✅ rejected with policy.allowlist.fail");
  } else {
    console.log(`     ❌ rejected but reason wrong. Logs:`);
    for (const l of logs.slice(-10)) console.log(`        ${l}`);
  }
}
if (!rejectedAsExpected) process.exit(2);

// ---- STEP 3: add dest to allowlist ----
console.log("");
console.log("[3/4] adding dest to allowlist...");
const addAllowSig = await allowlist.methods.addAllowed(dest.publicKey).accountsPartial({
  authority: me.publicKey, allowlist: allowPda,
}).rpc();
console.log(`     add_allowed sig: ${addAllowSig.slice(0,16)}…`);

await new Promise(r => setTimeout(r, 1000)); // settle

// ---- STEP 4: retry transfer, expect APPROVE + audit event ----
console.log("");
console.log("[4/4] retrying transfer (expect APPROVE + audit event)...");
const ixOk = await createTransferCheckedWithTransferHookInstruction(
  conn, sourceAta, mint.publicKey, destAta, me.publicKey,
  100n, 0, [], "confirmed", TOKEN_2022_PROGRAM_ID,
);
const tx3 = new Transaction({ feePayer: me.publicKey, blockhash: (await conn.getLatestBlockhash()).blockhash })
  .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 })).add(ixOk);
const okSig = await sendAndConfirmTransaction(conn, tx3, [me], { commitment: "confirmed" });
console.log(`     transfer sig: ${okSig.slice(0,16)}…`);
console.log(`     https://solscan.io/tx/${okSig}?cluster=devnet`);

// Pull the tx and decode the audit event
let txInfo = null;
for (let i = 0; i < 10; i++) {
  txInfo = await conn.getTransaction(okSig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
  if (txInfo?.meta?.logMessages?.length) break;
  await new Promise(r => setTimeout(r, 500));
}
const okLogs = txInfo?.meta?.logMessages ?? [];
const okJoined = okLogs.join("\n");
console.log("");
console.log("on-chain logs (relevant lines):");
for (const l of okLogs) {
  if (l.includes("MetaHookAuditEvent") || l.includes("metahook:") || l.includes("Program data:") || l.includes("Instruction: ")) {
    console.log(`     ${l}`);
  }
}

// V1.1 schema check
const schemaOk = /MetaHookAuditEvent: final=true failed_policy=-1/.test(okJoined);
const eventOk = okLogs.some(l => l.startsWith("Program data:"));
console.log("");
console.log(`     V1.1 verdict line present:           ${schemaOk ? "✅" : "❌"}`);
console.log(`     audit event base64 ('Program data:'): ${eventOk ? "✅" : "❌"}`);

console.log("");
if (rejectedAsExpected && schemaOk && eventOk) {
  console.log("✅ FULL TRANSFER FLOW WORKS ON V1.1 DEVNET BYTECODE");
  console.log("   provision → reject → allow → approve → audit event");
} else {
  console.log("❌ flow incomplete — see above");
  process.exit(3);
}
