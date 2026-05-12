"use client";

import MuxPlayer from "@mux/mux-player-react";
import type { MuxPlayerCSSProperties, MuxPlayerProps } from "@mux/mux-player-react";

type Props = {
  playbackId: string;
  aspect?: "16/9" | "4/5";
  autoPlay?: boolean;
  poster?: string;
  objectFit?: "contain" | "cover";
  tokens?: MuxPlayerProps["tokens"];
};

export default function VideoPlayer({ playbackId, aspect = "16/9", autoPlay = false, poster, objectFit = "contain", tokens }: Props) {
  const aspectClass = aspect === "4/5" ? "aspect-[4/5]" : "aspect-video";
  const playerStyle = {
    display: "block",
    width: "100%",
    height: "100%",
    "--media-object-fit": objectFit,
  } as MuxPlayerCSSProperties;

  return (
    <div className="w-full">
      <div className={`${aspectClass} w-full overflow-hidden rounded-lg border border-[#1e1e1e] bg-[#111110]`}>
        <MuxPlayer
          playbackId={playbackId}
          primaryColor="#ffffff"
          secondaryColor="rgba(0, 0, 0, 0.72)"
          accentColor="oklch(0.65 0.14 240)"
          autoPlay={autoPlay}
          poster={poster}
          tokens={tokens}
          className="block h-full w-full"
          style={playerStyle}
        />
      </div>
    </div>
  );
}
