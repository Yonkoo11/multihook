#!/usr/bin/env node
/**
 * Build the bundled provision tx for a fresh wallet, measure its serialized
 * size, and report whether it exceeds the 1232-byte legacy tx limit. Also
 * prints what each instruction contributes so we know where to split.
 *
 * Run: node scripts/diagnose-provision.mjs
 */
import {
  Connection, PublicKey, Keypair, Transaction, SystemProgram,
  ComputeBudgetProgram, TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID, ExtensionType, getMintLen,
  createInitializeMintInstruction, createInitializeTransferHookInstruction,
  createAssociatedTokenAccountInstruction, createMintToInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

const METAHOOK_ID = new PublicKey("4o6hRdZFqeM1YbvXQhjsmMgrNuoZSmgqMkpmZELBLh9d");
const POLICY_ALLOWLIST_ID = new PublicKey("GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn");
const POLICY_SANCTIONS_ID = new PublicKey("5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt");

const RPC = process.env.HELIUS_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_KEY}`
  : "https://api.devnet.solana.com";

const conn = new Connection(RPC, "confirmed");

// Use a fresh keypair (we don't actually send — just build + measure)
const me = Keypair.generate();
const mint = Keypair.generate();
const dest = Keypair.generate();
const sanctioned = Keypair.generate();

console.log(`fresh wallet: ${me.publicKey.toBase58()}`);
console.log(`fresh mint:   ${mint.publicKey.toBase58()}`);
console.log(`RPC:          ${RPC.replace(/api-key=.+/, "api-key=<hidden>")}`);
console.log("");

// PDA derivations matching app/src/programs.ts
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

// Load IDLs (built artifacts)
const allowlistIdl = JSON.parse(fs.readFileSync(path.join(ROOT, "app/src/idl_policy_allowlist.json"), "utf8"));
const sanctionsIdl = JSON.parse(fs.readFileSync(path.join(ROOT, "app/src/idl_policy_sanctions_ofac.json"), "utf8"));
const metahookIdl = JSON.parse(fs.readFileSync(path.join(ROOT, "app/src/idl_metahook.json"), "utf8"));

const provider = new AnchorProvider(conn, { publicKey: me.publicKey, signTransaction: async tx => tx, signAllTransactions: async txs => txs }, {});
const allowlist = new Program(allowlistIdl, provider);
const sanctions = new Program(sanctionsIdl, provider);
const metahook = new Program(metahookIdl, provider);

const ixs = [];
const labels = [];

// 1. compute budget
ixs.push(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
labels.push("ComputeBudget");

// 2. allowlist init
ixs.push(await allowlist.methods.initialize().accountsPartial({
  authority: me.publicKey, allowlist: allowPda, systemProgram: SystemProgram.programId,
}).instruction());
labels.push("allowlist.initialize");

// 3. ofac init
ixs.push(await sanctions.methods.initialize().accountsPartial({
  authority: me.publicKey, ofacList: ofacPda, systemProgram: SystemProgram.programId,
}).instruction());
labels.push("sanctions.initialize");

// 4. ofac addSanctioned
ixs.push(await sanctions.methods.addSanctioned(sanctioned.publicKey).accountsPartial({
  authority: me.publicKey, ofacList: ofacPda,
}).instruction());
labels.push("sanctions.addSanctioned");

// 5. mint createAccount
const mintLen = getMintLen([ExtensionType.TransferHook]);
const lamports = await conn.getMinimumBalanceForRentExemption(mintLen);
ixs.push(SystemProgram.createAccount({
  fromPubkey: me.publicKey, newAccountPubkey: mint.publicKey,
  space: mintLen, lamports, programId: TOKEN_2022_PROGRAM_ID,
}));
labels.push("System.createAccount(mint)");

// 6. transfer hook init
ixs.push(createInitializeTransferHookInstruction(
  mint.publicKey, me.publicKey, METAHOOK_ID, TOKEN_2022_PROGRAM_ID,
));
labels.push("Token-2022.initializeTransferHook");

// 7. mint init
ixs.push(createInitializeMintInstruction(mint.publicKey, 0, me.publicKey, null, TOKEN_2022_PROGRAM_ID));
labels.push("Token-2022.initializeMint");

// 8a. MetaHookConfig init (V1.1)
const configPda = PublicKey.findProgramAddressSync(
  [Buffer.from("metahook-config"), mint.publicKey.toBuffer()], METAHOOK_ID,
)[0];
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
labels.push("metahook.initializeConfig");

// 8b. ExtraMetaList init (now reads config)
ixs.push(await metahook.methods.initializeExtraAccountMetaList().accountsPartial({
  payer: me.publicKey, extraAccountMetaList: extras, mint: mint.publicKey,
  config: configPda, systemProgram: SystemProgram.programId,
}).instruction());
labels.push("metahook.initializeExtraAccountMetaList");

// 9. source ATA
ixs.push(createAssociatedTokenAccountInstruction(me.publicKey, sourceAta, me.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID));
labels.push("createAssociatedTokenAccount(source)");

// 10. dest ATA
ixs.push(createAssociatedTokenAccountInstruction(me.publicKey, destAta, dest.publicKey, mint.publicKey, TOKEN_2022_PROGRAM_ID));
labels.push("createAssociatedTokenAccount(dest)");

// 11. mint to
ixs.push(createMintToInstruction(mint.publicKey, sourceAta, me.publicKey, 1000n, [], TOKEN_2022_PROGRAM_ID));
labels.push("Token-2022.mintTo(1000)");

console.log(`built ${ixs.length} instructions:`);
ixs.forEach((ix, i) => {
  // each instruction contributes: 1 byte program-idx + 1 byte n_accounts +
  // n_accounts byte indexes + 2 bytes data-len + data
  const accountBytes = ix.keys.length;
  const dataBytes = ix.data.length;
  const ixSize = 1 + 1 + accountBytes + 2 + dataBytes;
  console.log(`  ${(i+1).toString().padStart(2)}. ${labels[i].padEnd(40)} ix-bytes=${ixSize.toString().padStart(4)}  accounts=${ix.keys.length.toString().padStart(2)}  data=${dataBytes}`);
});
console.log("");

const latest = await conn.getLatestBlockhash("confirmed");
const tx = new Transaction({
  feePayer: me.publicKey,
  blockhash: latest.blockhash,
  lastValidBlockHeight: latest.lastValidBlockHeight,
}).add(...ixs);

// Sign locally so we can serialize to true wire size
tx.partialSign(mint);
tx.partialSign(me);
const wire = tx.serialize();

console.log(`bundled tx wire size: ${wire.length} bytes`);
console.log(`legacy limit:         1232 bytes`);
console.log(`headroom:             ${1232 - wire.length} bytes`);
console.log("");
if (wire.length > 1232) {
  console.log(`### EXCEEDS LIMIT BY ${wire.length - 1232} BYTES ###`);
  console.log("The current bundled provision will trip the demo.ts catch handler");
  console.log("which then signs THREE separate txs (the failed bundle + 2 splits)");
  console.log("which Phantom drainer-pattern detector flags. Root cause confirmed.");
} else {
  console.log("Bundle FITS in legacy limit. Provision blocker is something else.");
  console.log("Likely candidates: blockhash expiry during Phantom signing latency,");
  console.log("RPC rate limiting on getSignatureStatuses, or a logic bug in the");
  console.log("polling loop. Recommend running the actual flow with devtools open.");
}
