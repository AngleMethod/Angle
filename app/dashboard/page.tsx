"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type WorkoutStep = {
  title: string;
  description: string;
  videoId?: string;
  video?: string;
  videoUrl?: string;
};

function extractYouTubeId(input: string): string {
  const t = input.trim();
  if (!t) return "";
  if (t.includes("youtube.com/watch?v=")) return t.split("v=")[1]?.split("&")[0] ?? "";
  if (t.includes("youtu.be/")) return t.split("youtu.be/")[1]?.split("?")[0] ?? "";
  if (t.includes("youtube.com/embed/")) return t.split("embed/")[1]?.split("?")[0] ?? "";
  return t;
}

function getVideoId(step: WorkoutStep): string {
  return extractYouTubeId(step.videoId || step.video || step.videoUrl || "");
}

type OnboardingStatus = "not_booked" | "booked" | "completed";

const ADMIN_EMAIL = "josh@notecreativestudios.com";
const CALENDLY_URL = "https://calendly.com/josh-anglemethod/30min";

export default function Dashboard() {
  const router = useRouter();

  const [isLoaded, setIsLoaded] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<"checking" | "authenticated" | "redirecting">("checking");
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>("not_booked");
  const [workout, setWorkout] = useState<WorkoutStep[]>([]);
  const [workoutLoaded, setWorkoutLoaded] = useState(false);

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

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status, onboarding_status")
        .eq("user_id", session.user.id)
        .single();

      if (!isMounted) return;

      if (!subscription || subscription.status !== "active") {
        setHasAccess(false);
        setIsLoaded(true);
        setAuthStatus("authenticated");
        return;
      }

      setHasAccess(true);

      const status: OnboardingStatus = subscription.onboarding_status ?? "not_booked";
      setOnboardingStatus(status);

      if (status === "completed") {
        const { data: workoutData } = await supabase
          .from("user_workouts")
          .select("steps")
          .eq("user_id", session.user.id)
          .single();

        if (!isMounted) return;

        if (workoutData && workoutData.steps?.length > 0) {
          setWorkout(workoutData.steps);
        }

        setWorkoutLoaded(true);
      }

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

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-2 text-3xl font-bold">Your Training</h1>
          <p className="text-gray-400">
            {authStatus === "redirecting" ? "Redirecting..." : "Checking login..."}
          </p>
        </div>
      </main>
    );
  }

  async function handleUpgrade() {
    if (!userId) {
      setUpgradeError("Session not found. Please sign in again.");
      return;
    }

    setIsUpgrading(true);
    setUpgradeError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
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

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="mb-4 text-3xl font-bold">Upgrade Required</h1>
          <p className="mb-6 text-gray-400">
            This training program is part of the paid Angle membership.
          </p>
          <button
            onClick={handleUpgrade}
            disabled={isUpgrading}
            className="inline-block rounded-none bg-white px-6 py-3 font-semibold text-black transition hover:bg-gray-200 disabled:opacity-50"
          >
            {isUpgrading ? "Redirecting..." : "Upgrade to Access"}
          </button>
          {upgradeError ? (
            <p className="mt-4 text-sm text-red-400">{upgradeError}</p>
          ) : null}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black p-8 text-white">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="mb-2 text-3xl font-bold">Your Training</h1>
            <p className="text-gray-400">Your current workout playlist</p>
            {userEmail ? (
              <p className="mt-2 text-sm text-gray-500">Signed in as {userEmail}</p>
            ) : null}
          </div>
          {userEmail === ADMIN_EMAIL ? (
            <Link href="/admin" className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium">
              Open Admin
            </Link>
          ) : null}
        </div>

        {onboardingStatus === "not_booked" && (
          <div className="rounded-lg bg-zinc-900 p-8 text-center">
            <h2 className="mb-2 text-2xl font-semibold">Book your setup call</h2>
            <p className="mb-6 text-gray-400">
              Your first step is a short call so we can understand your current level and build your custom program.
            </p>
            <a
              href={CALENDLY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-none bg-white px-8 py-4 font-semibold text-black transition hover:bg-gray-200"
            >
              Book Your Call
            </a>
          </div>
        )}

        {onboardingStatus === "booked" && (
          <div className="rounded-lg bg-zinc-900 p-8 text-center">
            <h2 className="mb-2 text-2xl font-semibold">Your call is booked, we&apos;re looking forward to working together!</h2>
            <p className="text-gray-400">
              We&apos;ll assign your custom training program after your call.
            </p>
          </div>
        )}

        {onboardingStatus === "completed" && (
          <>
            {!workoutLoaded ? (
              <p className="text-gray-400">Loading your workout...</p>
            ) : workout.length === 0 ? (
              <div className="rounded-lg bg-zinc-900 p-8 text-center">
                <h2 className="mb-2 text-xl font-semibold">Your workout is being prepared</h2>
                <p className="text-gray-400">
                  Your custom training program will appear here once it&apos;s been assigned to your account.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {workout.map((step, i) => {
                  const videoId = getVideoId(step);
                  return (
                  <div key={`${videoId}-${i}`} className="rounded-lg bg-zinc-900 p-4">
                    <h2 className="mb-4 text-xl font-semibold">
                      Step {i + 1}: {step.title}
                    </h2>
                    {videoId && (
                      <div className="aspect-video w-full overflow-hidden rounded">
                        <iframe
                          className="h-full w-full"
                          src={`https://www.youtube.com/embed/${videoId}?rel=0`}
                          title={step.title}
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          referrerPolicy="strict-origin-when-cross-origin"
                          allowFullScreen
                        />
                      </div>
                    )}
                    <p className="mt-2 text-gray-400">{step.description}</p>
                  </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
