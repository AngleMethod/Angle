"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import BookedRedirectHandler from "@/components/BookedRedirectHandler";
import Nav from "@/components/Nav";
import Button from "@/components/ui/Button";

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

  const DashboardNav = (
    <Nav variant="minimal" isLoggedIn={!!userEmail} authReady={isLoaded} />
  );

  if (!isLoaded) {
    return (
      <>
        {DashboardNav}
        <main className="min-h-screen bg-[#0a0a0a] text-white">
          <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
            <div className="mx-auto max-w-6xl">
              <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Training</p>
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
          <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
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
              <Button onClick={handleUpgrade} disabled={isUpgrading}>
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
        <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
          <div className="mx-auto max-w-6xl">
            <Suspense fallback={null}>
              <BookedRedirectHandler onBooked={() => setShowBookedBanner(true)} />
            </Suspense>

            {showBookedBanner && (
              <div className="mb-10 rounded-lg border border-[#1e1e1e] bg-[#111110] px-6 py-4 text-sm text-[#ccc]">
                You&apos;re scheduled ✅ — we&apos;ll prepare your program after your call.
              </div>
            )}

            <div className="mb-10 md:mb-14 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Training</p>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                  style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 64px)" }}
                >
                  Your Training
                </h1>
                <p className="text-[#777]">
                  {onboardingStatus === "not_booked"
                    ? "Your training starts with a short setup call."
                    : onboardingStatus === "booked"
                    ? "Your setup call is booked. We'll build your plan next."
                    : "Your current workout playlist."}
                </p>
                {userEmail ? (
                  <p className="mt-2 text-sm text-[#555]">Signed in as {userEmail}</p>
                ) : null}
              </div>
              {userEmail === ADMIN_EMAIL ? (
                <Link
                  href="/admin"
                  className="self-start sm:self-auto inline-block rounded-[4px] border border-[#222] text-[#999] text-xs font-bold tracking-widest uppercase px-4 py-2 md:px-6 md:py-3 hover:text-white hover:border-[#444] transition-colors"
                >
                  Open Admin
                </Link>
              ) : null}
            </div>

            {onboardingStatus === "not_booked" && (
              <div className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-8 md:p-12 text-center">
                <h2
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                  style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(28px, 3.5vw, 40px)" }}
                >
                  Book Your Setup Call
                </h2>
                <p className="text-[#777] mb-8 md:mb-10 max-w-md mx-auto">
                  Your first step is a short call so we can understand your current level and build your custom program.
                </p>
                <a
                  href={CALENDLY_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-[4px] bg-white text-black font-bold text-sm tracking-widest uppercase px-8 py-4 hover:bg-[#e0e0e0] transition-colors"
                >
                  Book Your Call
                </a>
              </div>
            )}

            {onboardingStatus === "booked" && (
              <div className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-8 md:p-12 text-center">
                <h2
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                  style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(28px, 3.5vw, 40px)" }}
                >
                  Your Setup Call Is Booked
                </h2>
                <p className="text-[#777] mb-6 max-w-md mx-auto">
                  We&apos;ll use your call to understand your current level and build your custom training plan.
                </p>
                <div
                  className="inline-flex items-center gap-2 text-xs tracking-widest uppercase font-medium rounded-full px-3 py-1 border border-green-900"
                  style={{ backgroundColor: "oklch(0.18 0.06 155)", color: "oklch(0.68 0.14 155)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "oklch(0.68 0.14 155)" }} />
                  You&apos;re scheduled
                </div>
              </div>
            )}

            {onboardingStatus === "completed" && (
              <>
                {!workoutLoaded ? (
                  <p className="text-[#777]">Loading your workout...</p>
                ) : workout.length === 0 ? (
                  <div className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-8 md:p-12 text-center">
                    <h2
                      className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                      style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(24px, 3vw, 32px)" }}
                    >
                      Your Workout Is Being Prepared
                    </h2>
                    <p className="text-[#777] max-w-md mx-auto">
                      Your custom training program will appear here once it&apos;s been assigned to your account.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {workout.map((step, i) => {
                      const videoId = getVideoId(step);
                      return (
                        <div key={`${videoId}-${i}`} className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8">
                          <h2
                            className="text-white uppercase tracking-wide mb-6"
                            style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(22px, 2.5vw, 28px)" }}
                          >
                            Step {i + 1}: {step.title}
                          </h2>
                          {videoId && (
                            <div className="aspect-video w-full overflow-hidden rounded-lg mb-6 bg-[#0a0a0a]">
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
                          <p className="text-[#aaa] leading-relaxed">{step.description}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
