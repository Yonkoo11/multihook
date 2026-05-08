/**
 * Phase 1 Gate integration test.
 *
 * Validates the full demo loop on Anchor's local validator:
 *   1. metahook + policy-allowlist + policy-sanctions-ofac all deploy
 *   2. Reentrancy guard PDA initialized
 *   3. Allowlist + OFAC PDAs initialized; OFAC seeded with one stub address
 *   4. Token-2022 mint created with TransferHook extension pointing to metahook
 *   5. ExtraAccountMetaList written for that mint
 *   6. Mint to source ATA succeeds
 *   7. Transfer to NON-allowlisted dest → reverts (policy.allowlist.fail)
 *   8. Transfer to OFAC-listed dest → reverts (policy.sanctions.fail)
 *   9. Add dest to allowlist; retry → succeeds + MetaHookAuditEvent in logs
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createInitializeMintInstruction,
  createInitializeTransferHookInstruction,
  createMintToInstruction,
  createTransferCheckedWithTransferHookInstruction,
  getAssociatedTokenAddressSync,
  getMintLen,
} from "@solana/spl-token";
import { assert } from "chai";

import { Metahook } from "../target/types/metahook";
import { PolicyAllowlist } from "../target/types/policy_allowlist";
import { PolicySanctionsOfac } from "../target/types/policy_sanctions_ofac";

describe("multihook phase 1 gate", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const metahook = anchor.workspace.metahook as Program<Metahook>;
  const allowlistProgram =
    anchor.workspace.policy_allowlist as Program<PolicyAllowlist>;
  const sanctionsProgram =
    anchor.workspace.policy_sanctions_ofac as Program<PolicySanctionsOfac>;

  const payer = (provider.wallet as anchor.Wallet).payer;
  const mintAuthority = payer;
  const policyAuthority = payer;
  const sourceOwner = payer;
  const destOwner = Keypair.generate();
  const sanctionedOwner = Keypair.generate();

  let mint: Keypair;
  let sourceAta: PublicKey;
  let destAta: PublicKey;
  let sanctionedAta: PublicKey;

  let reentrancyGuardPda: PublicKey;
  let allowlistPda: PublicKey;
  let ofacPda: PublicKey;
  let extraMetaListPda: PublicKey;

  before(async () => {
    mint = Keypair.generate();

    [reentrancyGuardPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("reentrancy-guard")],
      metahook.programId
    );

    [allowlistPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("allowlist"), policyAuthority.publicKey.toBuffer()],
      allowlistProgram.programId
    );

    [ofacPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("ofac-list"), policyAuthority.publicKey.toBuffer()],
      sanctionsProgram.programId
    );

    [extraMetaListPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("extra-account-metas"), mint.publicKey.toBuffer()],
      metahook.programId
    );

    sourceAta = getAssociatedTokenAddressSync(
      mint.publicKey,
      sourceOwner.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    destAta = getAssociatedTokenAddressSync(
      mint.publicKey,
      destOwner.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    sanctionedAta = getAssociatedTokenAddressSync(
      mint.publicKey,
      sanctionedOwner.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
  });

  it("initializes reentrancy guard", async () => {
    await metahook.methods
      .initializeReentrancyGuard()
      .accountsPartial({
        payer: payer.publicKey,
        reentrancyGuard: reentrancyGuardPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const guard = await metahook.account.reentrancyGuard.fetch(
      reentrancyGuardPda
    );
    assert.equal(guard.inProgress, false);
  });

  it("initializes allowlist + ofac PDAs and seeds OFAC", async () => {
    await allowlistProgram.methods
      .initialize()
      .accountsPartial({
        authority: policyAuthority.publicKey,
        allowlist: allowlistPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await sanctionsProgram.methods
      .initialize()
      .accountsPartial({
        authority: policyAuthority.publicKey,
        ofacList: ofacPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    await sanctionsProgram.methods
      .addSanctioned(sanctionedOwner.publicKey)
      .accountsPartial({
        authority: policyAuthority.publicKey,
        ofacList: ofacPda,
      })
      .rpc();

    const ofac = await sanctionsProgram.account.ofacList.fetch(ofacPda);
    assert.equal(ofac.entries.length, 1);
    assert.ok(ofac.entries[0].equals(sanctionedOwner.publicKey));
  });

  it("creates Token-2022 mint with TransferHook ext + ExtraAccountMetaList", async () => {
    const mintLen = getMintLen([ExtensionType.TransferHook]);
    const lamports = await provider.connection.getMinimumBalanceForRentExemption(
      mintLen
    );

    const tx = new Transaction()
      .add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mint.publicKey,
          space: mintLen,
          lamports,
          programId: TOKEN_2022_PROGRAM_ID,
        })
      )
      .add(
        createInitializeTransferHookInstruction(
          mint.publicKey,
          mintAuthority.publicKey,
          metahook.programId,
          TOKEN_2022_PROGRAM_ID
        )
      )
      .add(
        createInitializeMintInstruction(
          mint.publicKey,
          0,
          mintAuthority.publicKey,
          null,
          TOKEN_2022_PROGRAM_ID
        )
      );

    await sendAndConfirmTransaction(provider.connection, tx, [payer, mint]);

    await metahook.methods
      .initializeExtraAccountMetaList()
      .accountsPartial({
        payer: payer.publicKey,
        extraAccountMetaList: extraMetaListPda,
        mint: mint.publicKey,
        allowlistAuthority: policyAuthority.publicKey,
        sanctionsAuthority: policyAuthority.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("creates ATAs and mints to source", async () => {
    const tx = new Transaction()
      .add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          sourceAta,
          sourceOwner.publicKey,
          mint.publicKey,
          TOKEN_2022_PROGRAM_ID
        )
      )
      .add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          destAta,
          destOwner.publicKey,
          mint.publicKey,
          TOKEN_2022_PROGRAM_ID
        )
      )
      .add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          sanctionedAta,
          sanctionedOwner.publicKey,
          mint.publicKey,
          TOKEN_2022_PROGRAM_ID
        )
      )
      .add(
        createMintToInstruction(
          mint.publicKey,
          sourceAta,
          mintAuthority.publicKey,
          1000,
          [],
          TOKEN_2022_PROGRAM_ID
        )
      );

    await sendAndConfirmTransaction(provider.connection, tx, [payer]);
  });

  it("rejects transfer to non-allowlisted destination", async () => {
    const ix = await createTransferCheckedWithTransferHookInstruction(
      provider.connection,
      sourceAta,
      mint.publicKey,
      destAta,
      sourceOwner.publicKey,
      100n,
      0,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    let failed = false;
    try {
      await sendAndConfirmTransaction(
        provider.connection,
        new Transaction().add(ix),
        [payer]
      );
    } catch (e: any) {
      failed = true;
      const logs = (e.logs ?? []).join("\n");
      assert.include(
        logs.toLowerCase(),
        "policy.allowlist.fail",
        "expected allowlist failure in logs"
      );
    }
    assert.isTrue(failed, "transfer should have reverted");
  });

  it("rejects transfer to OFAC-sanctioned destination", async () => {
    // Add a placeholder to allowlist so we get past allowlist before sanctions kicks in
    await allowlistProgram.methods
      .addAllowed(sanctionedOwner.publicKey)
      .accountsPartial({
        authority: policyAuthority.publicKey,
        allowlist: allowlistPda,
      })
      .rpc();

    const ix = await createTransferCheckedWithTransferHookInstruction(
      provider.connection,
      sourceAta,
      mint.publicKey,
      sanctionedAta,
      sourceOwner.publicKey,
      100n,
      0,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    let failed = false;
    try {
      await sendAndConfirmTransaction(
        provider.connection,
        new Transaction().add(ix),
        [payer]
      );
    } catch (e: any) {
      failed = true;
      const logs = (e.logs ?? []).join("\n");
      assert.include(
        logs.toLowerCase(),
        "policy.sanctions.fail",
        "expected sanctions failure in logs"
      );
    }
    assert.isTrue(failed, "transfer should have reverted");
  });

  it("approves allowlisted clean destination + emits audit event", async () => {
    await allowlistProgram.methods
      .addAllowed(destOwner.publicKey)
      .accountsPartial({
        authority: policyAuthority.publicKey,
        allowlist: allowlistPda,
      })
      .rpc();

    const ix = await createTransferCheckedWithTransferHookInstruction(
      provider.connection,
      sourceAta,
      mint.publicKey,
      destAta,
      sourceOwner.publicKey,
      100n,
      0,
      [],
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );

    const sig = await sendAndConfirmTransaction(
      provider.connection,
      new Transaction().add(ix),
      [payer]
    );

    // getTransaction can lag behind sendAndConfirm; poll briefly for log availability.
    let tx = null as Awaited<ReturnType<typeof provider.connection.getTransaction>>;
    for (let i = 0; i < 10; i++) {
      tx = await provider.connection.getTransaction(sig, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (tx?.meta?.logMessages?.length) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    const logs = tx?.meta?.logMessages ?? [];
    const joined = logs.join("\n");
    assert.include(
      joined,
      "MetaHookAuditEvent",
      "audit event marker line should appear in transaction logs"
    );

    // Confirm the policy verdicts logged in the human-readable line.
    assert.match(
      joined,
      /MetaHookAuditEvent: allowlist=true sanctions=true final=true/,
      "audit verdict line should record both policies passing"
    );

    // Confirm a `Program data:` line was emitted (anchor `emit!` writes the
    // event as base64 here). This is the wire format Solscan / event indexers
    // pick up.
    const programDataLines = logs.filter((l) => l.startsWith("Program data:"));
    assert.isAtLeast(
      programDataLines.length,
      1,
      "expected at least one MetaHookAuditEvent emitted as a `Program data:` log line"
    );

    // Decode the discriminator from the first program-data line and confirm
    // it matches the IDL-declared MetaHookAuditEvent discriminator.
    const b64 = programDataLines[0].replace("Program data: ", "").trim();
    const bytes = Buffer.from(b64, "base64");
    const discriminator = bytes.subarray(0, 8);
    const idlEvent = (metahook.idl as any).events.find(
      (e: any) => e.name.toLowerCase() === "metahookauditevent"
    );
    assert.ok(idlEvent?.discriminator, "IDL should expose MetaHookAuditEvent discriminator");
    assert.deepEqual(
      Array.from(discriminator),
      idlEvent.discriminator,
      "emitted event discriminator should match MetaHookAuditEvent in IDL"
    );

    // Confirm the destination ATA actually received the tokens (the real
    // proof that the policy chain approved the transfer end-to-end).
    const destInfo = await provider.connection.getTokenAccountBalance(destAta);
    assert.equal(destInfo.value.amount, "100");
  });
});
