"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";
import Button from "@/components/ui/Button";
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

type VideoOption = {
  id: string;
  mux_playback_id: string;
  title: string;
  description: string | null;
  level: string | null;
  category: string | null;
};

type ActiveUserOption = {
  userId: string;
  email: string;
  onboardingStatus: OnboardingStatus;
};

type OnboardingStatus = "not_booked" | "booked" | "completed";
type ReviewSubmissionStatus = "uploading" | "processing" | "submitted" | "reviewed" | "error";

type ReviewPlaybackTokens = {
  playback?: string;
  thumbnail?: string;
  storyboard?: string;
};

type RecentSubmission = {
  id: string;
  note: string;
  status: ReviewSubmissionStatus;
  playbackId: string | null;
  playbackTokens: ReviewPlaybackTokens | null;
  durationSeconds: number | null;
  fileName: string | null;
  submittedAt: string | null;
  coachNote: string | null;
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
};

const ADMIN_EMAILS = [
  "josh@anglemethod.com",
  "morgan@anglemethod.com",
  "ninagrishchenko2003@gmail.com",
];

const STATUS_LABELS: Record<OnboardingStatus, string> = {
  not_booked: "Not Booked",
  booked: "Booked",
  completed: "Completed",
};

const REVIEW_STATUS_LABELS: Record<ReviewSubmissionStatus, string> = {
  uploading: "Uploading",
  processing: "Processing",
  submitted: "Submitted",
  reviewed: "Reviewed",
  error: "Error",
};

const REVIEW_STATUS_STYLES: Record<ReviewSubmissionStatus, string> = {
  uploading: "border-[#333] text-[#777]",
  processing: "border-blue-900 text-blue-300",
  submitted: "border-green-900 bg-[oklch(0.18_0.06_155)] text-[oklch(0.68_0.14_155)]",
  reviewed: "border-blue-900 bg-[oklch(0.18_0.06_240)] text-[oklch(0.65_0.14_240)]",
  error: "border-[#dc2626] text-[#dc2626]",
};

const DEFAULT_FREQUENCY = "Handbalancing - 6x/week";
const DEFAULT_BANNER_TEXT = "Flexibility - 3x/week";

function getWorkoutFrequency(step: Partial<WorkoutStep>): string {
  if (step.frequency?.trim()) return step.frequency.trim();
  if (step.sectionDescription?.trim()) return step.sectionDescription.trim();
  if (step.sectionTitle?.trim()) return step.sectionTitle.trim();
  if (step.section === "flexibility") return "Flexibility - 3x/week";
  return DEFAULT_FREQUENCY;
}

function isWorkoutBanner(item: WorkoutItem): item is WorkoutBanner {
  return item.type === "banner";
}

function formatSubmissionDate(value: string | null): string {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString();
}

function getMuxThumbnailUrl(playbackId: string): string {
  return `https://image.mux.com/${encodeURIComponent(playbackId)}/thumbnail.jpg?time=1&width=320&fit_mode=smartcrop`;
}

