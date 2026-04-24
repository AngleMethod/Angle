"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";
import Button from "@/components/ui/Button";

type WorkoutStep = {
  title: string;
  description: string;
  videoId: string;
};

type OnboardingStatus = "not_booked" | "booked" | "completed";

const ADMIN_EMAIL = "josh@notecreativestudios.com";

const STATUS_LABELS: Record<OnboardingStatus, string> = {
  not_booked: "Not Booked",
  booked: "Booked",
  completed: "Completed",
};

function getYoutubeId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.includes("youtube.com/watch?v=")) {
    return trimmed.split("v=")[1]?.split("&")[0] ?? "";
  }
  if (trimmed.includes("youtu.be/")) {
    return trimmed.split("youtu.be/")[1]?.split("?")[0] ?? "";
  }
  if (trimmed.includes("youtube.com/embed/")) {
    return trimmed.split("embed/")[1]?.split("?")[0] ?? "";
  }
  return trimmed;
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

  const [workout, setWorkout] = useState<WorkoutStep[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [video, setVideo] = useState("");
  const [addStepError, setAddStepError] = useState("");

  useEffect(() => {
    let isMounted = true;

    const syncAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;

      const email = session?.user?.email ?? null;
      if (!email || email !== ADMIN_EMAIL) {
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

  async function handleLookupUser() {
    if (!lookupEmail.trim()) return;
    setLookupStatus("loading");
    setAssignedUserId(null);
    setAssignedUserEmail(null);
    setWorkout([]);

    const token = await getAccessToken();
    const res = await fetch("/api/admin/lookup-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ email: lookupEmail.trim() }),
    });

    if (!res.ok) {
      setLookupStatus("not-found");
      return;
    }

    const { userId, onboardingStatus } = await res.json();

    const workoutRes = await fetch(`/api/admin/workout?userId=${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const workoutData = await workoutRes.json();

    setAssignedUserId(userId);
    setAssignedUserEmail(lookupEmail.trim());
    setAssignedOnboardingStatus(onboardingStatus ?? "not_booked");
    setWorkout((workoutData.steps ?? []).map((s: WorkoutStep & { video?: string }) => ({
      title: s.title,
      description: s.description,
      videoId: s.videoId ?? getYoutubeId(s.video ?? ""),
    })));
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
    const pendingVideoId = getYoutubeId(video);
    if (pendingVideoId) {
      const pendingStep: WorkoutStep = {
        title: title.trim() || `Step ${workout.length + 1}`,
        description: description.trim(),
        videoId: pendingVideoId,
      };
      const alreadyAdded = workout.some(
        (s) => s.title === pendingStep.title && s.videoId === pendingStep.videoId
      );
      if (!alreadyAdded) {
        stepsToSave = [...workout, pendingStep];
        setWorkout(stepsToSave);
        setTitle("");
        setDescription("");
        setVideo("");
      }
    }

    const token = await getAccessToken();
    const res = await fetch("/api/admin/workout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: assignedUserId, steps: stepsToSave }),
    });

    if (!res.ok) {
      setSaveStatus("error");
      return;
    }

    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }

  function addStep() {
    const videoId = getYoutubeId(video);
    if (!videoId) {
      setAddStepError("Please add a YouTube link or video ID.");
      return;
    }
    setAddStepError("");
    const newStep: WorkoutStep = {
      title: title.trim() || `Step ${workout.length + 1}`,
      description: description.trim(),
      videoId,
    };
    setWorkout(prev => [...prev, newStep]);
    setTitle("");
    setDescription("");
    setVideo("");
  }

  function removeStep(index: number) {
    setWorkout(workout.filter((_, i) => i !== index));
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

  const MinimalNav = (
    <Nav variant="minimal" isLoggedIn={!!userEmail} authReady={isLoaded} />
  );

  const inputClass = "w-full rounded-lg bg-[#0a0a0a] border border-[#222] text-white px-4 py-3 text-sm placeholder-[#444] focus:outline-none focus:border-[#555] disabled:opacity-40";
  const sectionTitleClass = "text-white uppercase tracking-wide";
  const sectionTitleStyle = { fontFamily: "var(--font-bebas)", fontSize: "clamp(22px, 2.5vw, 28px)" };
  const secondaryLinkClass = "inline-block rounded-[4px] border border-[#222] text-[#999] text-xs font-bold tracking-widest uppercase px-4 py-2 md:px-6 md:py-3 hover:text-white hover:border-[#444] transition-colors";

  if (!isLoaded) {
    return (
      <>
        {MinimalNav}
        <main className="min-h-screen bg-[#0a0a0a] text-white">
          <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
            <div className="mx-auto max-w-6xl">
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
      <main className="min-h-screen bg-[#0a0a0a] text-white">
        <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
          <div className="mx-auto max-w-5xl">
            {/* Page header */}
            <div className="mb-10 md:mb-14 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Admin</p>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                  style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 64px)" }}
                >
                  Builder
                </h1>
                <p className="text-[#777]">Assign workouts to users.</p>
                {userEmail ? (
                  <p className="mt-2 text-sm text-[#555]">Signed in as {userEmail}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/dashboard" className={secondaryLinkClass}>
                  View Dashboard
                </Link>
                <Link href="/admin/videos" className={secondaryLinkClass}>
                  Video Library
                </Link>
              </div>
            </div>

            {/* Assign to User */}
            <div className="mb-8 rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8">
              <h2 className={`${sectionTitleClass} mb-6`} style={sectionTitleStyle}>
                Assign To User
              </h2>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={lookupEmail}
                  onChange={(e) => setLookupEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleLookupUser()}
                  placeholder="User email"
                  className={`flex-1 ${inputClass}`}
                />
                <Button
                  onClick={handleLookupUser}
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
                <p className="mt-4 text-sm" style={{ color: "oklch(0.68 0.14 155)" }}>
                  Editing: <span className="font-medium">{assignedUserEmail}</span>
                </p>
              )}
            </div>

            {assignedUserId ? (
              <>
                {/* Onboarding Status */}
                <div className="mb-8 rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8">
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

                {/* Add Step */}
                <div className="mb-8 rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8">
                  <h2 className={`${sectionTitleClass} mb-6`} style={sectionTitleStyle}>
                    Add Step
                  </h2>
                  <div className="space-y-4">
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
                      <input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Optional"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">YouTube link or video ID</label>
                      <input
                        value={video}
                        onChange={(e) => setVideo(e.target.value)}
                        placeholder="Required"
                        className={inputClass}
                      />
                    </div>
                    {addStepError ? (
                      <p className="text-sm text-[#dc2626]">{addStepError}</p>
                    ) : null}
                    <div className="pt-2">
                      <Button onClick={addStep} size="md">
                        Add Step
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Steps list */}
                <div className="mb-8 space-y-4 md:space-y-6">
                  {workout.length === 0 ? (
                    <div className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8 text-center">
                      <p className="text-[#777] text-sm">No steps yet. Add the first step above.</p>
                    </div>
                  ) : (
                    workout.map((step, i) => (
                      <div
                        key={`${step.videoId}-${i}`}
                        className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8"
                      >
                        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <h3 className="text-white uppercase tracking-wide" style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(20px, 2vw, 24px)" }}>
                            Step {i + 1}: {step.title}
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
                        <div className="aspect-video w-full overflow-hidden rounded-lg bg-[#0a0a0a]">
                          <iframe
                            className="h-full w-full"
                            src={`https://www.youtube.com/embed/${step.videoId}?rel=0`}
                            title={step.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                          />
                        </div>
                        {step.description ? (
                          <p className="mt-4 text-[#aaa] text-sm leading-relaxed">{step.description}</p>
                        ) : null}
                      </div>
                    ))
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
