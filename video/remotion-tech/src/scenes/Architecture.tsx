import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme, styles } from "../theme";
import { CodeBlock } from "../components/CodeBlock";

const CODE = `// programs/metahook/src/lib.rs — process_execute (excerpt)
let config = MetaHookConfig::try_deserialize(&mut &**config_account
    .try_borrow_data()?)?;
let policy_count = config.policy_count as usize;

// AND-aggregate: short-circuit on first failure.
let mut failed_policy_index: i8 = -1;
for i in 0..policy_count {
    let prog = &accounts[FIXED_ACCOUNTS_BEFORE_POLICIES + 2 * i];
    let pda  = &accounts[FIXED_ACCOUNTS_BEFORE_POLICIES + 2 * i + 1];
    let result = invoke_child_check(
        prog, &[source, mint, destination, owner, pda],
        amount, &CHECK_TRANSFER_DISC,
    );
    if result.is_err() { failed_policy_index = i as i8; break; }
}

emit!(MetaHookAuditEvent {
    version: 1, mint, source, destination, amount,
    policy_count, final_decision: failed_policy_index < 0,
    failed_policy_index,
});`;

export const Architecture: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });
  const codeOpacity = interpolate(frame, [40, 80], [0, 1], { extrapolateRight: "clamp" });
  const calloutOpacity = interpolate(frame, [200, 240], [0, 1], { extrapolateRight: "clamp" });

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
          The dispatcher is one for-loop
        </div>
        <div
          style={{
            fontSize: 22,
            color: theme.textDim,
            fontFamily: theme.mono,
            marginBottom: 32,
            opacity: titleOpacity,
          }}
        >
          read config · loop policies · CPI · AND-aggregate · emit event
        </div>

        <div style={{ opacity: codeOpacity, transform: `translateY(${(1 - codeOpacity) * 16}px)` }}>
          <CodeBlock
            code={CODE}
            lang="rust"
            fileName="programs/metahook/src/lib.rs"
            highlight={[7, 8, 9, 10, 11, 12, 13, 14, 15, 16]}
            highlightColor={theme.accent}
            fontSize={20}
          />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            marginTop: 32,
            opacity: calloutOpacity,
          }}
        >
          <Stat label="MAX_POLICIES" value="8" sub="config hard cap" />
          <Stat label="aggregation" value="AND" sub="V1 (OR / weighted: V2)" />
          <Stat label="CPI depth" value="3 / 4" sub="Token-2022 → metahook → policy" />
          <Stat label="CU per transfer" value="33,346" sub="2 policies (16% of 200K)" />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ label: string; value: string; sub: string }> = ({ label, value, sub }) => (
  <div
    style={{
      padding: "16px 20px",
      backgroundColor: theme.surface,
      border: `1px solid ${theme.border}`,
      borderRadius: 10,
    }}
  >
    <div style={{ fontSize: 14, color: theme.textMute, fontFamily: theme.mono, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {label}
    </div>
    <div
      style={{
        fontSize: 36,
        fontWeight: 700,
        color: theme.text,
        fontFamily: theme.mono,
        letterSpacing: "-0.02em",
        marginTop: 4,
      }}
    >
      {value}
    </div>
    <div style={{ fontSize: 14, color: theme.textDim, marginTop: 4 }}>{sub}</div>
  </div>
);
