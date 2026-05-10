"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as UpChunk from "@mux/upchunk";
import BookedRedirectHandler from "@/components/BookedRedirectHandler";
import Nav from "@/components/Nav";
import Button from "@/components/ui/Button";
import VideoPlayer from "@/components/VideoPlayer";

type WorkoutStep = {
  title: string;
  description: string;
  videoId?: string;
  sets?: string;
  repsOrHoldTime?: string;
};

type OnboardingStatus = "not_booked" | "booked" | "completed";
type ReviewUploadStage = "idle" | "uploading" | "saving" | "success" | "error";
type ReviewSubmissionStatus = "uploading" | "processing" | "submitted" | "reviewed" | "error";

type ReviewPlaybackTokens = {
  playback?: string;
  thumbnail?: string;
  storyboard?: string;
};

type ReviewSubmission = {
  id: string;
  note: string;
  status: ReviewSubmissionStatus;
  playbackId: string | null;
  playbackTokens: ReviewPlaybackTokens | null;
  durationSeconds: number | null;
  fileName: string | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  submittedAt: string | null;
  coachNote: string | null;
  reviewedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type MuxVideoRecord = {
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
];
const CALENDLY_URL = "https://calendly.com/josh-anglemethod/30min";
const MAX_REVIEW_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.max(1, Math.round(mb * 1000))} KB`;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

export default function Dashboard() {
  const router = useRouter();
  const reviewFileInputRef = useRef<HTMLInputElement | null>(null);

  const [isLoaded, setIsLoaded] = useState(false);
  const [showBookedBanner, setShowBookedBanner] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "redirecting">("checking");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>("not_booked");
  const [workout, setWorkout] = useState<WorkoutStep[]>([]);
  const [workoutLoaded, setWorkoutLoaded] = useState(false);
  const [muxVideoMap, setMuxVideoMap] = useState<Record<string, MuxVideoRecord>>({});
  const [reviewSubmissions, setReviewSubmissions] = useState<ReviewSubmission[]>([]);
  const [reviewsLoaded, setReviewsLoaded] = useState(false);
  const [reviewFile, setReviewFile] = useState<File | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [reviewUploadStage, setReviewUploadStage] = useState<ReviewUploadStage>("idle");
  const [reviewUploadProgress, setReviewUploadProgress] = useState(0);
  const [reviewUploadError, setReviewUploadError] = useState("");
  const [isCoachReviewOpen, setIsCoachReviewOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const syncDashboard = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (!session?.user) {
        setUserEmail(null);
        setHasAccess(false);
        setIsLoaded(true);
        setAuthStatus("redirecting");
        router.replace("/");
        return;
      }

      setUserId(session.user.id);
      setUserEmail(session.user.email ?? null);
      const isAdmin = ADMIN_EMAILS.includes((session.user.email ?? "").toLowerCase());

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status, onboarding_status")
        .eq("user_id", session.user.id)
        .single();

      if (!isMounted) return;

      if (!isAdmin && (!subscription || subscription.status !== "active")) {
        setHasAccess(false);
        setIsLoaded(true);
        setAuthStatus("authenticated");
        return;
      }

      setHasAccess(true);
      await loadReviewSubmissions(session.access_token);
      if (!isMounted) return;

      let status: OnboardingStatus = subscription?.onboarding_status ?? "not_booked";

      if (status === "completed" || isAdmin) {
        const { data: workoutData } = await supabase
          .from("user_workouts")
          .select("steps")
          .eq("user_id", session.user.id)
          .single();

        if (!isMounted) return;

        const assignedSteps = Array.isArray(workoutData?.steps) ? workoutData.steps : [];
        if (assignedSteps.length > 0) {
          setWorkout(assignedSteps);
          if (isAdmin) status = "completed";
        }

        setWorkoutLoaded(true);

        try {
          const lookupRes = await fetch("/api/dashboard/videos", {
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (lookupRes.ok) {
            const data = await lookupRes.json();
            if (!isMounted) return;
            setMuxVideoMap((data.videos ?? {}) as Record<string, MuxVideoRecord>);
          }
        } catch (err) {
          console.error("Mux video lookup failed:", err);
        }
      }

      setOnboardingStatus(status);

      setIsLoaded(true);
      setAuthStatus("authenticated");
    };

    syncDashboard();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) return;
      if (!session?.user) {
        setUserEmail(null);
        setHasAccess(false);
        setIsLoaded(true);
        setAuthStatus("redirecting");
        router.replace("/");
        return;
      }
      syncDashboard();
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function loadReviewSubmissions(accessToken?: string | null) {
    const token = accessToken ?? await getAccessToken();
    if (!token) return;

    try {
      const res = await fetch("/api/dashboard/reviews", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setReviewsLoaded(true);
        return;
      }

      const data = await res.json();
      setReviewSubmissions((data.submissions ?? []) as ReviewSubmission[]);
      setReviewsLoaded(true);
    } catch (err) {
      console.error("Review submissions lookup failed:", err);
      setReviewsLoaded(true);
    }
  }

  function resetReviewUpload() {
    setReviewFile(null);
    setReviewNote("");
    setReviewUploadProgress(0);
    setReviewUploadError("");
    if (reviewFileInputRef.current) {
      reviewFileInputRef.current.value = "";
    }
  }

  function handleReviewFileChange(file: File | null) {
    setReviewFile(file);
    setReviewUploadError("");
    setReviewUploadProgress(0);
    if (reviewUploadStage === "success") {
      setReviewUploadStage("idle");
    }
  }

  async function finalizeReviewUpload(token: string, submissionId: string, uploadId: string) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const saveRes = await fetch("/api/dashboard/reviews", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          submissionId,
          uploadId,
          note: reviewNote.trim(),
        }),
      });

      if (saveRes.ok) {
        await loadReviewSubmissions(token);
        setReviewUploadStage("success");
        resetReviewUpload();
        setTimeout(() => setReviewUploadStage("idle"), 2500);
        return;
      }

      const data = await saveRes.json().catch(() => ({} as { error?: string }));
      if (saveRes.status !== 409 || attempt === 5) {
        setReviewUploadError(data?.error || "Failed to submit video for review.");
        setReviewUploadStage("error");
        return;
      }

      await new Promise(r => setTimeout(r, 5000));
    }
  }

  async function handleReviewUpload() {
    if (!reviewFile) {
      setReviewUploadError("Pick a video file first.");
      return;
    }

    if (reviewFile.size > MAX_REVIEW_VIDEO_SIZE_BYTES) {
      setReviewUploadError("Video must be 500MB or smaller.");
      return;
    }

    if (reviewNote.trim().length > 2000) {
      setReviewUploadError("Note must be 2000 characters or fewer.");
      return;
    }

    const token = await getAccessToken();
    if (!token) {
      setReviewUploadError("Sign in again before uploading.");
      return;
    }

    setReviewUploadError("");
    setReviewUploadStage("uploading");
    setReviewUploadProgress(0);

    let createRes: Response;
    try {
      createRes = await fetch("/api/dashboard/reviews/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: reviewFile.name,
          fileSizeBytes: reviewFile.size,
          mimeType: reviewFile.type,
        }),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setReviewUploadError(`Network error creating upload: ${msg}`);
      setReviewUploadStage("error");
      return;
    }

    const createData = await createRes.json().catch(() => ({} as { error?: string; submissionId?: string; uploadId?: string; uploadUrl?: string }));
    if (!createRes.ok || !createData.submissionId || !createData.uploadId || !createData.uploadUrl) {
      setReviewUploadError(createData?.error || `Failed to create upload (HTTP ${createRes.status})`);
      setReviewUploadStage("error");
      return;
    }

    const upload = UpChunk.createUpload({
      endpoint: createData.uploadUrl,
      file: reviewFile,
      chunkSize: 30720,
    });

    upload.on("progress", (event) => {
      const percent = Number(event.detail);
      if (!Number.isNaN(percent)) {
        setReviewUploadProgress(Math.round(percent));
      }
    });

    upload.on("error", (event) => {
      const detail = event.detail as { message?: string } | undefined;
      setReviewUploadError(`Upload error: ${detail?.message ?? "unknown"}`);
      setReviewUploadStage("error");
    });

    upload.on("success", async () => {
      setReviewUploadStage("saving");
      await finalizeReviewUpload(token, createData.submissionId as string, createData.uploadId as string);
    });
  }

  async function handleUpgrade() {
    setIsUpgrading(true);
    setUpgradeError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userId ? { userId } : {}),
      });
      const data = await res.json();

      if (data?.url) {
        window.location.href = data.url;
      } else {
        setIsUpgrading(false);
        setUpgradeError("Unable to start checkout. Please try again.");
      }
    } catch {
      setIsUpgrading(false);
      setUpgradeError("Something went wrong. Please try again.");
    }
  }

  const DashboardNav = (
    <Nav variant="minimal" isLoggedIn={!!userEmail} authReady={isLoaded} />
  );

  const eyebrowPill = (() => {
    if (onboardingStatus === "completed") {
      const playlistAssigned = workoutLoaded && workout.length > 0;
      if (playlistAssigned) {
        return {
          label: "Coach-led",
          border: "border-blue-900",
          bg: "oklch(0.18 0.06 240)",
          text: "oklch(0.65 0.14 240)",
        };
      }
      return {
        label: "Built for you",
        border: "border-green-900",
        bg: "oklch(0.18 0.06 155)",
        text: "oklch(0.68 0.14 155)",
      };
    }
    if (onboardingStatus === "booked" || (onboardingStatus === "not_booked" && showBookedBanner)) {
      return {
        label: "Built for you",
        border: "border-green-900",
        bg: "oklch(0.18 0.06 155)",
        text: "oklch(0.68 0.14 155)",
      };
    }
    return {
      label: "Assessment",
      border: "border-purple-900",
      bg: "oklch(0.18 0.06 290)",
      text: "oklch(0.65 0.14 290)",
    };
  })();

  const reviewStatusStyles: Record<ReviewSubmissionStatus, string> = {
    uploading: "border-[#333] text-[#777]",
    processing: "border-blue-900 text-blue-300",
    submitted: "border-green-900 bg-[oklch(0.18_0.06_155)] text-[oklch(0.68_0.14_155)]",
    reviewed: "border-blue-900 bg-[oklch(0.18_0.06_240)] text-[oklch(0.65_0.14_240)]",
    error: "border-[#dc2626] text-[#dc2626]",
  };

  const reviewStatusLabels: Record<ReviewSubmissionStatus, string> = {
    uploading: "Uploading",
    processing: "Processing",
    submitted: "Submitted",
    reviewed: "Reviewed",
    error: "Error",
  };

  if (!isLoaded) {
    return (
      <>
        {DashboardNav}
        <main className="min-h-screen bg-[#0a0a0a] text-white">
          <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
            <div className="mx-auto max-w-6xl">
              <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Angle Member</p>
              <h1
                className="text-white uppercase leading-[0.95] tracking-wide mb-6"
                style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 64px)" }}
              >
                Your Training
              </h1>
              <p className="text-[#777]">
                {authStatus === "redirecting" ? "Redirecting..." : "Checking login..."}
              </p>
            </div>
          </section>
        </main>
      </>
    );
  }

  if (!hasAccess) {
    return (
      <>
        {DashboardNav}
        <main className="min-h-screen bg-[#0a0a0a] text-white">
          <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-4 sm:px-6 md:px-12">
            <div className="mx-auto max-w-xl text-center">
              <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Membership</p>
              <h1
                className="text-white uppercase leading-[0.95] tracking-wide mb-4 md:mb-6"
                style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 60px)" }}
              >
                Upgrade Required
              </h1>
              <p className="text-[#777] mb-10 md:mb-14">
                This training program is part of the paid Angle membership.
              </p>
              <Button onClick={handleUpgrade} disabled={isUpgrading} className="w-full sm:w-auto">
                {isUpgrading ? "Redirecting..." : "Upgrade to Access"}
              </Button>
              {upgradeError ? (
                <p className="mt-4 text-sm text-[#dc2626]">{upgradeError}</p>
              ) : null}
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      {DashboardNav}
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <section className="pt-28 md:pt-40 pb-12 md:pb-28 px-4 sm:px-6 md:px-12">
          <div className="mx-auto max-w-6xl">
            <Suspense fallback={null}>
              <BookedRedirectHandler onBooked={() => setShowBookedBanner(true)} />
            </Suspense>

<div className="mb-10 md:mb-14 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <div className="mb-4 md:mb-6">
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-medium border ${eyebrowPill.border}`}
                    style={{ backgroundColor: eyebrowPill.bg, color: eyebrowPill.text }}
                  >
                    {eyebrowPill.label}
                  </span>
                </div>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                  style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 64px)" }}
                >
                  Your Training
                </h1>
                {onboardingStatus === "completed" && workoutLoaded && workout.length > 0 ? null : (
                  <p className="text-[#777]">
                    {onboardingStatus === "not_booked"
                      ? showBookedBanner
                        ? "Your setup call is booked."
                        : "Your training starts with a short setup call."
                      : onboardingStatus === "booked"
                      ? "Your setup call is booked. We'll build your plan next."
                      : "We\u2019re working on your personalized video playlist."}
                  </p>
                )}
                {userEmail ? (
                  <p className="mt-2 text-sm text-[#555]">Signed in as {userEmail}</p>
                ) : null}
              </div>
              {userEmail && ADMIN_EMAILS.includes(userEmail) ? (
                <Link
                  href="/admin"
                  className="self-start sm:self-auto inline-block rounded-[4px] border border-[#222] text-[#999] text-xs font-bold tracking-widest uppercase px-4 py-2 md:px-6 md:py-3 hover:text-white hover:border-[#444] transition-colors"
                >
                  Open Admin
                </Link>
              ) : null}
            </div>

            {onboardingStatus === "not_booked" && (
              <>
                <div className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-12 text-center">
                  <div className="flex justify-center mb-6">
                    <div
                      className="inline-flex items-center gap-2 text-[10px] md:text-xs tracking-widest uppercase font-medium rounded-full px-3 py-1 border border-green-900"
                      style={{ backgroundColor: "oklch(0.18 0.06 155)", color: "oklch(0.68 0.14 155)" }}
                    >
                      {showBookedBanner ? "✔︎ Call Booked" : "✔︎ Payment Confirmed"}
                    </div>
                  </div>
                  <h2
                    className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                    style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(28px, 3.5vw, 40px)" }}
                  >
                    {showBookedBanner ? "You\u2019re Booked" : "You\u2019re In"}
                  </h2>
                  <p className={`text-[#777] max-w-md mx-auto ${showBookedBanner ? "" : "mb-8 md:mb-10"}`}>
                    {showBookedBanner
                      ? "Your setup call is scheduled. We\u2019ll use it to map your level and build your personalized training plan."
                      : "Your assessment starts now. Book your setup call so we can understand your level and build your plan."}
                  </p>
                  {!showBookedBanner && (
                    <a
                      href={CALENDLY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block w-full rounded-[4px] bg-white text-center text-black font-bold text-sm tracking-widest uppercase px-8 py-4 hover:bg-[#e0e0e0] transition-colors sm:w-auto"
                    >
                      Book Your Call
                    </a>
                  )}
                </div>
              </>
            )}

            {onboardingStatus === "booked" && (
              <div className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-12 text-center">
                <div className="flex justify-center mb-6">
                  <div
                    className="inline-flex items-center gap-2 text-[10px] md:text-xs tracking-widest uppercase font-medium rounded-full px-3 py-1 border border-green-900"
                    style={{ backgroundColor: "oklch(0.18 0.06 155)", color: "oklch(0.68 0.14 155)" }}
                  >
                    ✔︎ Call Booked
                  </div>
                </div>
                <h2
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                  style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(28px, 3.5vw, 40px)" }}
                >
                  You&apos;re Scheduled
                </h2>
                <p className="text-[#777] max-w-md mx-auto">
                  We&apos;ll use your call to understand your level and build your training plan.
                </p>
              </div>
            )}

            {onboardingStatus === "completed" && (
              <>
                {!workoutLoaded ? (
                  <p className="text-[#777]">Loading your workout...</p>
                ) : workout.length === 0 ? (
                  <div className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-12 text-center">
                    <div className="flex justify-center mb-6">
                      <div
                        className="inline-flex items-center gap-2 text-[10px] md:text-xs tracking-widest uppercase font-medium rounded-full px-3 py-1 border border-green-900"
                        style={{ backgroundColor: "oklch(0.18 0.06 155)", color: "oklch(0.68 0.14 155)" }}
                      >
                        ● Plan in progress
                      </div>
                    </div>
                    <h2
                      className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                      style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(24px, 3vw, 32px)" }}
                    >
                      Your Training System Is Being Prepared
                    </h2>
                    <p className="text-[#777] max-w-md mx-auto">
                      Your custom training program will appear here once it&apos;s been assigned to your account.
                    </p>
                    <p className="text-xs md:text-sm text-white/50 mt-4 max-w-md mx-auto">
                      This usually takes 1–2 hours — check back soon or refresh this page.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 md:space-y-6">
                    {workout.map((step, i) => {
                      const muxVideo = step.videoId ? muxVideoMap[step.videoId] : undefined;
                      return (
                        <div key={`${step.videoId ?? "missing"}-${i}`} className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-4 md:p-8">
                          <h2
                            className="text-white uppercase tracking-wide mb-4 md:mb-6"
                            style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(22px, 2.5vw, 28px)" }}
                          >
                            Step {i + 1}: {step.title}
                          </h2>
                          {muxVideo ? (
                            <div className="mb-4 md:mb-6">
                              <VideoPlayer playbackId={muxVideo.mux_playback_id} />
                            </div>
                          ) : step.videoId ? (
                            <div className="aspect-video w-full mb-4 md:mb-6 rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-center">
                              <p className="text-[#666] text-xs tracking-widest uppercase">Video not found in library</p>
                            </div>
                          ) : null}
                          {(step.sets || step.repsOrHoldTime) ? (
                            <div className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-xs tracking-widest uppercase">
                              {step.sets ? (
                                <p className="text-[#aaa]"><span className="text-[#666]">Sets:</span> {step.sets}</p>
                              ) : null}
                              {step.repsOrHoldTime ? (
                                <p className="text-[#aaa]"><span className="text-[#666]">Reps / Hold:</span> {step.repsOrHoldTime}</p>
                              ) : null}
                            </div>
                          ) : null}
                          {step.description ? (
                            <p className="whitespace-pre-line text-sm leading-relaxed text-[#aaa] md:text-base">{step.description}</p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            <div className="mt-8 md:mt-14 rounded-lg border border-[#1e1e1e] bg-[#111110] p-4 md:p-8">
              <div className={`${isCoachReviewOpen ? "mb-6 md:mb-8" : ""} flex items-start justify-between gap-4`}>
                <div className="min-w-0">
                  <p className="text-[#666] text-xs tracking-widest uppercase mb-3">Coach Review</p>
                  <h2
                    className="text-white uppercase tracking-wide mb-2"
                    style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(24px, 3vw, 34px)" }}
                  >
                    Submit A Progress Video
                  </h2>
                  <p className="text-[#777] text-sm md:text-base">
                    Upload a short clip.
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label={isCoachReviewOpen ? "Collapse coach review" : "Expand coach review"}
                    aria-expanded={isCoachReviewOpen}
                    aria-controls="coach-review-panel"
                    onClick={() => setIsCoachReviewOpen(prev => !prev)}
                    className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#222] text-[#999] hover:text-white hover:border-[#444] transition-colors"
                  >
                    <span
                      aria-hidden="true"
                      className={`block h-2 w-2 border-b-2 border-r-2 border-current transition-transform ${isCoachReviewOpen ? "rotate-[225deg] translate-y-0.5" : "rotate-45 -translate-y-0.5"}`}
                    />
                  </button>
                </div>
              </div>

              {isCoachReviewOpen ? (
                <div id="coach-review-panel" className="grid grid-cols-1 gap-6 md:gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Video file</label>
                      <input
                        ref={reviewFileInputRef}
                        type="file"
                        accept="video/mp4,video/quicktime,video/mov,.mov,.mp4,video/*"
                        onChange={(e) => handleReviewFileChange(e.target.files?.[0] ?? null)}
                        disabled={reviewUploadStage === "uploading" || reviewUploadStage === "saving"}
                        className="block w-full max-w-full text-sm text-[#aaa] file:mr-3 file:rounded-[4px] file:border-0 file:bg-[#222] file:px-4 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-widest file:text-white file:cursor-pointer disabled:opacity-40"
                      />
                      {reviewFile ? (
                        <div className="mt-3 rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] px-4 py-3">
                          <p className="truncate text-sm text-white">{reviewFile.name}</p>
                          <p className="mt-1 text-xs text-[#666]">{formatFileSize(reviewFile.size)} selected</p>
                        </div>
                      ) : null}
                    </div>

                  <div>
                    <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Question or note</label>
                    <textarea
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      rows={5}
                      maxLength={2000}
                      placeholder="What should we look at?"
                      disabled={reviewUploadStage === "uploading" || reviewUploadStage === "saving"}
                      className="w-full rounded-lg bg-[#0a0a0a] border border-[#222] text-white px-4 py-3 text-sm placeholder-[#444] focus:outline-none focus:border-[#555] disabled:opacity-40"
                    />
                  </div>

                  {reviewUploadStage === "uploading" ? (
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[#777] text-xs tracking-widest uppercase">Uploading video</p>
                        <p className="text-[#aaa] text-xs">{reviewUploadProgress}%</p>
                      </div>
                      <div className="h-1 bg-[#1e1e1e] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-200"
                          style={{ width: `${reviewUploadProgress}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-[#555]">Keep this page open while your clip uploads.</p>
                    </div>
                  ) : null}

                  {reviewUploadStage === "saving" ? (
                    <p className="text-[#aaa] text-sm">Processing video... this can take a minute.</p>
                  ) : null}

                  {reviewUploadStage === "success" ? (
                    <p className="text-sm" style={{ color: "oklch(0.68 0.14 155)" }}>Submitted for review.</p>
                  ) : null}

                  {reviewUploadError ? (
                    <p className="text-sm text-[#dc2626]">{reviewUploadError}</p>
                  ) : null}

                  <Button
                    onClick={handleReviewUpload}
                    disabled={reviewUploadStage === "uploading" || reviewUploadStage === "saving"}
                    size="md"
                    className="w-full sm:w-auto"
                  >
                    {reviewUploadStage === "uploading"
                      ? "Uploading..."
                      : reviewUploadStage === "saving"
                      ? "Processing..."
                      : "Submit Video"}
                  </Button>
                </div>

                <div>
                  <h3 className="text-[#777] text-xs tracking-widest uppercase mb-4">Your Submissions</h3>
                  {!reviewsLoaded ? (
                    <p className="text-[#777] text-sm">Loading submissions...</p>
                  ) : reviewSubmissions.length === 0 ? (
                    <div className="rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] p-5">
                      <p className="text-[#777] text-sm">No progress videos yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {reviewSubmissions.map((submission) => (
                        <div key={submission.id} className="rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] p-3 md:p-4">
                          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                            <span className={`rounded-full border px-3 py-1 text-xs font-medium ${reviewStatusStyles[submission.status]}`}>
                              {reviewStatusLabels[submission.status]}
                            </span>
                            <p className="text-[#555] text-xs">
                              {new Date(submission.submittedAt ?? submission.createdAt).toLocaleDateString()}
                            </p>
                          </div>

                          {submission.playbackId && submission.playbackTokens ? (
                            <div className="mb-4">
                              <VideoPlayer playbackId={submission.playbackId} tokens={submission.playbackTokens} />
                            </div>
                          ) : null}

                          {submission.note ? (
                            <p className="text-[#aaa] text-sm leading-relaxed mb-3">{submission.note}</p>
                          ) : null}

                          {submission.coachNote ? (
                            <div className="rounded-lg border border-blue-900 bg-[oklch(0.18_0.06_240)] p-4">
                              <p className="text-[oklch(0.65_0.14_240)] text-xs font-medium mb-2">Coach note</p>
                              <p className="text-white text-sm leading-relaxed">{submission.coachNote}</p>
                            </div>
                          ) : submission.status === "submitted" ? (
                            <p className="text-[#666] text-sm">Coach review pending.</p>
                          ) : submission.status === "processing" || submission.status === "uploading" ? (
                            <p className="text-[#666] text-sm">Video is still processing.</p>
                          ) : submission.errorMessage ? (
                            <p className="text-[#dc2626] text-sm">{submission.errorMessage}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              ) : null}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
