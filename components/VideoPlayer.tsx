"use client";

import MuxPlayer from "@mux/mux-player-react";

type Props = {
  playbackId: string;
};

export default function VideoPlayer({ playbackId }: Props) {
  return (
    <div className="w-full">
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-[#1e1e1e] bg-[#111110]">
        <MuxPlayer
          playbackId={playbackId}
          accentColor="#ffffff"
          className="block h-full w-full"
          style={{ display: "block", width: "100%", height: "100%" }}
        />
      </div>
    </div>
  );
}
