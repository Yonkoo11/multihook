import React from "react";
import { Composition } from "remotion";
import { MetaHookTech, FPS, TOTAL_FRAMES } from "./MetaHookTech";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MetaHookTech"
        component={MetaHookTech}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};
