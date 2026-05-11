import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme, styles } from "../theme";
import { CodeBlock } from "../components/CodeBlock";

const CODE = `// POLICY_INTERFACE.md — required instruction
pub fn check_transfer(
    ctx: Context<CheckTransfer>,
    amount: u64,
) -> Result<()> {
    // Your rule here. Read source / dest / amount, decide,
    // return Ok or Err.
}

// Account context — fixed positions, then your tail accounts
//   0  source       (read)
//   1  mint         (read)
//   2  destination  (read)
//   3  owner        (read)
//   4  policy_pda   (read or read-write per your needs)
//   5+ extras       (you register; integrators forward them)

// Reject convention — load-bearing for client UIs
#[error_code]
pub enum YourPolicyError {
    #[msg("policy.your_name.fail: <reason>")]
    BlockedReason,
}`;

export const Interface: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const codeOpacity = interpolate(frame, [40, 80], [0, 1], { extrapolateRight: "clamp" });
  const policiesOpacity = interpolate(frame, [220, 260], [0, 1], { extrapolateRight: "clamp" });

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
          One instruction. One contract.
        </div>
        <div style={{ fontSize: 22, color: theme.textDim, fontFamily: theme.mono, marginBottom: 28, opacity: titleOpacity }}>
          ~200 lines of Rust per policy. Forks are not required.
        </div>

        <div style={{ opacity: codeOpacity, transform: `translateY(${(1 - codeOpacity) * 16}px)` }}>
          <CodeBlock
            code={CODE}
            lang="rust"
            fileName="POLICY_INTERFACE.md (excerpt)"
            highlight={[2, 3, 4, 5, 6, 7]}
            highlightColor={theme.accent}
            fontSize={20}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
            marginTop: 28,
            opacity: policiesOpacity,
          }}
        >
          <PolicyCard
            name="policy-allowlist"
            id="GJHxobVdfywhTidD9u4EoYPGa9kBQVzEcZ7kDhVZehyn"
            note="set-membership · 32 entries"
          />
          <PolicyCard
            name="policy-sanctions-ofac"
            id="5iz6WXUksBqCQTBVkKYdeWtRJYwMZWiofM9AvSQDJkWt"
            note="inverted set · 64 entries"
          />
          <PolicyCard
            name="policy-sns-allowlist"
            id="4J57Rh4w6k8VxJAptKVP2v8St273Msy9afskc16qFuTo"
            note="SNS triple-bind"
            accent
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const PolicyCard: React.FC<{ name: string; id: string; note: string; accent?: boolean }> = ({
  name, id, note, accent,
}) => (
  <div
    style={{
      padding: "16px 20px",
      backgroundColor: theme.surface,
      border: `1px solid ${accent ? theme.highlight1 : theme.border}`,
      borderRadius: 10,
      boxShadow: accent ? `0 0 24px ${theme.highlight1}22` : "none",
    }}
  >
    <div style={{ fontFamily: theme.mono, fontSize: 18, color: theme.text, fontWeight: 600 }}>
      {name}
    </div>
    <div style={{ fontFamily: theme.mono, fontSize: 13, color: theme.textMute, marginTop: 6, wordBreak: "break-all" }}>
      {id.slice(0, 20)}…{id.slice(-8)}
    </div>
    <div style={{ fontSize: 14, color: theme.textDim, marginTop: 8 }}>{note}</div>
  </div>
);
