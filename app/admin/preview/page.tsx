"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";
import VideoPlayer from "@/components/VideoPlayer";

type WorkoutStep = {
  type?: "video";
  title: string;
  description: string;
  videoId?: string;
  sets?: string;
  repsOrHoldTime?: string;
  frequency?: string;
  section?: string;
  sectionTitle?: string;
  sectionDescription?: string;
};

type WorkoutBanner = {
  type: "banner";
  text: string;
};

type WorkoutItem = WorkoutStep | WorkoutBanner;

type VideoRecord = {
  id: string;
  mux_playback_id: string;
  title: string;
  description: string | null;
  level: string | null;
  category: string | null;
  duration_seconds: number | null;
};

const ADMIN_EMAILS = [
  "josh@anglemethod.com",
  "morgan@anglemethod.com",
  "ninagrishchenko2003@gmail.com",
];

const DEFAULT_FREQUENCY = "Handbalancing - 6x/week";
const DEFAULT_BANNER_TEXT = "Flexibility - 3x/week";
const LEGACY_FREQUENCY_LABELS: Record<string, string> = {
  "Handstand Practice - 6x/week": DEFAULT_FREQUENCY,
};

function getWorkoutFrequency(step: WorkoutStep): string {
  const frequency = step.frequency?.trim()
    || step.sectionDescription?.trim()
    || step.sectionTitle?.trim()
    || (step.section === "flexibility" ? "Flexibility - 3x/week" : DEFAULT_FREQUENCY);

  return LEGACY_FREQUENCY_LABELS[frequency] ?? frequency;
}

function isWorkoutBanner(item: WorkoutItem): item is WorkoutBanner {
  return item.type === "banner" || ("text" in item && !("title" in item));
}

