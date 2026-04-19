"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type WorkoutStep = {
  title: string;
  description: string;
  video: string;
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
    setWorkout(workoutData.steps ?? []);
    setLookupStatus("found");
  }

  async function handleUpdateStatus(status: OnboardingStatus) {
    if (!assignedUserId) return;
    setUpdatingStatus(true);

    const token = await getAccessToken();
    await fetch("/api/admin/onboarding-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: assignedUserId, status }),
    });

    setAssignedOnboardingStatus(status);
    setUpdatingStatus(false);
  }

  async function handleSaveWorkout() {
    if (!assignedUserId) return;
    setSaveStatus("saving");

    const token = await getAccessToken();
    const res = await fetch("/api/admin/workout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ userId: assignedUserId, steps: workout }),
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
    if (!title.trim() || !description.trim() || !videoId) {
      alert("Please add a title, description, and YouTube link or video ID.");
      return;
    }
    setWorkout([...workout, { title: title.trim(), description: description.trim(), video: videoId }]);
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

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-2 text-3xl font-bold">Admin Builder</h1>
          <p className="text-gray-400">
            {authChecked ? "Redirecting..." : "Checking login..."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Admin Builder</h1>
            <p className="text-gray-400">Assign workouts to users</p>
            {userEmail ? (
              <p className="mt-2 text-sm text-gray-500">Signed in as {userEmail}</p>
            ) : null}
          </div>
          <Link href="/dashboard" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium">
            View Dashboard
          </Link>
        </div>

        {/* User Lookup */}
        <div className="mb-8 space-y-4 rounded-xl bg-zinc-900 p-6">
          <h2 className="text-2xl font-semibold">Assign to User</h2>
          <div className="flex gap-3">
            <input
              value={lookupEmail}
              onChange={(e) => setLookupEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLookupUser()}
              placeholder="User email"
              className="flex-1 rounded-lg bg-zinc-800 px-4 py-3 text-white outline-none"
            />
            <button
              onClick={handleLookupUser}
              disabled={lookupStatus === "loading"}
              className="rounded-lg bg-white px-6 py-3 font-semibold text-black disabled:opacity-50"
            >
              {lookupStatus === "loading" ? "Loading..." : "Load User"}
            </button>
          </div>
          {lookupStatus === "not-found" && (
            <p className="text-sm text-red-400">No user found with that email.</p>
          )}
          {lookupStatus === "found" && assignedUserEmail && (
            <p className="text-sm text-green-400">
              Editing: <span className="font-medium">{assignedUserEmail}</span>
            </p>
          )}
        </div>

        {assignedUserId ? (
          <>
            {/* Onboarding Status */}
            <div className="mb-8 rounded-xl bg-zinc-900 p-6">
              <h2 className="mb-4 text-2xl font-semibold">Onboarding Status</h2>
              <div className="flex gap-3">
                {(["not_booked", "booked", "completed"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleUpdateStatus(s)}
                    disabled={updatingStatus}
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
                      assignedOnboardingStatus === s
                        ? "bg-white text-black"
                        : "bg-zinc-800 text-white hover:bg-zinc-700"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Workout Editor */}
            <div className="mb-8 space-y-4 rounded-xl bg-zinc-900 p-6">
              <h2 className="text-2xl font-semibold">Add Step</h2>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Step title"
                className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-white outline-none"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Step description"
                className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-white outline-none"
              />
              <input
                value={video}
                onChange={(e) => setVideo(e.target.value)}
                placeholder="YouTube link or video ID"
                className="w-full rounded-lg bg-zinc-800 px-4 py-3 text-white outline-none"
              />
              <button
                onClick={addStep}
                className="rounded-lg bg-white px-6 py-3 font-semibold text-black"
              >
                Add Step
              </button>
            </div>

            <div className="space-y-6">
              {workout.length === 0 ? (
                <p className="text-gray-500">No steps yet. Add the first step above.</p>
              ) : (
                workout.map((step, i) => (
                  <div key={`${step.video}-${i}`} className="rounded-lg bg-zinc-900 p-4">
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <h2 className="text-xl font-semibold">
                        Step {i + 1}: {step.title}
                      </h2>
                      <div className="flex gap-2">
                        <button onClick={() => moveStepUp(i)} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">Up</button>
                        <button onClick={() => moveStepDown(i)} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm">Down</button>
                        <button onClick={() => removeStep(i)} className="rounded-lg bg-red-600 px-4 py-2 text-sm">Remove</button>
                      </div>
                    </div>
                    <div className="aspect-video w-full overflow-hidden rounded">
                      <iframe
                        className="h-full w-full"
                        src={`https://www.youtube.com/embed/${step.video}?rel=0`}
                        title={step.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                      />
                    </div>
                    <p className="mt-2 text-gray-400">{step.description}</p>
                  </div>
                ))
              )}
            </div>

            <div className="mt-8">
              <button
                onClick={handleSaveWorkout}
                disabled={saveStatus === "saving"}
                className="rounded-lg bg-white px-8 py-4 font-semibold text-black disabled:opacity-50"
              >
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                  ? "Saved!"
                  : saveStatus === "error"
                  ? "Error — try again"
                  : "Save Workout"}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
