import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme, styles } from "../theme";
import { CodeBlock } from "../components/CodeBlock";

// Real terminal output from `node scripts/diagnose-transfer-flow.mjs`,
// captured live against deployed V1.1 bytecode. Each line appears in
// sequence — typewriter style.

const TERMINAL_LINES = [
  "$ node scripts/diagnose-transfer-flow.mjs",
  "test wallet: CDi6FQiTqCXxKcw7XG7qSspWsntZg932aHiJtToknMX",
  "balance:     4.4351 SOL",
  "fresh mint:  6CW9Jpv28sYpSv5FqKHYYQZMDLq7rfetDFcY9TSpx6ig",
  "",
  "[1/4] provisioning fresh mint with V1.1 config...",
  "     provision tx: 967 bytes, sig=3wAPiznktz1TZSvW…",
  "",
  "[2/4] attempting transfer to non-allowlisted dest (expect REJECT)...",
  "     ✅ rejected with policy.allowlist.fail",
  "",
  "[3/4] adding dest to allowlist...",
  "     add_allowed sig: 3zWK33DPKSujgQUE…",
  "",
  "[4/4] retrying transfer (expect APPROVE + audit event)...",
  "     transfer sig: 3UgjEfRpgvZKeHvk…",
  "",
  "on-chain logs:",
  "  Program log: metahook: execute mint=6CW9… policies=2",
  "  Program log: Instruction: CheckTransfer",
  "  Program log: Instruction: CheckTransfer",
  "  Program log: MetaHookAuditEvent: final=true failed_policy=-1",
  "  Program data: 1AdcNvlhkkEBTTzGoIaleSho1azr2fL4eHRP…",
  "",
  "✅ FULL TRANSFER FLOW WORKS ON V1.1 DEVNET BYTECODE",
];

export const OnChainProof: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  // Lines appear progressively: each line takes 8 frames to reveal
  const visibleLines = Math.min(
    TERMINAL_LINES.length,
    Math.floor(Math.max(0, frame - 40) / 8) + 1,
  );
  const visibleCode = TERMINAL_LINES.slice(0, visibleLines).join("\n");

  const solscanOpacity = interpolate(frame, [600, 660], [0, 1], { extrapolateRight: "clamp" });

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
          Devnet bytecode. Real keypair. Solscan-confirmed.
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
          Not local validator. Not a mock. The deployed program.
        </div>

        <CodeBlock
          code={visibleCode}
          lang="shell"
          fileName="zsh — diagnose-transfer-flow.mjs"
          fontSize={18}
          showLineNumbers={false}
        />

        <div
          style={{
            marginTop: 20,
            padding: "16px 22px",
            backgroundColor: `${theme.pass}11`,
            border: `1px solid ${theme.pass}55`,
            borderRadius: 10,
            opacity: solscanOpacity,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: 14, color: theme.textMute, fontFamily: theme.mono, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              SOLSCAN — APPROVE TX
            </div>
            <div style={{ fontFamily: theme.mono, fontSize: 18, color: theme.text, marginTop: 4 }}>
              solscan.io/tx/3UgjEfRpgvZKeHvk…?cluster=devnet
            </div>
          </div>
          <div style={{ fontSize: 14, color: theme.pass, fontFamily: theme.mono }}>
            confirmed · slot 461511316 · MetaHookAuditEvent in logs
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
