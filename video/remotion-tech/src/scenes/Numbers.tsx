import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, styles } from "../theme";

const STATS: Array<{ label: string; value: string; sub: string }> = [
  { label: "ANCHOR PROGRAMS", value: "4", sub: "deployed devnet · MIT" },
  { label: "INTEGRATION TESTS", value: "7 / 7", sub: "passing on local validator" },
  { label: "CU PER TRANSFER", value: "33,346", sub: "2 policies · 16% of 200K budget" },
  { label: "CPI DEPTH", value: "3 / 4", sub: "Token-2022 → metahook → policy" },
  { label: "BUNDLED PROVISION", value: "1156 / 1232", sub: "bytes · single signTransaction" },
  { label: "MAX POLICIES (V1)", value: "8", sub: "config PDA hard cap" },
];

export const Numbers: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const titleOpacity = interpolate(frame, [0, 18], [0, 1], { extrapolateRight: "clamp" });

  const ctaSpring = spring({ frame: frame - 350, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={styles.page}>
      <div style={styles.ambient} />
      <div style={{ position: "relative", padding: "30px 80px", display: "flex", flexDirection: "column", height: "100%", justifyContent: "center" }}>
        <div
          style={{
            fontSize: theme.fsTitle,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            opacity: titleOpacity,
            marginBottom: 8,
          }}
        >
          Reality, not marketing.
        </div>
        <div
          style={{
            fontSize: 22,
            color: theme.textDim,
            fontFamily: theme.mono,
            marginBottom: 36,
            opacity: titleOpacity,
          }}
        >
          Numbers from `anchor build`, `anchor test`, `solana program show`.
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gridTemplateRows: "repeat(2, 1fr)",
            gap: 20,
            marginBottom: 40,
          }}
        >
          {STATS.map((s, i) => {
            const startFrame = 30 + i * 25;
            const opacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], { extrapolateRight: "clamp" });
            const ty = interpolate(frame, [startFrame, startFrame + 22], [16, 0], { extrapolateRight: "clamp" });
            return (
              <div
                key={i}
                style={{
                  opacity,
                  transform: `translateY(${ty}px)`,
                  padding: "28px 24px",
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 14,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    color: theme.textMute,
                    fontFamily: theme.mono,
                    letterSpacing: "0.08em",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 56,
                    fontWeight: 700,
                    color: theme.text,
                    fontFamily: theme.mono,
                    letterSpacing: "-0.03em",
                    marginTop: 6,
                    marginBottom: 6,
                    background: `linear-gradient(135deg, ${theme.text} 0%, ${theme.accent} 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {s.value}
                </div>
                <div style={{ fontSize: 15, color: theme.textDim, fontFamily: theme.mono }}>
                  {s.sub}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            opacity: ctaSpring,
            transform: `translateY(${(1 - ctaSpring) * 30}px)`,
            padding: "32px 40px",
            backgroundColor: theme.surface,
            border: `1px solid ${theme.accent}`,
            borderRadius: 14,
            boxShadow: `0 0 60px ${theme.accent}33`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 36,
              fontFamily: theme.mono,
              fontWeight: 600,
              color: theme.text,
              letterSpacing: "-0.02em",
            }}
          >
            github.com/Yonkoo11/multihook
          </div>
          <div
            style={{
              fontSize: 22,
              color: theme.textDim,
              marginTop: 10,
              fontFamily: theme.mono,
            }}
          >
            Fork it · Ship a policy · Open a PR
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
