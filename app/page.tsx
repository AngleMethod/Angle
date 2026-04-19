

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

function HeroSection({
  isStartingTraining,
  onStartTraining,
}: {
  isStartingTraining: boolean;
  onStartTraining: () => void;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-black text-white px-6 overflow-hidden">
      <img
        src="/hero.png"
        alt="Handstand Hero"
        className="absolute inset-0 w-full h-full object-contain object-center scale-100"
      />

      <div className="absolute inset-0 bg-black/40" />

      <div className="absolute inset-x-0 top-8 z-10 flex justify-center md:top-10">
        <img
          src="/angle-logo-white.svg"
          alt="Angle Logo"
          className="h-24 w-auto"
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-6 text-center">
        <h1 className={sharedHeroHeadingClass}>
          Master handstands with a <span className="italic">real training system</span>
        </h1>

        <p className={`${sharedSubheadingClass} mb-8`}>
          Start with an assessment, then follow a custom playlist built for your level, goals, and next progression.
        </p>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onStartTraining}
            className="inline-block rounded-none bg-white px-8 py-4 font-semibold text-black transition hover:bg-gray-200"
          >
            {isStartingTraining ? "Starting..." : "Start Training"}
          </button>
          <p className="text-sm text-gray-400">
            Already a member?{" "}
            <a href="#signin" className="underline hover:text-white">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}

const ADMIN_EMAIL = "josh@notecreativestudios.com";

const sharedCardClass = "rounded-none border border-white/10 bg-white/5 p-5 md:p-6";
const sharedCardTitleClass = "text-2xl font-semibold text-white";
const sharedCardBodyClass = "mt-4 text-lg leading-8 text-gray-400 md:text-lg md:leading-8";
const sharedSubheadingClass = "mx-auto mt-4 max-w-2xl text-xl text-gray-400 md:text-2xl";
const sharedSectionHeadingClass = "mt-4 text-4xl font-semibold text-white md:text-5xl";
const sharedHeroHeadingClass = "mb-4 text-6xl font-semibold leading-tight tracking-tight md:text-8xl";
const sharedEyebrowClass = "text-sm uppercase tracking-[0.2em] text-gray-400";
const sharedJourneyImageClass = "overflow-hidden rounded-none border border-white/10 bg-white/[0.03]";
const sharedStepPillClass = "inline-flex rounded-none px-4 py-2 text-sm font-medium tracking-[0.2em]";
const sharedCtaPillClass = "rounded-none px-4 py-2 text-sm";

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <p className={sharedEyebrowClass}>{children}</p>;
}

function JourneyImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className={sharedJourneyImageClass}>
      <img src={src} alt={alt} className="w-full h-auto object-cover" />
    </div>
  );
}


function CtaStackImage({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className: string;
}) {
  return (
    <div className={className}>
      <img src={src} alt={alt} className="h-auto w-full object-cover" />
    </div>
  );
}

