import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme, styles } from "../theme";

const POINTS = [
  { label: "Token-2022 transfer hook", value: "shipped Q1 2024", value2: "(no public-good infra for compositions)" },
  { label: "BlackRock BUIDL", value: "$525,000 setup + 0.50% mgmt", value2: "via Securitize, March 2024" },
  { label: "Smaller issuers", value: "bespoke hook per mint", value2: "or skip compliance" },
  { label: "Public-good middle ground", value: "NONE", value2: "until now", hl: true },
];

export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={styles.page}>
      <div style={styles.ambient} />
      <div style={{ position: "relative", maxWidth: 1500, margin: "0 auto", paddingTop: 60 }}>
        <div
          style={{
            fontSize: theme.fsTitle,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: theme.text,
            opacity: titleOpacity,
            marginBottom: 40,
          }}
        >
          The gap
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {POINTS.map((p, i) => {
            const startFrame = 30 + i * 40;
            const opacity = interpolate(frame, [startFrame, startFrame + 18], [0, 1], { extrapolateRight: "clamp" });
            const tx = interpolate(frame, [startFrame, startFrame + 22], [-20, 0], { extrapolateRight: "clamp" });
            return (
              <div
                key={i}
                style={{
                  opacity,
                  transform: `translateX(${tx}px)`,
                  display: "grid",
                  gridTemplateColumns: "420px 1fr",
                  gap: 32,
                  alignItems: "baseline",
                  padding: "24px 32px",
                  backgroundColor: p.hl ? `${theme.fail}11` : theme.surface,
                  border: `1px solid ${p.hl ? `${theme.fail}55` : theme.border}`,
                  borderRadius: 12,
                }}
              >
                <div style={{ fontSize: 26, fontFamily: theme.mono, color: theme.textDim }}>
                  {p.label}
                </div>
                <div>
                  <div
                    style={{
                      fontSize: 32,
                      fontWeight: 700,
                      color: p.hl ? theme.fail : theme.text,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {p.value}
                  </div>
                  <div style={{ fontSize: 18, color: theme.textMute, marginTop: 4, fontFamily: theme.mono }}>
                    {p.value2}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
