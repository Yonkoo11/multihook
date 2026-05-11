import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";

interface Props {
  text: string;
  /** Frame at which the caption starts fading in. Default 0. */
  startFrame?: number;
  /** Position from bottom in pixels. Default 90. */
  bottom?: number;
  fontSize?: number;
  maxWidth?: number;
}

/** Caption sequence — fades in 8 frames after startFrame, holds. */
export const Caption: React.FC<Props> = ({
  text,
  startFrame = 0,
  bottom = 90,
  fontSize = theme.fsCaption,
  maxWidth = 1500,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const opacity = interpolate(
    frame - startFrame,
    [0, 8],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const translate = interpolate(
    frame - startFrame,
    [0, 12],
    [12, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom,
        display: "flex",
        justifyContent: "center",
        opacity,
        transform: `translateY(${translate}px)`,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          maxWidth,
          padding: "20px 32px",
          backgroundColor: "rgba(10,14,22,0.78)",
          backdropFilter: "blur(12px)",
          border: `1px solid ${theme.borderStrong}`,
          borderRadius: 14,
          fontSize,
          lineHeight: 1.4,
          color: theme.text,
          fontWeight: 400,
          letterSpacing: "-0.01em",
          textAlign: "center",
          fontFamily: theme.sans,
        }}
      >
        {text}
      </div>
    </div>
  );
};
