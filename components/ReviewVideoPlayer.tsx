"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MuxPlayerProps } from "@mux/mux-player-react";
import { supabase } from "@/lib/supabase";
import VideoPlayer from "@/components/VideoPlayer";

type ReviewPlaybackTokens = {
  playback?: string;
  thumbnail?: string;
  storyboard?: string;
};

type Props = {
  submissionId: string;
  playbackId: string;
  tokens: ReviewPlaybackTokens;
};

const TOKEN_REFRESH_INTERVAL_MS = 50 * 60 * 1000;

export default function ReviewVideoPlayer({ submissionId, playbackId, tokens }: Props) {
  const [refreshedTokens, setRefreshedTokens] = useState<ReviewPlaybackTokens | null>(null);
  const [tokenVersion, setTokenVersion] = useState(0);
  const isRefreshingRef = useRef(false);
  const currentTokens = refreshedTokens ?? tokens;

  const refreshTokens = useCallback(async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;

      const res = await fetch("/api/dashboard/reviews/tokens", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ submissionId }),
      });

      const data = await res.json().catch(() => ({} as { tokens?: ReviewPlaybackTokens }));
      if (!res.ok || !data.tokens?.playback) return;

      setRefreshedTokens(data.tokens);
      setTokenVersion(version => version + 1);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [submissionId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshTokens();
    }, TOKEN_REFRESH_INTERVAL_MS);

    const refreshOnFocus = () => {
      void refreshTokens();
    };
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") void refreshTokens();
    };

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [refreshTokens]);

  const handleError: MuxPlayerProps["onError"] = useCallback(() => {
    void refreshTokens();
  }, [refreshTokens]);

  return (
    <VideoPlayer
      key={`${playbackId}-${tokenVersion}`}
      playbackId={playbackId}
      tokens={currentTokens}
      onError={handleError}
    />
  );
}
