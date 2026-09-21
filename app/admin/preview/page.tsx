"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";
import TrainingSession from "@/components/TrainingSession";

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
  "josh@angle.coach",
  "morgan@anglemethod.com",
  "ninagrishchenko2003@gmail.com",
];

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
        <main className="min-h-screen bg-[#111310] text-white">
          <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
            <div className="mx-auto max-w-6xl">
              <p className="text-[#b6beaa]">Loading preview...</p>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      {PreviewNav}
      <main className="min-h-screen bg-[#111310] text-white">
        <section className="pt-28 md:pt-40 pb-12 md:pb-28 px-4 sm:px-6 md:px-12">
          <div className="mx-auto max-w-6xl">
            <div data-workspace-heading className="mb-10 md:mb-14 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="min-w-0">
                <div className="mb-4 md:mb-6">
                  <span className="rounded-none border border-[#4b543c] bg-[#293321] px-3 py-1 text-xs font-medium text-[#d6ed9b]">
                    Admin Preview
                  </span>
                </div>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                >
                  Your <em>training.</em>
                </h1>
                <p className="text-[#b6beaa]">
                  Read-only user dashboard preview{previewEmail ? ` for ${previewEmail}` : ""}.
                </p>
              </div>
              <Link
                href="/admin"
                className="self-start rounded-none border border-[#4b543c] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#c1c8b7] transition-colors hover:border-[#d6ed9b] hover:text-white sm:self-auto md:px-6 md:py-3"
              >
                Back To Admin
              </Link>
            </div>

            {error ? (
              <div data-surface="paper" className="rounded-none border border-[#4b543c] bg-[#22261d] p-6 md:p-12 text-center">
                <p className="text-sm text-[#dc2626]">{error}</p>
              </div>
            ) : workout.length === 0 ? (
              <div data-surface="paper" className="rounded-none border border-[#4b543c] bg-[#22261d] p-6 md:p-12 text-center">
                <div className="mb-6 flex justify-center">
                  <div
                    className="inline-flex items-center gap-2 rounded-none border border-[#4b543c] px-3 py-1 text-[10px] font-medium uppercase tracking-widest md:text-xs"
                    style={{ backgroundColor: "#293321", color: "#d6ed9b" }}
                  >
                    Plan in progress
                  </div>
                </div>
                <h2
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                >
                  Your Training System Is Being Prepared
                </h2>
                <p className="mx-auto max-w-md text-[#b6beaa]">
                  Your custom training program will appear here once it&apos;s been assigned to your account.
                </p>
              </div>
            ) : (
              <TrainingSession workout={workout} videos={muxVideoMap} preview />
            )}

            <div className="mt-8 rounded-none border border-[#4b543c] bg-[#22261d] p-4 md:p-8">
              <p className="text-[#adb5a0] text-xs tracking-widest uppercase mb-3">Preview note</p>
              <p className="text-sm leading-relaxed text-[#b6beaa]">
                This read-only preview hides user actions like messaging, progress video uploads, checkout, and admin links.
              </p>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