export default function AdminPage() {
  const router = useRouter();

  const [isLoaded, setIsLoaded] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupStatus, setLookupStatus] = useState<"idle" | "loading" | "not-found" | "found">("idle");
  const [assignedUserId, setAssignedUserId] = useState<string | null>(null);
  const [assignedUserEmail, setAssignedUserEmail] = useState<string | null>(null);
  const [assignedOnboardingStatus, setAssignedOnboardingStatus] = useState<OnboardingStatus>("not_booked");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUserOption[]>([]);
  const [activeUsersLoaded, setActiveUsersLoaded] = useState(false);
  const [activeUserDropdownOpen, setActiveUserDropdownOpen] = useState(false);

  const [workout, setWorkout] = useState<WorkoutItem[]>([]);
  const [goals, setGoals] = useState("");
  const [isGoalsOpen, setIsGoalsOpen] = useState(false);
  const [isProgramOpen, setIsProgramOpen] = useState(false);
  const [recentSubmissions, setRecentSubmissions] = useState<RecentSubmission[]>([]);
  const [recentSubmissionsLoaded, setRecentSubmissionsLoaded] = useState(false);
  const [recentSubmissionsError, setRecentSubmissionsError] = useState("");
  const [isRecentSubmissionsOpen, setIsRecentSubmissionsOpen] = useState(false);
  const [openSubmissionIds, setOpenSubmissionIds] = useState<Record<string, boolean>>({});
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [video, setVideo] = useState("");
  const [sets, setSets] = useState("");
  const [repsOrHoldTime, setRepsOrHoldTime] = useState("");
  const [frequency, setFrequency] = useState(DEFAULT_FREQUENCY);
  const [addStepError, setAddStepError] = useState("");

  const [videoLibrary, setVideoLibrary] = useState<VideoOption[]>([]);
  const [videoLibraryLoaded, setVideoLibraryLoaded] = useState(false);
  const [videoSearch, setVideoSearch] = useState("");

  useEffect(() => {
    let isMounted = true;

    const syncAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;

      const email = session?.user?.email ?? null;
      if (!email || !ADMIN_EMAILS.includes(email)) {
        router.replace("/");
        return;
      }

      setUserEmail(email);
      setAuthChecked(true);
      setIsLoaded(true);
    };

    syncAdmin();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      if (!isMounted) return;
      syncAdmin();
    });

    const handlePageShow = () => syncAdmin();
    window.addEventListener("pageshow", handlePageShow);
    document.addEventListener("visibilitychange", handlePageShow);

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      window.removeEventListener("pageshow", handlePageShow);
      document.removeEventListener("visibilitychange", handlePageShow);
    };
  }, [router]);

  async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;
    const loadAdminData = async () => {
      const token = await getAccessToken();

      const [videosRes, activeUsersRes] = await Promise.all([
        fetch("/api/admin/videos", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/admin/active-users", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (cancelled) return;

      if (videosRes.ok) {
        const data = await videosRes.json();
        if (!cancelled) setVideoLibrary(data.videos ?? []);
      }
      setVideoLibraryLoaded(true);

      if (activeUsersRes.ok) {
        const data = await activeUsersRes.json();
        if (!cancelled) setActiveUsers(data.users ?? []);
      }
      setActiveUsersLoaded(true);
    };

    loadAdminData();
    return () => { cancelled = true; };
  }, [isLoaded]);

  async function handleLookupUser(emailOverride?: string) {
    const emailToLookup = (emailOverride ?? lookupEmail).trim();
    if (!emailToLookup) return;

    setLookupEmail(emailToLookup);
    setActiveUserDropdownOpen(false);
    setLookupStatus("loading");
    setAssignedUserId(null);
    setAssignedUserEmail(null);
    setWorkout([]);
    setFrequency(DEFAULT_FREQUENCY);
    setGoals("");
    setIsGoalsOpen(false);
    setIsProgramOpen(false);
    setRecentSubmissions([]);
    setRecentSubmissionsLoaded(false);
    setRecentSubmissionsError("");
    setIsRecentSubmissionsOpen(false);
    setOpenSubmissionIds({});

    const token = await getAccessToken();
    const res = await fetch("/api/admin/lookup-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: emailToLookup }),
    });

    if (!res.ok) {
      setLookupStatus("not-found");
      return;
    }

    const { userId, onboardingStatus } = await res.json();

    const [workoutRes, reviewsRes] = await Promise.all([
      fetch(`/api/admin/workout?userId=${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`/api/admin/reviews?userId=${encodeURIComponent(userId)}&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    const workoutData = workoutRes.ok ? await workoutRes.json() : { steps: [], goals: "" };
    const reviewsData = reviewsRes.ok ? await reviewsRes.json() : { submissions: [] };

    setAssignedUserId(userId);
    setAssignedUserEmail(emailToLookup);
    setAssignedOnboardingStatus(onboardingStatus ?? "not_booked");
    setGoals(typeof workoutData.goals === "string" ? workoutData.goals : "");
    setRecentSubmissions((reviewsData.submissions ?? []) as RecentSubmission[]);
    setRecentSubmissionsLoaded(true);
    setRecentSubmissionsError(reviewsRes.ok ? "" : "Could not load recent submissions.");
    const loadedSteps = (workoutData.steps ?? []).map((s: WorkoutItem) => {
      if (isWorkoutBanner(s)) {
        return {
          type: "banner" as const,
          text: s.text?.trim() || DEFAULT_BANNER_TEXT,
        };
      }

      return {
        ...s,
        type: "video" as const,
        videoId: s.videoId || undefined,
        sets: s.sets ?? "",
        repsOrHoldTime: s.repsOrHoldTime ?? "",
        frequency: getWorkoutFrequency(s),
      };
    });
    setWorkout(loadedSteps);
    setLookupStatus("found");
  }

  async function handleUpdateStatus(status: OnboardingStatus) {
    if (!assignedUserId) return;
    setUpdatingStatus(true);

    const token = await getAccessToken();
    const res = await fetch("/api/admin/onboarding-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: assignedUserId, status }),
    });
    const result = await res.json().catch(() => null);
    console.log("Status update result:", result);

    setAssignedOnboardingStatus(status);
    setUpdatingStatus(false);
  }

  async function handleSaveWorkout() {
    if (!assignedUserId) return;
    setSaveStatus("saving");

    let stepsToSave = workout;
    const pendingVideoId = video.trim();
    const pendingVideo = pendingVideoId
      ? videoLibrary.find(v => v.id === pendingVideoId) ?? null
      : null;
    const pendingVideoDescription = pendingVideo?.description?.trim() ?? "";
    const hasPendingStep = !!(
      title.trim() ||
      description.trim() ||
      pendingVideoId ||
      sets.trim() ||
      repsOrHoldTime.trim()
    );
    if (hasPendingStep) {
      const pendingStep: WorkoutStep = {
        type: "video",
        title: title.trim() || pendingVideo?.title.trim() || `Step ${workout.length + 1}`,
        description: description.trim() || pendingVideoDescription,
        sets: sets.trim(),
        repsOrHoldTime: repsOrHoldTime.trim(),
        frequency: frequency.trim() || DEFAULT_FREQUENCY,
      };
      if (pendingVideoId) pendingStep.videoId = pendingVideoId;

      const alreadyAdded = workout.some(
        (s) =>
          !isWorkoutBanner(s) &&
          s.title === pendingStep.title &&
          s.description === pendingStep.description &&
          s.videoId === pendingStep.videoId
      );
      if (!alreadyAdded) {
        stepsToSave = [...workout, pendingStep];
        setWorkout(stepsToSave);
        setTitle("");
        setDescription("");
        setVideo("");
        setVideoSearch("");
        setSets("");
        setRepsOrHoldTime("");
        setFrequency(DEFAULT_FREQUENCY);
      }
    }

    stepsToSave = stepsToSave.map((step) => {
      if (isWorkoutBanner(step)) {
        return {
          type: "banner" as const,
          text: step.text.trim() || DEFAULT_BANNER_TEXT,
        };
      }

      return {
        ...step,
        type: "video" as const,
        frequency: getWorkoutFrequency(step),
      };
    });
    setWorkout(stepsToSave);

    const token = await getAccessToken();
    const res = await fetch("/api/admin/workout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: assignedUserId, steps: stepsToSave, goals }),
    });

    if (!res.ok) {
      setSaveStatus("error");
      return;
    }

    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }

  function addStep() {
    const videoId = video.trim();
    const hasStepContent = !!(
      title.trim() ||
      description.trim() ||
      videoId ||
      sets.trim() ||
      repsOrHoldTime.trim()
    );
    if (!hasStepContent) {
      setAddStepError("Add a title, description, or video first.");
      return;
    }
    setAddStepError("");
    const selectedVideo = videoId
      ? videoLibrary.find(v => v.id === videoId) ?? null
      : null;
    const videoDescription = selectedVideo?.description?.trim() ?? "";
    const newStep: WorkoutStep = {
      type: "video",
      title: title.trim() || selectedVideo?.title.trim() || `Step ${workout.length + 1}`,
      description: description.trim() || videoDescription,
      sets: sets.trim(),
      repsOrHoldTime: repsOrHoldTime.trim(),
      frequency: frequency.trim() || DEFAULT_FREQUENCY,
    };
    if (videoId) newStep.videoId = videoId;

    setWorkout(prev => [...prev, newStep]);
    setTitle("");
    setDescription("");
    setVideo("");
    setVideoSearch("");
    setSets("");
    setRepsOrHoldTime("");
    setFrequency(DEFAULT_FREQUENCY);
  }

  function addBanner() {
    setAddStepError("");
    setWorkout(prev => [...prev, { type: "banner", text: DEFAULT_BANNER_TEXT }]);
  }

  function removeStep(index: number) {
    setWorkout(workout.filter((_, i) => i !== index));
  }

  function updateStep(index: number, patch: Partial<WorkoutStep>) {
    setWorkout(prev => prev.map((step, i) => (
      i === index && !isWorkoutBanner(step) ? { ...step, ...patch } : step
    )));
  }

  function updateBanner(index: number, text: string) {
    setWorkout(prev => prev.map((step, i) => (
      i === index && isWorkoutBanner(step) ? { ...step, text } : step
    )));
  }

  function moveStepUp(index: number) {
    if (index === 0) return;
    const updated = [...workout];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setWorkout(updated);
  }

  function moveStepDown(index: number) {
    if (index === workout.length - 1) return;
    const updated = [...workout];
    [updated[index + 1], updated[index]] = [updated[index], updated[index + 1]];
    setWorkout(updated);
  }

  function toggleRecentSubmission(submissionId: string) {
    setOpenSubmissionIds(prev => ({
      ...prev,
      [submissionId]: !prev[submissionId],
    }));
  }

  const MinimalNav = (
    <Nav variant="minimal" isLoggedIn={!!userEmail} authReady={isLoaded} />
  );

  const inputClass = "w-full min-w-0 rounded-lg bg-[#0a0a0a] border border-[#222] text-white px-4 py-3 text-sm placeholder-[#444] focus:outline-none focus:border-[#555] disabled:opacity-40";
  const sectionTitleClass = "text-white uppercase tracking-wide";
  const sectionTitleStyle = { fontFamily: "var(--font-bebas)", fontSize: "clamp(22px, 2.5vw, 28px)" };
  const secondaryLinkClass = "inline-block rounded-[4px] border border-[#222] text-[#999] text-xs font-bold tracking-widest uppercase px-4 py-2 md:px-6 md:py-3 hover:text-white hover:border-[#444] transition-colors";
  const activeUserMatches = (() => {
    const term = lookupEmail.trim().toLowerCase();
    return term
      ? activeUsers.filter(user => user.email.toLowerCase().includes(term))
      : activeUsers;
  })();

  if (!isLoaded) {
    return (
      <>
        {MinimalNav}
        <main className="min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white">
          <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
            <div className="mx-auto w-full min-w-0 max-w-6xl">
              <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Admin</p>
              <h1
                className="text-white uppercase leading-[0.95] tracking-wide mb-6"
                style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 64px)" }}
              >
                Builder
              </h1>
              <p className="text-[#777]">
                {authChecked ? "Redirecting..." : "Checking login..."}
              </p>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      {MinimalNav}
      <main className="min-h-screen overflow-x-hidden bg-[#0a0a0a] text-white">
        <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
          <div className="mx-auto w-full min-w-0 max-w-6xl">
            {/* Page header */}
            <div className="mb-10 md:mb-14 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div className="min-w-0">
                <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Admin</p>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                  style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 64px)" }}
                >
                  Builder
                </h1>
                <p className="text-[#777]">Assign workouts to users.</p>
                {userEmail ? (
                  <p className="mt-2 text-sm text-[#555] break-all">Signed in as {userEmail}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard" className={secondaryLinkClass}>
                  View Dashboard
                </Link>
                <Link href="/admin/videos" className={secondaryLinkClass}>
                  Video Library
                </Link>
                <Link href="/admin/reviews" className={secondaryLinkClass}>
                  Coach Reviews
                </Link>
              </div>
            </div>

            {/* Assign to User */}
            <div className="mb-8 rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8">
              <h2 className={`${sectionTitleClass} mb-6`} style={sectionTitleStyle}>
                Assign To User
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative min-w-0 flex-1">
                  <input
                    value={lookupEmail}
                    onChange={(e) => {
                      setLookupEmail(e.target.value);
                      setActiveUserDropdownOpen(true);
                    }}
                    onFocus={() => setActiveUserDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLookupUser();
                      if (e.key === "Escape") setActiveUserDropdownOpen(false);
                    }}
                    placeholder="User email"
                    className={inputClass}
                    autoComplete="off"
                  />
                  {activeUserDropdownOpen ? (
                    <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-72 overflow-y-auto rounded-lg border border-[#222] bg-[#0a0a0a] shadow-2xl">
                      {!activeUsersLoaded ? (
                        <p className="px-4 py-3 text-sm text-[#777]">Loading active users...</p>
                      ) : activeUsers.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-[#777]">No active users found.</p>
                      ) : activeUserMatches.length === 0 ? (
                        <p className="px-4 py-3 text-sm text-[#777]">No active users match that email.</p>
                      ) : (
                        activeUserMatches.map((user) => (
                          <button
                            key={user.userId}
                            type="button"
                            onClick={() => handleLookupUser(user.email)}
                            className="w-full overflow-hidden border-b border-[#1e1e1e] px-4 py-3 text-left last:border-b-0 hover:bg-[#111110] transition-colors"
                          >
                            <p className="truncate text-sm text-white">{user.email}</p>
                            <p className="mt-1 text-[11px] uppercase tracking-widest text-[#666]">
                              {STATUS_LABELS[user.onboardingStatus] ?? user.onboardingStatus}
                            </p>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
                <Button
                  onClick={() => handleLookupUser()}
                  disabled={lookupStatus === "loading"}
                  size="md"
                >
                  {lookupStatus === "loading" ? "Loading..." : "Load User"}
                </Button>
              </div>
              {lookupStatus === "not-found" && (
                <p className="mt-4 text-sm text-[#dc2626]">No user found with that email.</p>
              )}
              {lookupStatus === "found" && assignedUserEmail && (
                <p className="mt-4 min-w-0 text-sm break-words" style={{ color: "oklch(0.68 0.14 155)" }}>
                  Editing: <span className="font-medium break-all">{assignedUserEmail}</span>
                </p>
              )}
            </div>

            {assignedUserId ? (
              <>
                {/* Onboarding Status */}
                <div className="mb-8 min-w-0 rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8">
                  <h2 className={`${sectionTitleClass} mb-6`} style={sectionTitleStyle}>
                    Onboarding Status
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {(["not_booked", "booked", "completed"] as const).map((s) => {
                      const active = assignedOnboardingStatus === s;
                      return (
                        <button
                          key={s}
                          onClick={() => handleUpdateStatus(s)}
                          disabled={updatingStatus}
                          className={`rounded-[4px] px-4 py-2 text-xs font-bold tracking-widest uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed border ${
                            active
                              ? "border-white text-white"
                              : "border-[#222] text-[#777] hover:border-[#444] hover:text-[#aaa]"
                          }`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Goals */}
                <div className="mb-8 min-w-0 rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8">
                  <div className={`${isGoalsOpen ? "mb-4" : ""} flex items-start justify-between gap-4`}>
                    <div className="min-w-0">
                      <h2 className={sectionTitleClass} style={sectionTitleStyle}>
                        Goals
                      </h2>
                      <p className="mt-2 text-xs text-[#555]">
                        Internal programming note for admins.
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={isGoalsOpen ? "Collapse goals" : "Expand goals"}
                      aria-expanded={isGoalsOpen}
                      aria-controls="admin-goals-panel"
                      onClick={() => setIsGoalsOpen(prev => !prev)}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[4px] border border-[#222] text-[#999] hover:text-white hover:border-[#444] transition-colors"
                    >
                      <span
                        aria-hidden="true"
                        className={`block h-2 w-2 border-b-2 border-r-2 border-current transition-transform ${isGoalsOpen ? "rotate-[225deg] translate-y-0.5" : "rotate-45 -translate-y-0.5"}`}
                      />
                    </button>
                  </div>

                  {isGoalsOpen ? (
                    <div id="admin-goals-panel">
                      <textarea
                        value={goals}
                        onChange={(e) => setGoals(e.target.value)}
                        rows={4}
                        placeholder="e.g. Build toward a cleaner two-arm flag line while improving compression and shoulder control."
                        className={`${inputClass} min-h-[110px] resize-y`}
                      />
                    </div>
                  ) : null}
                </div>

                {/* Recent Submissions */}
                <div className="mb-8 min-w-0 rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8">
                  <div className={`${isRecentSubmissionsOpen ? "mb-5" : ""} flex items-start justify-between gap-4`}>
                    <div className="min-w-0">
                      <h2 className={sectionTitleClass} style={sectionTitleStyle}>
                        Recent Submissions
                      </h2>
                      <p className="mt-2 text-xs text-[#555]">
                        Last 5 progress videos from this member.
                      </p>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-3">
                      <Link href="/admin/reviews" className="hidden text-xs font-bold tracking-widest uppercase text-[#777] hover:text-white transition-colors sm:inline-block">
                        View all reviews
                      </Link>
                      <button
                        type="button"
                        aria-label={isRecentSubmissionsOpen ? "Collapse recent submissions" : "Expand recent submissions"}
                        aria-expanded={isRecentSubmissionsOpen}
                        aria-controls="admin-recent-submissions-panel"
                        onClick={() => setIsRecentSubmissionsOpen(prev => !prev)}
                        className="flex h-9 w-9 items-center justify-center rounded-[4px] border border-[#222] text-[#999] hover:text-white hover:border-[#444] transition-colors"
                      >
                        <span
                          aria-hidden="true"
                          className={`block h-2 w-2 border-b-2 border-r-2 border-current transition-transform ${isRecentSubmissionsOpen ? "rotate-[225deg] translate-y-0.5" : "rotate-45 -translate-y-0.5"}`}
                        />
                      </button>
                    </div>
                  </div>

                  {isRecentSubmissionsOpen ? (
                    <div id="admin-recent-submissions-panel">
                      <Link href="/admin/reviews" className="mb-4 inline-block text-xs font-bold tracking-widest uppercase text-[#777] hover:text-white transition-colors sm:hidden">
                        View all reviews
                      </Link>

                      {!recentSubmissionsLoaded ? (
                        <p className="text-sm text-[#777]">Loading recent submissions...</p>
                      ) : recentSubmissionsError ? (
                        <p className="text-sm text-[#dc2626]">{recentSubmissionsError}</p>
                      ) : recentSubmissions.length === 0 ? (
                        <p className="text-sm text-[#777]">No review videos submitted yet.</p>
                      ) : (
                        <div className="divide-y divide-[#1e1e1e]">
                          {recentSubmissions.map((submission) => {
                            const isOpen = !!openSubmissionIds[submission.id];
                            const displayDate = formatSubmissionDate(submission.submittedAt ?? submission.createdAt);
                            return (
                              <div key={submission.id} className="py-4 first:pt-0 last:pb-0">
                                <button
                                  type="button"
                                  aria-expanded={isOpen}
                                  aria-controls={`recent-submission-${submission.id}`}
                                  onClick={() => toggleRecentSubmission(submission.id)}
                                  className="flex w-full items-start justify-between gap-4 text-left"
                                >
                                  <div className="min-w-0">
                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${REVIEW_STATUS_STYLES[submission.status]}`}>
                                        {REVIEW_STATUS_LABELS[submission.status]}
                                      </span>
                                      <span className="text-xs text-[#555]">{displayDate}</span>
                                    </div>
                                    <p className="truncate text-sm text-[#aaa]">
                                      {submission.note || submission.fileName || "No note added."}
                                    </p>
                                  </div>
                                  <span className="mt-2 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[4px] border border-[#222] text-[#999] transition-colors hover:border-[#444] hover:text-white">
                                    <span
                                      aria-hidden="true"
                                      className={`block h-2 w-2 border-b-2 border-r-2 border-current transition-transform ${isOpen ? "rotate-[225deg] translate-y-0.5" : "rotate-45 -translate-y-0.5"}`}
                                    />
                                  </span>
                                </button>

                                {isOpen ? (
                                  <div id={`recent-submission-${submission.id}`} className="mt-4 space-y-4">
                                    {submission.playbackId && submission.playbackTokens ? (
                                      <VideoPlayer playbackId={submission.playbackId} tokens={submission.playbackTokens} />
                                    ) : (
                                      <div className="aspect-video w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-center">
                                        <p className="text-[#666] text-xs tracking-widest uppercase">
                                          {submission.status === "error" ? "Upload failed" : "Video not ready"}
                                        </p>
                                      </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                      <div className="min-w-0">
                                        <p className="mb-2 text-xs tracking-widest uppercase text-[#777]">Member note</p>
                                        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[#aaa]">
                                          {submission.note || "No note added."}
                                        </p>
                                      </div>
                                      <div className="min-w-0">
                                        <p className="mb-2 text-xs tracking-widest uppercase text-[#777]">Coach note</p>
                                        <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[#aaa]">
                                          {submission.coachNote || "No coach note yet."}
                                        </p>
                                      </div>
                                    </div>

                                    {submission.errorMessage ? (
                                      <p className="text-sm text-[#dc2626]">{submission.errorMessage}</p>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Program */}
                <div className="mb-8 min-w-0 rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8">
                  <div className={`${isProgramOpen ? "mb-6" : ""} flex items-start justify-between gap-4`}>
                    <div className="min-w-0">
                      <h2 className={sectionTitleClass} style={sectionTitleStyle}>
                        Program
                      </h2>
                      <p className="mt-2 text-xs text-[#555]">
                        Add videos and programming details for this member.
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={isProgramOpen ? "Collapse program" : "Expand program"}
                      aria-expanded={isProgramOpen}
                      aria-controls="admin-program-panel"
                      onClick={() => setIsProgramOpen(prev => !prev)}
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[4px] border border-[#222] text-[#999] hover:text-white hover:border-[#444] transition-colors"
                    >
                      <span
                        aria-hidden="true"
                        className={`block h-2 w-2 border-b-2 border-r-2 border-current transition-transform ${isProgramOpen ? "rotate-[225deg] translate-y-0.5" : "rotate-45 -translate-y-0.5"}`}
                      />
                    </button>
                  </div>

                  {isProgramOpen ? (
                  <div id="admin-program-panel" className="space-y-4">
                    <div>
                      <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Step title</label>
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Optional"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Step description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        rows={5}
                        placeholder="Optional"
                        className={`${inputClass} min-h-[120px] resize-y`}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Sets</label>
                        <input
                          value={sets}
                          onChange={(e) => setSets(e.target.value)}
                          placeholder="e.g. 3"
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Reps / Hold Time</label>
                        <input
                          value={repsOrHoldTime}
                          onChange={(e) => setRepsOrHoldTime(e.target.value)}
                          placeholder="e.g. 30–45 sec"
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Frequency</label>
                      <input
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        placeholder={DEFAULT_FREQUENCY}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Video (optional)</label>
                      {(() => {
                        const selected = videoLibrary.find(v => v.id === video) ?? null;
                        if (selected) {
                          return (
                            <div className="rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                              <div className="w-full flex-shrink-0 sm:w-[180px]">
                                <VideoPlayer playbackId={selected.mux_playback_id} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-white text-sm truncate">{selected.title}</p>
                                <p className="mt-1 truncate text-xs uppercase tracking-widest text-[#666]">
                                  {(selected.level || "—")} · {(selected.category || "—")}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => { setVideo(""); setVideoSearch(""); }}
                                className="flex-shrink-0 text-[#777] text-xs tracking-widest uppercase hover:text-white transition-colors"
                              >
                                Change
                              </button>
                            </div>
                          );
                        }

                        const term = videoSearch.trim().toLowerCase();
                        const filtered = term
                          ? videoLibrary.filter(v =>
                              v.title.toLowerCase().includes(term)
                            )
                          : videoLibrary;

                        return (
                          <>
                            <input
                              type="text"
                              value={videoSearch}
                              onChange={(e) => setVideoSearch(e.target.value)}
                              placeholder={videoLibraryLoaded ? `Search ${videoLibrary.length} video${videoLibrary.length === 1 ? "" : "s"}...` : "Loading library..."}
                              disabled={!videoLibraryLoaded}
                              className={`${inputClass} mb-2`}
                            />
                            <div className="rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] max-h-96 overflow-y-auto">
                              {!videoLibraryLoaded ? (
                                <p className="px-4 py-3 text-[#777] text-sm">Loading library...</p>
                              ) : videoLibrary.length === 0 ? (
                                <p className="px-4 py-3 text-[#777] text-sm">No videos in library yet. Upload one in Video Library.</p>
                              ) : filtered.length === 0 ? (
                                <p className="px-4 py-3 text-[#777] text-sm">No videos match your search.</p>
                              ) : (
                                filtered.map((v) => (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => {
                                      setVideo(v.id);
                                      setVideoSearch("");
                                      if (!title.trim()) {
                                        setTitle(v.title);
                                      }
                                      if (!description.trim() && v.description?.trim()) {
                                        setDescription(v.description.trim());
                                      }
                                    }}
                                    className="grid w-full grid-cols-[112px_minmax(0,1fr)] gap-4 overflow-hidden border-b border-[#1e1e1e] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[#111110] sm:grid-cols-[140px_minmax(0,1fr)]"
                                  >
                                    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-[#1e1e1e] bg-[#111110]">
                                      <span
                                        aria-hidden="true"
                                        className="absolute inset-0 bg-cover bg-center"
                                        style={{ backgroundImage: `url(${getMuxThumbnailUrl(v.mux_playback_id)})` }}
                                      />
                                      <span
                                        aria-hidden="true"
                                        className="absolute inset-0 flex items-center justify-center bg-black/20"
                                      >
                                        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-black/60 text-white shadow-lg">
                                          <span className="ml-0.5 h-0 w-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-current" />
                                        </span>
                                      </span>
                                    </div>
                                    <div className="min-w-0 self-center">
                                    <p className="text-white text-sm truncate">{v.title}</p>
                                    <p className="mt-1 truncate text-xs uppercase tracking-widest text-[#666]">
                                      {(v.level || "—")} · {(v.category || "—")}
                                    </p>
                                      {v.description ? (
                                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#777]">{v.description}</p>
                                      ) : null}
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                    {addStepError ? (
                      <p className="text-sm text-[#dc2626]">{addStepError}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-3 pt-2">
                      <Button onClick={addStep} size="md">
                        Add Video
                      </Button>
                      <button
                        type="button"
                        onClick={addBanner}
                        className="rounded-[4px] border border-[#333] px-6 py-3 text-sm font-bold uppercase tracking-widest text-[#ddd] transition-colors hover:border-[#555] hover:text-white"
                      >
                        Add Banner
                      </button>
                    </div>
                  </div>
                  ) : null}
                </div>

                {/* Steps list */}
                <div className="mb-8 space-y-4 md:space-y-6">
                  {workout.length === 0 ? (
                    <div className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8 text-center">
                      <p className="text-[#777] text-sm">No steps yet. Add the first step above.</p>
                    </div>
                  ) : (
                    (() => {
                      let stepNumber = 0;

                      return workout.map((step, i) => {
                      if (isWorkoutBanner(step)) {
                        stepNumber = 0;
                        return (
                          <div
                            key={`banner-${step.text || "empty"}-${i}`}
                            className="min-w-0 overflow-hidden rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8"
                          >
                            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                              <h3 className="min-w-0 break-words text-white uppercase tracking-wide" style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(20px, 2vw, 24px)" }}>
                                Banner
                              </h3>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  onClick={() => moveStepUp(i)}
                                  className="rounded-[4px] border border-[#222] text-[#999] text-xs font-bold tracking-widest uppercase px-3 py-2 hover:text-white hover:border-[#444] transition-colors"
                                >
                                  Up
                                </button>
                                <button
                                  onClick={() => moveStepDown(i)}
                                  className="rounded-[4px] border border-[#222] text-[#999] text-xs font-bold tracking-widest uppercase px-3 py-2 hover:text-white hover:border-[#444] transition-colors"
                                >
                                  Down
                                </button>
                                <button
                                  onClick={() => removeStep(i)}
                                  className="rounded-[4px] border border-[#dc2626] text-[#dc2626] text-xs font-bold tracking-widest uppercase px-3 py-2 hover:bg-[#dc2626] hover:text-white transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                            <div className="mb-4 rounded-[4px] border border-[#333] bg-[#0a0a0a] px-4 py-4">
                              <p
                                className="break-words text-white uppercase tracking-wide"
                                style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(26px, 3vw, 38px)" }}
                              >
                                {step.text || DEFAULT_BANNER_TEXT}
                              </p>
                            </div>
                            <label className="mb-2 block text-xs tracking-widest text-[#777] uppercase">Banner Text</label>
                            <input
                              value={step.text}
                              onChange={(e) => updateBanner(i, e.target.value)}
                              placeholder={DEFAULT_BANNER_TEXT}
                              className={inputClass}
                            />
                          </div>
                        );
                      }

                      stepNumber += 1;
                      const stepVideo = step.videoId ? videoLibrary.find(v => v.id === step.videoId) ?? null : null;
                      return (
                      <div
                        key={`${step.videoId || step.title || "text-step"}-${i}`}
                        className="min-w-0 overflow-hidden rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8"
                      >
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <h3 className="min-w-0 break-words text-white uppercase tracking-wide" style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(20px, 2vw, 24px)" }}>
                            Step {stepNumber}
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => moveStepUp(i)}
                              className="rounded-[4px] border border-[#222] text-[#999] text-xs font-bold tracking-widest uppercase px-3 py-2 hover:text-white hover:border-[#444] transition-colors"
                            >
                              Up
                            </button>
                            <button
                              onClick={() => moveStepDown(i)}
                              className="rounded-[4px] border border-[#222] text-[#999] text-xs font-bold tracking-widest uppercase px-3 py-2 hover:text-white hover:border-[#444] transition-colors"
                            >
                              Down
                            </button>
                            <button
                              onClick={() => removeStep(i)}
                              className="rounded-[4px] border border-[#dc2626] text-[#dc2626] text-xs font-bold tracking-widest uppercase px-3 py-2 hover:bg-[#dc2626] hover:text-white transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="mb-4 grid grid-cols-1 gap-4">
                          <div>
                            <label className="mb-2 block text-xs tracking-widest text-[#777] uppercase">Title</label>
                            <input
                              value={step.title}
                              onChange={(e) => updateStep(i, { title: e.target.value })}
                              placeholder={stepVideo?.title || `Step ${i + 1}`}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className="mb-2 block text-xs tracking-widest text-[#777] uppercase">Frequency</label>
                            <input
                              value={step.frequency ?? getWorkoutFrequency(step)}
                              onChange={(e) => updateStep(i, { frequency: e.target.value })}
                              placeholder={DEFAULT_FREQUENCY}
                              className={inputClass}
                            />
                          </div>
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div>
                              <label className="mb-2 block text-xs tracking-widest text-[#777] uppercase">Sets</label>
                              <input
                                value={step.sets ?? ""}
                                onChange={(e) => updateStep(i, { sets: e.target.value })}
                                placeholder="e.g. 3"
                                className={inputClass}
                              />
                            </div>
                            <div>
                              <label className="mb-2 block text-xs tracking-widest text-[#777] uppercase">Reps / Hold Time</label>
                              <input
                                value={step.repsOrHoldTime ?? ""}
                                onChange={(e) => updateStep(i, { repsOrHoldTime: e.target.value })}
                                placeholder="e.g. 30-45 sec"
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                        {stepVideo ? (
                          <>
                            <VideoPlayer playbackId={stepVideo.mux_playback_id} />
                            <p className="mt-3 truncate text-xs uppercase tracking-widest text-[#666]">
                              {(stepVideo.level || "—")} · {(stepVideo.category || "—")}
                            </p>
                          </>
                        ) : step.videoId ? (
                          <div className="aspect-video w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-center">
                            <p className="px-3 text-center text-xs uppercase tracking-widest text-[#666]">Video not found in library</p>
                          </div>
                        ) : null}
                        <div className="mt-4">
                          <label className="mb-2 block text-xs tracking-widest text-[#777] uppercase">Description</label>
                          <textarea
                            value={step.description}
                            onChange={(e) => updateStep(i, { description: e.target.value })}
                            rows={4}
                            placeholder={stepVideo?.description || "Optional"}
                            className={`${inputClass} min-h-[110px] resize-y`}
                          />
                        </div>
                      </div>
                      );
                    });
                    })()
                  )}
                </div>

                {/* Save Workout */}
                <div className="mt-10 md:mt-14">
                  <Button
                    onClick={handleSaveWorkout}
                    disabled={saveStatus === "saving"}
                    size="md"
                  >
                    {saveStatus === "saving"
                      ? "Saving..."
                      : saveStatus === "saved"
                      ? "Saved!"
                      : saveStatus === "error"
                      ? "Error — try again"
                      : "Save Workout"}
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </section>
      </main>
    </>
  );
}
