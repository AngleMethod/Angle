"use client";

import MuxPlayer from "@mux/mux-player-react";

type Props = {
  playbackId: string;
  aspect?: "16/9" | "4/5";
  autoPlay?: boolean;
  poster?: string;
};

export default function VideoPlayer({ playbackId, aspect = "16/9", autoPlay = false, poster }: Props) {
  const aspectClass = aspect === "4/5" ? "aspect-[4/5]" : "aspect-video";
  return (
    <div className="w-full">
      <div className={`${aspectClass} w-full overflow-hidden rounded-lg border border-[#1e1e1e] bg-[#111110]`}>
        <MuxPlayer
          playbackId={playbackId}
          accentColor="#ffffff"
          autoPlay={autoPlay}
          poster={poster}
          className="block h-full w-full"
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
