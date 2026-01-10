import React from "react";
import { Composition } from "remotion";
import { RankingComposition } from "./RankingComposition";
import type { RenderSpec } from "../features/ranking/types";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="RankingVideo"
        component={RankingComposition}
        durationInFrames={300} // Default, will be overridden by input props in execution
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          spec: {
            fps: 30,
            sequence: [],
            mainTitle: [],
            slots: [],
          } as RenderSpec,
        }}
      />
    </>
  );
};
