import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme, styles } from "../theme";
import { CodeBlock } from "../components/CodeBlock";

const TS = `// Wiring a third policy into a live MetaHook'd mint
import { Program } from "@coral-xyz/anchor";
import { metahookConfigPda, METAHOOK_ID } from "./programs";

await metahook.methods
  .addPolicy({
    programId: NEW_POLICY_PROGRAM_ID,
    policyPda: NEW_POLICY_PDA,
  })
  .accountsPartial({
    authority: issuer.publicKey,
    config: metahookConfigPda(mint),
  })
  .rpc();

// Re-init ExtraAccountMetaList — reads the updated config:
await metahook.methods.initializeExtraAccountMetaList()
  .accountsPartial({ payer, mint, config, ... })
  .rpc();

// Done. Two policies became three. The meta-hook code never moved.`;

const RUST = `// programs/metahook/src/lib.rs — add_policy
pub fn add_policy(ctx: Context<MutateConfig>, policy: PolicyEntry) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let count = config.policy_count as usize;
    require!(count < MAX_POLICIES, MetaHookError::PolicyListFull);
    for i in 0..count {
        require!(config.policies[i].program_id != policy.program_id,
                 MetaHookError::PolicyAlreadyConfigured);
    }
    config.policies[count] = policy;
    config.policy_count = (count as u8) + 1;
    Ok(())
}`;

export const Composability: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const tsOpacity = interpolate(frame, [40, 80], [0, 1], { extrapolateRight: "clamp" });
  const rustOpacity = interpolate(frame, [180, 220], [0, 1], { extrapolateRight: "clamp" });
  const closingOpacity = interpolate(frame, [580, 640], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={styles.page}>
      <div style={styles.ambient} />
      <div style={{ position: "relative", padding: "30px 60px" }}>
        <div
          style={{
            fontSize: theme.fsTitle,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            opacity: titleOpacity,
            marginBottom: 8,
          }}
        >
          Add a policy to a live mint
        </div>
        <div
          style={{
            fontSize: 22,
            color: theme.textDim,
            fontFamily: theme.mono,
            marginBottom: 24,
            opacity: titleOpacity,
          }}
        >
          One authority-gated call. The meta-hook code never moves.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div style={{ opacity: tsOpacity, transform: `translateY(${(1 - tsOpacity) * 16}px)` }}>
            <CodeBlock
              code={TS}
              lang="ts"
              fileName="client side — TypeScript"
              fontSize={16}
              highlight={[5, 6, 7, 8, 9]}
              highlightColor={theme.highlight2}
            />
          </div>
          <div style={{ opacity: rustOpacity, transform: `translateY(${(1 - rustOpacity) * 16}px)` }}>
            <CodeBlock
              code={RUST}
              lang="rust"
              fileName="meta-hook side — authority-gated"
              fontSize={16}
              highlight={[3, 4, 5, 6, 7, 8, 9, 10, 11, 12]}
              highlightColor={theme.accent}
            />
          </div>
        </div>

        <div
          style={{
            marginTop: 28,
            padding: "20px 28px",
            backgroundColor: `${theme.accent}11`,
            border: `1px solid ${theme.accent}55`,
            borderRadius: 12,
            opacity: closingOpacity,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontSize: 22, color: theme.text, fontWeight: 500 }}>
            The composability claim is made true by the on-chain config —
          </div>
          <div style={{ fontSize: 22, color: theme.accent, fontFamily: theme.mono, fontWeight: 600 }}>
            not by a marketing diagram.
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
