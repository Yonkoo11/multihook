import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme, styles } from "../theme";

export const Hero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100 },
  });
  const subtitleOpacity = interpolate(frame, [20, 40], [0, 1], { extrapolateRight: "clamp" });
  const stackOpacity = interpolate(frame, [50, 90], [0, 1], { extrapolateRight: "clamp" });
  const taglineOpacity = interpolate(frame, [180, 220], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={styles.page}>
      <div style={styles.ambient} />
      <AbsoluteFill style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", padding: 80 }}>
        <div
          style={{
            fontFamily: theme.mono,
            fontSize: theme.fsHero,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            opacity: titleSpring,
            transform: `translateY(${(1 - titleSpring) * 30}px)`,
            background: `linear-gradient(135deg, ${theme.accent} 0%, ${theme.highlight1} 100%)`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            marginBottom: 12,
          }}
        >
          Multi-Hook
        </div>
        <div
          style={{
            fontSize: theme.fsSubtitle,
            color: theme.textDim,
            opacity: subtitleOpacity,
            marginBottom: 60,
            letterSpacing: "-0.02em",
          }}
        >
          Composable Token-2022 compliance
        </div>

        {/* Architecture stack visual */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 18,
            opacity: stackOpacity,
          }}
        >
          <Box label="Token-2022.transferChecked" mono />
          <Arrow label="CPI" />
          <Box label="metahook.execute" mono accent />
          <Arrow label="reads MetaHookConfig PDA · loops · AND" />
          <div style={{ display: "flex", gap: 14 }}>
            <Box label="policy-allowlist" mono small />
            <Box label="policy-sanctions-ofac" mono small />
            <Box label="policy-sns-allowlist" mono small />
          </div>
        </div>

        <div
          style={{
            marginTop: 60,
            fontSize: theme.fsBody,
            color: theme.textMute,
            fontFamily: theme.mono,
            opacity: taglineOpacity,
          }}
        >
          One meta-hook · N child policies · per-mint config PDA
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const Box: React.FC<{ label: string; mono?: boolean; accent?: boolean; small?: boolean }> = ({
  label, mono, accent, small,
}) => (
  <div
    style={{
      padding: small ? "10px 18px" : "14px 28px",
      backgroundColor: accent ? `${theme.accent}22` : theme.surface,
      border: `1px solid ${accent ? theme.accent : theme.borderStrong}`,
      borderRadius: 10,
      fontFamily: mono ? theme.mono : theme.sans,
      fontSize: small ? 18 : 22,
      color: accent ? theme.text : theme.textDim,
      boxShadow: accent ? `0 0 30px ${theme.accent}33` : "none",
    }}
  >
    {label}
  </div>
);

const Arrow: React.FC<{ label: string }> = ({ label }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
    <div style={{ fontSize: 18, color: theme.textMute, fontFamily: theme.mono }}>{label}</div>
    <div style={{ width: 2, height: 22, background: theme.borderStrong }} />
  </div>
);
