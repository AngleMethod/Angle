"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Nav from "@/components/Nav";
import Button from "@/components/ui/Button";
import VideoPlayer from "@/components/VideoPlayer";

const ADMIN_EMAILS = [
  "josh@anglemethod.com",
  "morgan@anglemethod.com",
];

type ReviewSubmissionStatus = "uploading" | "processing" | "submitted" | "reviewed" | "error";

type ReviewPlaybackTokens = {
  playback?: string;
  thumbnail?: string;
  storyboard?: string;
};

type ReviewSubmission = {
  id: string;
  userId: string;
  userEmail: string;
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
  reviewedByEmail: string | null;
  reviewedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function AdminReviewsPage() {
  const router = useRouter();

  const [isLoaded, setIsLoaded] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<ReviewSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [coachNotes, setCoachNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  useEffect(() => {
    let isMounted = true;

    const syncAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!isMounted) return;
      const email = session?.user?.email?.toLowerCase() ?? null;
      if (!email || !ADMIN_EMAILS.includes(email)) {
        router.replace("/");
        return;
      }
      setUserEmail(email);
      setIsLoaded(true);
    };

    syncAdmin();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      if (!isMounted) return;
      syncAdmin();
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (isLoaded) fetchReviews();
  }, [isLoaded]);

  async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function fetchReviews() {
    setLoadingSubmissions(true);
    const token = await getAccessToken();
    const res = await fetch("/api/admin/reviews", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      const data = await res.json();
      const nextSubmissions = (data.submissions ?? []) as ReviewSubmission[];
      setSubmissions(nextSubmissions);
      setCoachNotes(Object.fromEntries(
        nextSubmissions.map((submission) => [submission.id, submission.coachNote ?? ""])
      ));
    }

    setLoadingSubmissions(false);
  }

  async function handleSaveReview(submissionId: string) {
    const coachNote = (coachNotes[submissionId] ?? "").trim();
    if (!coachNote) {
      setErrorById(prev => ({ ...prev, [submissionId]: "Coach note is required." }));
      return;
    }

    setSavingId(submissionId);
    setErrorById(prev => ({ ...prev, [submissionId]: "" }));

    const token = await getAccessToken();
    const res = await fetch("/api/admin/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ submissionId, coachNote }),
    });

    const data = await res.json().catch(() => ({} as { error?: string }));
    if (!res.ok) {
      setErrorById(prev => ({ ...prev, [submissionId]: data?.error || "Failed to save review." }));
      setSavingId(null);
      return;
    }

    await fetchReviews();
    setSavingId(null);
  }

  const statusStyles: Record<ReviewSubmissionStatus, string> = {
    uploading: "border-[#333] text-[#777]",
    processing: "border-blue-900 text-blue-300",
    submitted: "border-green-900 text-green-300",
    reviewed: "border-white text-white",
    error: "border-[#dc2626] text-[#dc2626]",
  };

  const statusLabels: Record<ReviewSubmissionStatus, string> = {
    uploading: "Uploading",
    processing: "Processing",
    submitted: "Submitted",
    reviewed: "Reviewed",
    error: "Error",
  };

  const secondaryLinkClass = "inline-block rounded-[4px] border border-[#222] text-[#999] text-xs font-bold tracking-widest uppercase px-4 py-2 md:px-6 md:py-3 hover:text-white hover:border-[#444] transition-colors";
  const MinimalNav = (
    <Nav variant="minimal" isLoggedIn={!!userEmail} authReady={isLoaded} />
  );

  if (!isLoaded) {
    return (
      <>
        {MinimalNav}
        <main className="min-h-screen bg-[#0a0a0a] text-white">
          <section className="pt-32 md:pt-40 pb-16 md:pb-28 px-6 md:px-12">
            <div className="mx-auto max-w-6xl">
              <p className="text-[#666] text-xs tracking-widest uppercase mb-4">Admin</p>
              <h1
                className="text-white uppercase leading-[0.95] tracking-wide mb-6"
                style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 64px)" }}
              >
                Reviews
              </h1>
              <p className="text-[#777]">Checking access...</p>
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
          <div className="mx-auto max-w-6xl">
            <div className="mb-10 md:mb-14 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
              <div>
                <p className="text-[#666] text-xs tracking-widest uppercase mb-4">Admin</p>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                  style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 64px)" }}
                >
                  Reviews
                </h1>
                <p className="text-[#777]">Review progress videos from active members.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/admin" className={secondaryLinkClass}>
                  Builder
                </Link>
                <Link href="/admin/videos" className={secondaryLinkClass}>
                  Video Library
                </Link>
                <Button onClick={fetchReviews} disabled={loadingSubmissions} size="sm">
                  {loadingSubmissions ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            {loadingSubmissions ? (
              <p className="text-[#777]">Loading reviews...</p>
            ) : submissions.length === 0 ? (
              <div className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-8 md:p-12 text-center">
                <p className="text-[#777] text-sm">No progress videos submitted yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {submissions.map((submission) => (
                  <div key={submission.id} className="rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8">
                    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="mb-3 flex flex-wrap items-center gap-3">
                          <span className={`rounded-full border px-3 py-1 text-[10px] font-bold tracking-widest uppercase ${statusStyles[submission.status]}`}>
                            {statusLabels[submission.status]}
                          </span>
                          <p className="text-[#555] text-xs">
                            {new Date(submission.submittedAt ?? submission.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <h2
                          className="text-white uppercase tracking-wide"
                          style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(22px, 2.5vw, 30px)" }}
                        >
                          {submission.userEmail}
                        </h2>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-6">
                      <div>
                        {submission.playbackId && submission.playbackTokens ? (
                          <VideoPlayer playbackId={submission.playbackId} tokens={submission.playbackTokens} />
                        ) : (
                          <div className="aspect-video w-full rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-center">
                            <p className="text-[#666] text-xs tracking-widest uppercase">
                              {submission.status === "error" ? "Upload failed" : "Video not ready"}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <p className="text-[#777] text-xs tracking-widest uppercase mb-2">Member note</p>
                          <p className="text-[#aaa] text-sm leading-relaxed rounded-lg border border-[#1e1e1e] bg-[#0a0a0a] p-4 min-h-20">
                            {submission.note || "No note added."}
                          </p>
                        </div>

                        <div>
                          <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Coach note</label>
                          <textarea
                            value={coachNotes[submission.id] ?? ""}
                            onChange={(e) => setCoachNotes(prev => ({ ...prev, [submission.id]: e.target.value }))}
                            rows={6}
                            maxLength={4000}
                            disabled={!submission.playbackId || submission.status === "uploading" || submission.status === "processing" || savingId === submission.id}
                            className="w-full rounded-lg bg-[#0a0a0a] border border-[#222] text-white px-4 py-3 text-sm placeholder-[#444] focus:outline-none focus:border-[#555] disabled:opacity-40"
                          />
                        </div>

                        {submission.reviewedAt ? (
                          <p className="text-[#666] text-xs">
                            Reviewed {new Date(submission.reviewedAt).toLocaleString()} by {submission.reviewedByEmail}
                          </p>
                        ) : null}

                        {submission.errorMessage ? (
                          <p className="text-[#dc2626] text-sm">{submission.errorMessage}</p>
                        ) : null}

                        {errorById[submission.id] ? (
                          <p className="text-[#dc2626] text-sm">{errorById[submission.id]}</p>
                        ) : null}

                        <Button
                          onClick={() => handleSaveReview(submission.id)}
                          disabled={!submission.playbackId || submission.status === "uploading" || submission.status === "processing" || savingId === submission.id}
                          size="md"
                        >
                          {savingId === submission.id
                            ? "Saving..."
                            : submission.status === "reviewed"
                            ? "Update Review"
                            : "Mark Reviewed"}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
