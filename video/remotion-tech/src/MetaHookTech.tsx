import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { Hero } from "./scenes/Hero";
import { Problem } from "./scenes/Problem";
import { Architecture } from "./scenes/Architecture";
import { Interface } from "./scenes/Interface";
import { SnsTriple } from "./scenes/SnsTriple";
import { OnChainProof } from "./scenes/OnChainProof";
import { Composability } from "./scenes/Composability";
import { Numbers } from "./scenes/Numbers";

// Scene durations (in seconds at 30fps)
// Total: 12 + 18 + 25 + 25 + 35 + 28 + 25 + 20 = 188s
export const SCENES = [
  { id: "hero", component: Hero, durationS: 12 },
  { id: "problem", component: Problem, durationS: 18 },
  { id: "architecture", component: Architecture, durationS: 25 },
  { id: "interface", component: Interface, durationS: 25 },
  { id: "sns", component: SnsTriple, durationS: 35 },
  { id: "proof", component: OnChainProof, durationS: 28 },
  { id: "compose", component: Composability, durationS: 25 },
  { id: "numbers", component: Numbers, durationS: 20 },
];

export const FPS = 30;
export const TOTAL_FRAMES = SCENES.reduce((sum, s) => sum + s.durationS * FPS, 0);

export const MetaHookTech: React.FC = () => {
  let cumulative = 0;
  return (
    <AbsoluteFill>
      {SCENES.map((scene) => {
        const Component = scene.component;
        const durationFrames = scene.durationS * FPS;
        const from = cumulative;
        cumulative += durationFrames;
        return (
          <Sequence key={scene.id} from={from} durationInFrames={durationFrames}>
            <Component />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
