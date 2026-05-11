#!/usr/bin/env node
/**
 * Actually SEND the bundled provision tx to devnet using the local test
 * keypair (no Phantom in the loop). If this fails, the bug is in the
 * polling loop / RPC / on-chain logic — not Phantom. If it succeeds,
 * the bug is Phantom-mediated (latency, drainer, etc).
 *
 * Run: node scripts/diagnose-provision-live.mjs [--use-test-wallet]
 *
 * Without --use-test-wallet: generates a fresh keypair, airdrops 2 SOL,
 *   then runs provision. Use this to test the WORST case (cold wallet).
 *
 * With --use-test-wallet: uses /tmp/phantom-test-key.json (pre-funded).
 *   Use this to test the case the demo actually hits.
 */
import {
  Connection, PublicKey, Keypair, Transaction, SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID, ExtensionType, getMintLen,
  createInitializeMintInstruction, createInitializeTransferHookInstruction,
  createAssociatedTokenAccountInstruction, createMintToInstruction,
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

const RPC = process.env.HELIUS_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_KEY}`
  : "https://api.devnet.solana.com";

const useTestWallet = process.argv.includes("--use-test-wallet");

const conn = new Connection(RPC, "confirmed");

let me;
if (useTestWallet) {
  const arr = JSON.parse(fs.readFileSync("/tmp/phantom-test-key.json", "utf8"));
  me = Keypair.fromSecretKey(Uint8Array.from(arr));
  console.log(`USING TEST WALLET: ${me.publicKey.toBase58()}`);
} else {
  me = Keypair.generate();
  console.log(`fresh wallet: ${me.publicKey.toBase58()}`);
  console.log("airdropping 2 SOL...");
  const sig = await conn.requestAirdrop(me.publicKey, 2_000_000_000);
  console.log(`airdrop sig: ${sig}`);
  await conn.confirmTransaction(sig, "confirmed");
}

const balance = await conn.getBalance(me.publicKey);
console.log(`balance: ${(balance / 1e9).toFixed(4)} SOL`);
console.log("");

const mint = Keypair.generate();
const dest = Keypair.generate();
const sanctioned = Keypair.generate();

const allowPda = PublicKey.findProgramAddressSync(
  [Buffer.from("allowlist"), me.publicKey.toBuffer()], POLICY_ALLOWLIST_ID,
)[0];
const ofacPda = PublicKey.findProgramAddressSync(
  [Buffer.from("ofac-list"), me.publicKey.toBuffer()], POLICY_SANCTIONS_ID,
)[0];
const extras = PublicKey.findProgramAddressSync(
  [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()], METAHOOK_ID,
)[0];
const sourceAta = getAssociatedTokenAddressSync(mint.publicKey, me.publicKey, false, TOKEN_2022_PROGRAM_ID);
const destAta = getAssociatedTokenAddressSync(mint.publicKey, dest.publicKey, false, TOKEN_2022_PROGRAM_ID);

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

console.log("checking existing on-chain state...");
const [allowInfo, ofacInfo, mintInfo, extrasInfo, sourceAtaInfo, destAtaInfo] = await Promise.all([
  conn.getAccountInfo(allowPda, "confirmed"),
  conn.getAccountInfo(ofacPda, "confirmed"),
  conn.getAccountInfo(mint.publicKey, "confirmed"),
  conn.getAccountInfo(extras, "confirmed"),
  conn.getAccountInfo(sourceAta, "confirmed"),
  conn.getAccountInfo(destAta, "confirmed"),
]);

const ixs = [];
ixs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));

if (!allowInfo) ixs.push(await allowlist.methods.initialize().accountsPartial({
  authority: me.publicKey, allowlist: allowPda, systemProgram: SystemProgram.programId,
}).instruction());

if (!ofacInfo) {
  ixs.push(await sanctions.methods.initialize().accountsPartial({
    authority: me.publicKey, ofacList: ofacPda, systemProgram: SystemProgram.programId,
  }).instruction());
  ixs.push(await sanctions.methods.addSanctioned(sanctioned.publicKey).accountsPartial({
    authority: me.publicKey, ofacList: ofacPda,
  }).instruction());
}

if (!mintInfo) {
  const mintLen = getMintLen([ExtensionType.TransferHook]);
  const lamports = await conn.getMinimumBalanceForRentExemption(mintLen);
  ixs.push(SystemProgram.createAccount({
    fromPubkey: me.publicKey, newAccountPubkey: mint.publicKey,
    space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID,
  }));
  ixs.push(createInitializeTransferHookInstruction(mint.publicKey, me.publicKey, METAHOOK_ID, TOKEN_2022_PROGRAM_ID));
  ixs.push(createInitializeMintInstruction(mint.publicKey, 0, me.publicKey, null, TOKEN_2022_PROGRAM_ID));
}

// V1.1: per-mint MetaHookConfig PDA (must come BEFORE initializeExtraAccountMetaList)
const configPda = PublicKey.findProgramAddressSync(
  [Buffer.from("metahook-config"), mint.publicKey.toBuffer()], METAHOOK_ID,
)[0];
const configInfo = await conn.getAccountInfo(configPda, "confirmed");
if (!configInfo) {
  ixs.push(await metahook.methods.initializeConfig(
    [
      { programId: POLICY_ALLOWLIST_ID, policyPda: allowPda },
      { programId: POLICY_SANCTIONS_ID, policyPda: ofacPda },
    ],
    0,
  ).accountsPartial({
    authority: me.publicKey, mint: mint.publicKey, config: configPda,
    systemProgram: SystemProgram.programId,
  }).instruction());
}

if (!extrasInfo) ixs.push(await metahook.methods.initializeExtraAccountMetaList().accountsPartial({
  payer: me.publicKey, extraAccountMetaList: extras, mint: mint.publicKey,
  config: configPda, systemProgram: SystemProgram.programId,
}).instruction());

if (!sourceAtaInfo) ixs.push(createAssociatedTokenAccountInstruction(me.publicKey, sourceAta, me.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID));
if (!destAtaInfo) ixs.push(createAssociatedTokenAccountInstruction(me.publicKey, destAta, dest.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID));
ixs.push(createMintToInstruction(mint.publicKey, sourceAta, me.publicKey, 1000n, [], TOKEN_2022_PROGRAM_ID));

console.log(`bundled ${ixs.length} instructions`);

const t0 = Date.now();
const latest = await conn.getLatestBlockhash("confirmed");
console.log(`got blockhash at +${Date.now()-t0}ms (lastValidBlockHeight=${latest.lastValidBlockHeight})`);

const tx = new Transaction({
  feePayer: me.publicKey,
  blockhash: latest.blockhash,
  lastValidBlockHeight: latest.lastValidBlockHeight,
}).add(...ixs);

tx.partialSign(mint);
tx.partialSign(me);
console.log(`signed at +${Date.now()-t0}ms (size=${tx.serialize().length} bytes)`);

const sig = await conn.sendRawTransaction(tx.serialize(), {
  skipPreflight: false, preflightCommitment: "confirmed",
});
console.log(`sent at +${Date.now()-t0}ms — sig=${sig}`);

// Poll matching demo.ts logic
let pollCount = 0;
let confirmedAt = null;
while (true) {
  pollCount++;
  const { value } = await conn.getSignatureStatuses([sig], { searchTransactionHistory: false });
  const status = value[0];
  if (status) {
    if (status.err) {
      console.log(`tx FAILED at poll #${pollCount} (+${Date.now()-t0}ms):`, status.err);
      process.exit(1);
    }
    if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
      confirmedAt = Date.now() - t0;
      console.log(`CONFIRMED at +${confirmedAt}ms (poll #${pollCount}, status=${status.confirmationStatus})`);
      break;
    }
    if (pollCount % 5 === 0) console.log(`  poll #${pollCount}: status=${status.confirmationStatus} confs=${status.confirmations}`);
  } else {
    if (pollCount % 5 === 0) console.log(`  poll #${pollCount}: status=null (not yet seen)`);
  }
  if (Date.now() - t0 > 90_000) {
    console.log(`HARD TIMEOUT at +${Date.now()-t0}ms after ${pollCount} polls`);
    process.exit(2);
  }
  await new Promise(r => setTimeout(r, 1000));
}

console.log("");
console.log(`https://solscan.io/tx/${sig}?cluster=devnet`);
console.log("");
console.log("provision SUCCEEDED end-to-end with test keypair (no Phantom).");
console.log("If the live demo still fails on the same wallet, the issue is");
console.log("Phantom-specific: blockhash expiry during signing latency,");
console.log("OR a Phantom-side rejection / drainer detection.");