function SignInSection({
  authReady,
  userEmail,
  email,
  message,
  isAdmin,
  onEmailChange,
  onLogin,
  onLogout,
}: {
  authReady: boolean;
  userEmail: string | null;
  email: string;
  message: string;
  isAdmin: boolean;
  onEmailChange: (value: string) => void;
  onLogin: () => void;
  onLogout: () => void;
}) {
  return (
    <section id="signin" className="bg-black px-6 pb-20 text-white md:pb-24">
      <div className="mx-auto max-w-[760px] rounded-none border border-white/10 bg-white/[0.03] px-6 py-8 md:px-10 md:py-10">
        <div className="text-center">
          <SectionEyebrow>
            Sign in
          </SectionEyebrow>
          <h2 className={sharedSectionHeadingClass}>
            Access your training dashboard
          </h2>
          <p className={sharedSubheadingClass}>
            Sign in with your email to open your dashboard and resume your program.
          </p>
        </div>

        <div className="mx-auto mt-8 max-w-xl rounded-none border border-white/10 bg-black/40 p-5 text-center">
          {!authReady ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">Checking your sign-in status...</p>
            </div>
          ) : userEmail ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-300">Signed in as</p>
                <p className="mt-1 font-medium text-white">{userEmail}</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <Link
                  href="/dashboard"
                  className="inline-block rounded-none bg-white px-6 py-3 font-semibold text-black transition hover:bg-gray-200"
                >
                  Go to Dashboard
                </Link>

                {isAdmin ? (
                  <Link
                    href="/admin"
                    className="inline-block rounded-none border border-white/20 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
                  >
                    Go to Admin
                  </Link>
                ) : null}
              </div>

              <button
                onClick={onLogout}
                className="inline-block rounded-none border border-white/20 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Log out
              </button>
            </div>
          ) : (
            <div>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                className="w-full rounded-none border border-white/10 bg-black px-4 py-4 text-white outline-none placeholder:text-gray-500"
              />

              <button
                onClick={onLogin}
                className="mt-4 inline-block w-full rounded-none bg-white px-8 py-4 font-semibold text-black transition hover:bg-gray-200"
              >
                Email me a sign-in link
              </button>

              <p className="mt-4 text-sm text-gray-400">
                We&apos;ll remember your email on this browser so signing in is faster next time.
              </p>
            </div>
          )}

          {message ? (
            <p className="mt-4 text-center text-sm text-gray-400">{message}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function InMotionSection() {
  return (
    <section className="bg-black text-white px-6 py-20 md:py-24">
      <div className="mx-auto max-w-[1400px]">
        <div className="mb-8 text-center md:mb-10">
          <SectionEyebrow>
            In motion
          </SectionEyebrow>
          <h2 className={sharedSectionHeadingClass}>
            Strength and balance, built with intention
          </h2>
          <p className={sharedSubheadingClass}>
            See the standard of training Angle is designed to deliver.
          </p>
        </div>

        <div className="overflow-hidden rounded-none border border-white/10 bg-black/40 shadow-2xl">
          <div className="aspect-video w-full">
            <iframe
              className="h-full w-full"
              src="https://www.youtube.com/embed/zsVWMBOJdRw?rel=0"
              title="Angle training video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section className="bg-black text-white px-6 pb-20 md:pb-24">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8 text-center md:mb-10">
          <SectionEyebrow>
            How it works
          </SectionEyebrow>
          <h2 className={sharedSectionHeadingClass}>
            A clear path to your first — or next — handstand
          </h2>
          <p className={sharedSubheadingClass}>
            Angle gives you structured training built around your current level, so you can stop guessing and start progressing.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3 md:gap-8">
          <div className={sharedCardClass}>
            <p className={`${sharedStepPillClass} bg-purple-500/15 text-purple-300`}>01</p>
            <h3 className={`mt-4 ${sharedCardTitleClass}`}>Assessment</h3>
            <p className={sharedCardBodyClass}>
              We identify your current level, limitations, and next progression so your training starts exactly where it should.
            </p>
          </div>

          <div className={sharedCardClass}>
            <p className={`${sharedStepPillClass} bg-green-500/15 text-green-300`}>02</p>
            <h3 className={`mt-4 ${sharedCardTitleClass}`}>Custom playlist</h3>
            <p className={sharedCardBodyClass}>
              Get a training plan built for your level, goals, and what you need next — no guesswork, no wasted time.
            </p>
          </div>

          <div className={sharedCardClass}>
            <p className={`${sharedStepPillClass} bg-amber-500/15 text-amber-300`}>03</p>
            <h3 className={`mt-4 ${sharedCardTitleClass}`}>Progress with intent</h3>
            <p className={sharedCardBodyClass}>
              As you improve, your training evolves with you so you keep progressing without ever losing direction.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}


function FinalCtaSection({
  isStartingTraining,
  onStartTraining,
}: {
  isStartingTraining: boolean;
  onStartTraining: () => void;
}) {
  return (
    <section className="bg-black text-white px-6 pb-20 md:pb-24">
      <div className="mx-auto max-w-[1500px] rounded-none border border-white/10 bg-white/[0.03] px-6 py-8 md:px-10 md:py-10">
        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
          <div>
            <SectionEyebrow>
              Start now
            </SectionEyebrow>

            <h2 className={sharedSectionHeadingClass}>
              Train with more structure. Progress with more intent.
            </h2>

            <div className="mt-5 flex flex-wrap gap-3">
              <span className={`${sharedCtaPillClass} bg-purple-500/15 text-purple-300`}>Assessment first</span>
              <span className={`${sharedCtaPillClass} bg-green-500/15 text-green-300`}>Built for you</span>
              <span className={`${sharedCtaPillClass} bg-amber-500/15 text-amber-300`}>Progressions</span>
              <span className={`${sharedCtaPillClass} bg-blue-500/15 text-blue-300`}>Coach-led</span>
            </div>

            <p className={`${sharedSubheadingClass} max-w-none text-left`}>
              Start with an assessment, then train with a custom playlist built for your level, goals, and next progression.
            </p>

            <div className="mt-6 text-left">
              <button
                onClick={onStartTraining}
                className="inline-block rounded-none bg-white px-8 py-4 font-semibold text-black transition hover:bg-gray-200"
              >
                {isStartingTraining ? "Starting..." : "Start Training"}
              </button>
            </div>
          </div>

          <div className="relative flex min-h-[340px] items-center justify-center md:min-h-[420px]">
            <CtaStackImage
              src="/angle-1.png"
              alt="Angle visual one"
              className="absolute left-4 top-10 w-[58%] rotate-[-8deg] overflow-hidden rounded-none border border-white/10 bg-black shadow-2xl md:left-10 md:top-8"
            />

            <CtaStackImage
              src="/angle-2.png"
              alt="Angle visual two"
              className="absolute right-6 top-0 z-10 w-[60%] overflow-hidden rounded-none border border-white/10 bg-black shadow-2xl md:right-10"
            />

            <CtaStackImage
              src="/angle-3.png"
              alt="Angle visual three"
              className="absolute bottom-0 right-12 w-[56%] rotate-[6deg] overflow-hidden rounded-none border border-white/10 bg-black shadow-2xl md:right-20"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function JourneySection() {
  return (
    <section className="bg-black text-white px-6 pb-20 md:pb-24">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-10 text-center md:mb-12">
          <SectionEyebrow>
            The journey
          </SectionEyebrow>
          <h2 className={sharedSectionHeadingClass}>
            A system that grows with you
          </h2>
          <p className={sharedSubheadingClass}>
            Start where you are, build real control, and progress toward advanced handstand training — all within one system.
          </p>
        </div>

        <div className="mb-14 grid items-center gap-8 md:mb-16 md:grid-cols-2 md:gap-12">
          <div>
            <h3 className="mb-3 text-3xl font-semibold text-white">
              Start where you are
            </h3>
            <p className={sharedCardBodyClass}>
              Whether you’re still using the wall or starting to find your first freestanding holds, Angle meets you at your current level with a clear starting point and structured path forward.
            </p>
          </div>
          <JourneyImage src="/angle-1.png" alt="Beginner training" />
        </div>

        <div className="mb-14 grid items-center gap-8 md:mb-16 md:grid-cols-2 md:gap-12">
          <div className="order-2 md:order-1">
            <JourneyImage src="/angle-2.png" alt="Intermediate training" />
          </div>
          <div className="order-1 md:order-2">
            <h3 className="mb-3 text-3xl font-semibold text-white">
              Build control and consistency
            </h3>
            <p className={sharedCardBodyClass}>
              As your balance and alignment improve, your training evolves with you. Each session builds toward stronger lines, better control, and more consistent freestanding handstands.
            </p>
          </div>
        </div>

        <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
          <div>
            <h3 className="mb-3 text-3xl font-semibold text-white">
              Progress with intent
            </h3>
            <p className={sharedCardBodyClass}>
              Move into deeper balance work, stronger shapes, and advanced handstand control — all without losing structure. The system continues to guide you as you level up.
            </p>
          </div>
          <JourneyImage src="/angle-3.png" alt="Advanced training" />
        </div>
      </div>
    </section>
  );
}


function InsideAngleSection() {
  return (
    <section className="bg-black text-white px-6 pb-20 md:pb-24">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-8 text-center md:mb-10">
          <SectionEyebrow>
            Inside Angle
          </SectionEyebrow>
          <h2 className={sharedSectionHeadingClass}>
            Everything you need to train with clarity
          </h2>
          <p className={sharedSubheadingClass}>
            Start with an assessment, then train through playlists built specifically for your level, goals, and next progression.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={sharedCardClass}>
            <h3 className={sharedCardTitleClass}>Custom playlists</h3>
            <p className={sharedCardBodyClass}>
              Custom playlists built for you after assessment, based on your level, goals, and next progression.
            </p>
          </div>

          <div className={sharedCardClass}>
            <h3 className={sharedCardTitleClass}>Structured sessions</h3>
            <p className={sharedCardBodyClass}>
              Clear training flow so you always know what to do next.
            </p>
          </div>

          <div className={sharedCardClass}>
            <h3 className={sharedCardTitleClass}>Progressions that build</h3>
            <p className={sharedCardBodyClass}>
              Train with purpose as your balance, strength, and control improve.
            </p>
          </div>

          <div className={sharedCardClass}>
            <h3 className={sharedCardTitleClass}>Coach-led system</h3>
            <p className={sharedCardBodyClass}>
              Built around real coaching experience, not random drills.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isStartingTraining, setIsStartingTraining] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("lastSignInEmail");
    if (savedEmail) {
      setEmail(savedEmail);
    }

    const syncSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setUserEmail(session?.user?.email ?? null);
      setAuthReady(true);
      setIsStartingTraining(false);
    };

    syncSession();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
      setAuthReady(true);
      setIsStartingTraining(false);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserEmail(null);
    setMessage("You have been logged out.");
  };

  const handleLogin = async () => {
    if (!email.trim()) {
      setMessage("Enter your email first.");
      return;
    }

    const cleanEmail = email.trim();
    localStorage.setItem("lastSignInEmail", cleanEmail);
    setMessage("Sending sign-in link...");

    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
    });

    if (error) {
      setMessage("Something went wrong. Please try again.");
      return;
    }

    setMessage("Check your email for your sign-in link.");
  };

  const handleStartTraining = async () => {
    if (!authReady || isStartingTraining) return;

    setIsStartingTraining(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setIsStartingTraining(false);
        document.getElementById("signin")?.scrollIntoView({ behavior: "smooth" });
        return;
      }

      const { data: subscription } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", session.user.id)
        .single();

      if (subscription?.status === "active") {
        window.location.href = "/dashboard";
        return;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });
      const data = await res.json();

      if (data?.url) {
        window.location.href = data.url;
      } else {
        setIsStartingTraining(false);
        setMessage("Unable to start checkout. Please try again.");
      }
    } catch (err) {
      console.error(err);
      setIsStartingTraining(false);
      setMessage("Something went wrong. Please try again.");
    }
  };

  return (
    <>
    <HeroSection
      isStartingTraining={isStartingTraining}
      onStartTraining={handleStartTraining}
    />

    <InMotionSection />

    <HowItWorksSection />

    <JourneySection />

    <InsideAngleSection />

    <section className="bg-black px-6 pb-20 md:pb-24">
      <div className="mx-auto max-w-[1500px]">
        <JourneyImage src="/angle-3.png" alt="Angle athlete visual" />
      </div>
    </section>

    <FinalCtaSection
      isStartingTraining={isStartingTraining}
      onStartTraining={handleStartTraining}
    />

    <SignInSection
      authReady={authReady}
      userEmail={userEmail}
      email={email}
      message={message}
      isAdmin={userEmail === ADMIN_EMAIL}
      onEmailChange={setEmail}
      onLogin={handleLogin}
      onLogout={handleLogout}
    />

    <section className="bg-white py-10">
      <div className="mx-auto flex max-w-[1400px] items-center justify-center px-6">
        <img
          src="/angle-logo-footer-black.svg"
          alt="Angle Logo"
          className="h-auto w-full max-w-[1200px] opacity-100"
        />
      </div>
    </section>
    </>
  );
}