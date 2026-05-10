# Policy Authority — Don't Single-Key Your Compliance State

Every Multi-Hook child policy stores an `authority` Pubkey on its state PDA.
That key is the only one allowed to mutate the policy: add an allowed
address, remove a sanctioned address, raise a balance cap. **In production,
that key should never be a single hot wallet.** This doc shows how to wire
a [Squads](https://squads.so) multisig as the policy authority instead.

The demo at [yonkoo11.github.io/multihook](https://yonkoo11.github.io/multihook/)
uses a single-key authority because the demo issuer is the same person
clicking the buttons. The threat model in production is different.

---

## Threat model: why a single-key authority is broken

`policy-allowlist::add_allowed` and `policy-sanctions-ofac::remove_sanctioned`
take exactly one signer: `Allowlist.authority`. That key holds three
distinct compliance powers:

1. **Allowlist any address.** Compromise this key → instantly authorise
   transfers to a wallet the issuer has never seen.
2. **De-list a sanctioned address.** Compromise → drop an OFAC entry that
   should have stayed in place. Token can now move to that wallet.
3. **Migrate authority.** Compromise → rotate the `authority` field to an
   attacker-controlled key. Issuer permanently locked out of their own
   policy state.

In every reference policy the field is just a `Pubkey`. There's no
governance built into Multi-Hook on purpose — a meta-hook shouldn't
prescribe how its consumers manage governance. But unmanaged, that
single-key surface is the single biggest non-protocol risk in a real
deployment.

The fix is upstream: make the `authority` a Squads multisig vault PDA, so
every state mutation is an off-chain proposal that N-of-M signers must
approve before it lands.

---

## Squads pattern (2-of-3 worked example)

Three signers, two required:

- **Signer A** — issuer's compliance officer (Ledger, cold storage)
- **Signer B** — issuer's CTO (YubiKey-backed Phantom, hot)
- **Signer C** — outside counsel (Ledger, cold storage)

Any two can authorise a state change. Any one acting alone cannot. The
`Allowlist.authority` field stores the **Squads vault PDA**, not any
individual signer.

### Step 1 — create the Squads multisig

```ts
import * as multisig from "@sqds/multisig";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

const conn = new Connection("https://api.devnet.solana.com", "confirmed");
const creator = Keypair.fromSecretKey(/* … */);

// 1. Generate the multisig PDA from a unique createKey
const createKey = Keypair.generate();
const [multisigPda] = multisig.getMultisigPda({ createKey: createKey.publicKey });

// 2. Create the multisig: 3 members, threshold 2, no time lock for the demo
const ix = await multisig.instructions.multisigCreateV2({
  createKey: createKey.publicKey,
  creator: creator.publicKey,
  multisigPda,
  configAuthority: null,   // set to a key for upgradable config; null for immutable
  threshold: 2,
  members: [
    { key: SIGNER_A, permissions: multisig.types.Permissions.all() },
    { key: SIGNER_B, permissions: multisig.types.Permissions.all() },
    { key: SIGNER_C, permissions: multisig.types.Permissions.all() },
  ],
  timeLock: 0,
  treasury: TREASURY,      // skips a 0.1 SOL fee on devnet for the demo
  rentCollector: null,
});

// 3. Derive the vault PDA — THIS is the value you put in Allowlist.authority
const [vaultPda] = multisig.getVaultPda({ multisigPda, index: 0 });
```

### Step 2 — initialise the policy with the vault PDA as authority

The trick: the policy's `initialize` instruction needs the authority
to **sign**, but a Squads vault PDA can only sign through a Squads
proposal-execute flow. The clean pattern is to:

1. Create a Squads transaction that wraps the policy's `initialize` ix
2. Have 2-of-3 signers approve it
3. Execute the transaction → vault PDA signs the inner `initialize`

```ts
// 1. Build the inner instruction — initialize the SNS allowlist with
//    the vault PDA as authority
const initIx = await program.methods
  .initialize()
  .accountsPartial({
    authority: vaultPda,                // the multisig vault is the authority
    allowlist: snsAllowlistPda(vaultPda),
    systemProgram: SystemProgram.programId,
  })
  .instruction();

// 2. Wrap it in a Squads VaultTransaction
const transactionIndex = 1n;            // first proposal in this multisig
const [transactionPda] = multisig.getTransactionPda({ multisigPda, index: transactionIndex });

const wrapIx = await multisig.instructions.vaultTransactionCreate({
  multisigPda,
  transactionIndex,
  creator: creator.publicKey,
  vaultIndex: 0,
  ephemeralSigners: 0,
  transactionMessage: new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: (await conn.getLatestBlockhash()).blockhash,
    instructions: [initIx],
  }),
});

// 3. Each signer creates their proposal-approval (off-chain coordination
//    happens in the Squads UI in practice)
const approveIx_A = await multisig.instructions.proposalApprove({
  multisigPda, transactionIndex, member: SIGNER_A,
});
const approveIx_B = await multisig.instructions.proposalApprove({
  multisigPda, transactionIndex, member: SIGNER_B,
});

// 4. Once threshold is met, anyone can execute
const executeIx = await multisig.instructions.vaultTransactionExecute({
  multisigPda, transactionIndex, member: SIGNER_A, /* signer initiating */
});
```

### Step 3 — every subsequent `add_allowed` flows through the same shape

Once the policy is initialised with `authority = vaultPda`, every future
mutation has the same structure: build the policy instruction, wrap it in
a Squads `vaultTransactionCreate`, collect threshold approvals, execute.

```ts
const addIx = await program.methods
  .addAllowed(newAllowedPubkey)
  .accountsPartial({ authority: vaultPda, allowlist: allowlistPda(vaultPda) })
  .instruction();

// — wrap, approve, execute — same as Step 2 —
```

---

## Why this is depth-2 and not load-bearing in V1

Multi-Hook does not depend on Squads to function. The above pattern is
**how a production issuer should configure their `authority` field**, not
something the Multi-Hook program enforces. Issuers can choose:

- **Single hot wallet** — fastest, riskiest, fine for a hackathon demo
- **Squads 2-of-3** — recommended baseline for any real deployment
- **Squads 3-of-5 with time lock** — stronger; the time lock gives bad
  proposals a delay window during which honest signers can revoke
- **Anchor multisig + Squads vault** — paranoid; combine two governance
  primitives so a Squads bug or a multisig bug alone isn't fatal

The choice belongs to the issuer. This doc just makes the recommended
default trivial to wire.

---

## Devnet vs mainnet

The Squads program is deployed on both. Same program ID
(`SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf`) on both clusters; the
TypeScript SDK works identically. For the live Multi-Hook demo we keep
the single-key authority so the demo flow stays a single-click experience;
the production wiring above is the same code with one address swap.

---

## Suggested governance instructions to add (Phase 2)

When Multi-Hook itself wants opinionated governance baked in (vs leaving
it entirely to the issuer), the natural shape is:

| Instruction | Purpose |
|---|---|
| `init_with_governance(squads_multisig_pda)` | Initialise policy state binding it to a specific Squads multisig from day one |
| `transfer_authority(new_authority)` | Hand authority to a new key; gated by current authority signer |
| `freeze_mutations()` | Set a flag that blocks all `add_*`/`remove_*` for a duration; useful if the issuer suspects a key is compromised and wants to pause while rotating |

V1 ships none of these — the issuer rolls their own via Squads or any
other governance program. V2 candidates above.

---

## References

- Squads Protocol: <https://squads.so>
- Squads SDK: <https://github.com/Squads-Protocol/v4>
- Anchor `has_one` constraint: enforces the `authority` match on every
  `add_*`/`remove_*` instruction in the reference policies
- The reentrancy-guard pattern in `metahook` shows the dual case: a PDA
  whose state mutations are intentionally constrained to a single
  legitimate path. Squads is that pattern at the human-coordination layer
