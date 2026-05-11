import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme, styles } from "../theme";
import { CodeBlock } from "../components/CodeBlock";

const CODE = `// programs/policy-sns-allowlist/src/lib.rs — check_transfer (excerpt)
pub fn check_transfer(ctx: Context<CheckTransfer>, _amount: u64) -> Result<()> {
    let dest_data = ctx.accounts.destination_token.try_borrow_data()?;
    let dest_owner = Pubkey::try_from(&dest_data[32..64])
        .map_err(|_| error!(SnsAllowlistError::TokenAccountTooSmall))?;

    // 1. NameRecord must be owned by the canonical SNS program.
    require!(
        ctx.accounts.sns_name_record.owner == &SNS_PROGRAM_ID,
        SnsAllowlistError::NotAnSnsRecord
    );

    // 2. NameRecord PDA must be on the issuer's authorised set.
    require!(
        ctx.accounts.allowlist.domains.contains(ctx.accounts.sns_name_record.key),
        SnsAllowlistError::DomainNotAllowed
    );

    // 3. NameRecord owner must match the destination token-account owner.
    let name_data = ctx.accounts.sns_name_record.try_borrow_data()?;
    let name_owner = Pubkey::try_from(&name_data[SNS_OWNER_OFFSET..SNS_OWNER_OFFSET + 32])
        .map_err(|_| error!(SnsAllowlistError::SnsAccountTooSmall))?;
    require!(name_owner == dest_owner, SnsAllowlistError::SnsOwnerMismatch);
    Ok(())
}`;

const CHECKS = [
  { num: 1, title: "Owned by canonical SNS program", defends: "blocks any forged \".sol\" name service", color: theme.pass },
  { num: 2, title: "PDA on issuer's authorised set", defends: "blocks transfers to unauthorised domains", color: theme.highlight2 },
  { num: 3, title: "name_owner == dest_owner", defends: "defeats the historical-control replay", color: theme.highlight1 },
];

export const SnsTriple: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const codeOpacity = interpolate(frame, [40, 80], [0, 1], { extrapolateRight: "clamp" });

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
          SNS triple-bind: the interesting code
        </div>
        <div
          style={{
            fontSize: 22,
            color: theme.textDim,
            fontFamily: theme.mono,
            marginBottom: 28,
            opacity: titleOpacity,
          }}
        >
          Three independent checks. Each defends a specific replay class.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 28 }}>
          <div style={{ opacity: codeOpacity, transform: `translateY(${(1 - codeOpacity) * 16}px)` }}>
            <CodeBlock
              code={CODE}
              lang="rust"
              fileName="lib.rs:77-113"
              highlight={[7, 8, 9, 10, 13, 14, 15, 16, 19, 20, 21, 22, 23]}
              highlightColor={theme.highlight1}
              fontSize={16}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
            {CHECKS.map((c, i) => {
              const startFrame = 130 + i * 80;
              const opacity = interpolate(frame, [startFrame, startFrame + 25], [0, 1], { extrapolateRight: "clamp" });
              const tx = interpolate(frame, [startFrame, startFrame + 30], [30, 0], { extrapolateRight: "clamp" });
              return (
                <div
                  key={c.num}
                  style={{
                    opacity,
                    transform: `translateX(${tx}px)`,
                    padding: "18px 22px",
                    backgroundColor: theme.surface,
                    border: `1px solid ${c.color}55`,
                    borderRadius: 12,
                    boxShadow: `0 0 24px ${c.color}22`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8 }}>
                    <div
                      style={{
                        fontSize: 36,
                        fontWeight: 700,
                        color: c.color,
                        fontFamily: theme.mono,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {c.num}
                    </div>
                    <div style={{ fontSize: 18, color: theme.text, fontWeight: 600 }}>
                      {c.title}
                    </div>
                  </div>
                  <div style={{ fontSize: 16, color: theme.textDim, fontFamily: theme.mono, lineHeight: 1.4 }}>
                    {c.defends}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