export default function AdminPreviewPage() {
  const router = useRouter();
  const [isLoaded, setIsLoaded] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState("");
  const [workout, setWorkout] = useState<WorkoutItem[]>([]);
  const [muxVideoMap, setMuxVideoMap] = useState<Record<string, VideoRecord>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadPreview() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;

      const adminEmail = session?.user?.email?.toLowerCase() ?? null;
      if (!session?.access_token || !adminEmail || !ADMIN_EMAILS.includes(adminEmail)) {
        router.replace("/");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const userId = params.get("userId")?.trim() ?? "";
      const email = params.get("email")?.trim() ?? "";
      setPreviewEmail(email);
      setUserEmail(adminEmail);

      if (!userId) {
        setError("Missing userId for preview.");
        setIsLoaded(true);
        return;
      }

      const [workoutRes, videosRes] = await Promise.all([
        fetch(`/api/admin/workout?userId=${encodeURIComponent(userId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        fetch("/api/admin/videos", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (!isMounted) return;

      if (!workoutRes.ok) {
        setError("Could not load this user's workout.");
        setIsLoaded(true);
        return;
      }

      const workoutData = await workoutRes.json();
      const videosData = videosRes.ok ? await videosRes.json() : { videos: [] };
      const videos = (videosData.videos ?? []) as VideoRecord[];
      const videoMap = Object.fromEntries(videos.map(video => [video.id, video]));

      setWorkout(Array.isArray(workoutData.steps) ? workoutData.steps as WorkoutItem[] : []);
      setMuxVideoMap(videoMap);
      setIsLoaded(true);
    }

    loadPreview();
    return () => { isMounted = false; };
  }, [router]);

  const PreviewNav = (
    <Nav variant="minimal" isLoggedIn={!!userEmail} authReady={isLoaded} />
  );

  if (!isLoaded) {
    return (
      <>
        {PreviewNav}
        <main className="min-h-screen bg-[#0a0a0a] text-white">
          <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
            <div className="mx-auto max-w-6xl">
              <p className="text-[#777]">Loading preview...</p>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      {PreviewNav}
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <section className="pt-28 md:pt-40 pb-12 md:pb-28 px-4 sm:px-6 md:px-12">
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 md:mb-14 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="mb-4 md:mb-6">
                  <span className="rounded-full border border-blue-900 bg-[oklch(0.18_0.06_240)] px-3 py-1 text-xs font-medium text-[oklch(0.65_0.14_240)]">
                    Admin Preview
                  </span>
                </div>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                  style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 64px)" }}
                >
                  Your Training
                </h1>
                <p className="text-[#777]">
                  Read-only user dashboard preview{previewEmail ? ` for ${previewEmail}` : ""}.
                </p>
              </div>
              <Link
                href="/admin"
                className="self-start rounded-[4px] border border-[#222] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#999] transition-colors hover:border-[#444] hover:text-white sm:self-auto md:px-6 md:py-3"
              >
                Back To Admin
              </Link>
            </div>

            {error ? (
              <div className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-12 text-center">
                <p className="text-sm text-[#dc2626]">{error}</p>
              </div>
            ) : workout.length === 0 ? (
              <div className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-12 text-center">
                <div className="mb-6 flex justify-center">
                  <div
                    className="inline-flex items-center gap-2 rounded-full border border-green-900 px-3 py-1 text-[10px] font-medium uppercase tracking-widest md:text-xs"
                    style={{ backgroundColor: "oklch(0.18 0.06 155)", color: "oklch(0.68 0.14 155)" }}
                  >
                    Plan in progress
                  </div>
                </div>
                <h2
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                  style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(24px, 3vw, 32px)" }}
                >
                  Your Training System Is Being Prepared
                </h2>
                <p className="mx-auto max-w-md text-[#777]">
                  Your custom training program will appear here once it&apos;s been assigned to your account.
                </p>
              </div>
            ) : (
              <div className="space-y-8 md:space-y-10">
                {(() => {
                  let stepNumber = 0;

                  return workout.map((item, itemIndex) => {
                        if (isWorkoutBanner(item)) {
                          stepNumber = 0;
                          return (
                            <div
                              key={`banner-${item.text || "empty"}-${itemIndex}`}
                              className="border-l-2 border-white bg-[#111110] px-4 py-4 md:px-6 md:py-5"
                            >
                              <h2
                                className="break-words text-white uppercase tracking-wide"
                                style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(28px, 3vw, 38px)" }}
                              >
                                {item.text || DEFAULT_BANNER_TEXT}
                              </h2>
                            </div>
                          );
                        }

                        stepNumber += 1;
                        const muxVideo = item.videoId ? muxVideoMap[item.videoId] : undefined;
                        const displayDescription = item.description || muxVideo?.description || "";
                        const displayFrequency = getWorkoutFrequency(item);
                        return (
                          <div key={`${itemIndex}-${item.videoId ?? "missing"}`} className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-4 md:p-8">
                            <h3
                              className="text-white uppercase tracking-wide mb-4 md:mb-6"
                              style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(22px, 2.5vw, 28px)" }}
                            >
                              Step {stepNumber}: {item.title}
                            </h3>
                            {muxVideo ? (
                              <div className="mb-4 md:mb-6">
                                <VideoPlayer playbackId={muxVideo.mux_playback_id} />
                              </div>
                            ) : item.videoId ? (
                              <div className="aspect-video w-full mb-4 md:mb-6 rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-center">
                                <p className="text-[#666] text-xs tracking-widest uppercase">Video not found in library</p>
                              </div>
                            ) : null}
                            {(displayFrequency || item.sets || item.repsOrHoldTime) ? (
                              <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-xs tracking-widest uppercase">
                                {displayFrequency ? (
                                  <p className="text-[#aaa]"><span className="text-[#666]">Frequency:</span> {displayFrequency}</p>
                                ) : null}
                                {item.sets ? (
                                  <p className="text-[#aaa]"><span className="text-[#666]">Sets:</span> {item.sets}</p>
                                ) : null}
                                {item.repsOrHoldTime ? (
                                  <p className="text-[#aaa]"><span className="text-[#666]">Reps / Hold:</span> {item.repsOrHoldTime}</p>
                                ) : null}
                              </div>
                            ) : null}
                            {displayDescription ? (
                              <p className="whitespace-pre-line text-sm leading-relaxed text-[#aaa] md:text-base">{displayDescription}</p>
                            ) : null}
                          </div>
                        );
                      });
                })()}
              </div>
            )}

            <div className="mt-8 rounded-lg border border-[#1e1e1e] bg-[#111110] p-4 md:p-8">
              <p className="text-[#666] text-xs tracking-widest uppercase mb-3">Preview note</p>
              <p className="text-sm leading-relaxed text-[#777]">
                This read-only preview hides user actions like messaging, progress video uploads, checkout, and admin links.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
