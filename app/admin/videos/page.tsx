"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import * as UpChunk from "@mux/upchunk";
import Nav from "@/components/Nav";
import Button from "@/components/ui/Button";

const ADMIN_EMAIL = "josh@notecreativestudios.com";

type Video = {
  id: string;
  mux_playback_id: string;
  title: string;
  description: string | null;
  level: string | null;
  category: string | null;
  duration_seconds: number | null;
  created_at: string;
};

type UploadStage = "idle" | "uploading" | "saving" | "success" | "error";

export default function AdminVideosPage() {
  const router = useRouter();

  const [isLoaded, setIsLoaded] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("");
  const [category, setCategory] = useState("");

  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");

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
    if (isLoaded) fetchVideos();
  }, [isLoaded]);

  async function getAccessToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function fetchVideos() {
    setLoadingVideos(true);
    const token = await getAccessToken();
    const res = await fetch("/api/admin/videos", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setVideos(data.videos ?? []);
    }
    setLoadingVideos(false);
  }

  function resetForm() {
    setFile(null);
    setTitle("");
    setDescription("");
    setLevel("");
    setCategory("");
    setUploadStage("idle");
    setUploadProgress(0);
    setUploadError("");
  }

  function closeUpload() {
    setUploadOpen(false);
    resetForm();
  }

  async function handleUpload() {
    if (!file) {
      setUploadError("Pick a video file first.");
      return;
    }
    if (!title.trim()) {
      setUploadError("Title is required.");
      return;
    }

    setUploadError("");
    setUploadStage("uploading");
    setUploadProgress(0);

    const token = await getAccessToken();

    const createRes = await fetch("/api/admin/videos/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!createRes.ok) {
      setUploadError("Failed to create upload. Try again.");
      setUploadStage("error");
      return;
    }

    const { uploadId, uploadUrl } = await createRes.json();

    const upload = UpChunk.createUpload({
      endpoint: uploadUrl,
      file,
      chunkSize: 30720,
    });

    upload.on("progress", (event) => {
      const percent = Number(event.detail);
      if (!Number.isNaN(percent)) {
        setUploadProgress(Math.round(percent));
      }
    });

    upload.on("error", (event) => {
      const detail = event.detail as { message?: string } | undefined;
      setUploadError(`Upload error: ${detail?.message ?? "unknown"}`);
      setUploadStage("error");
    });

    upload.on("success", async () => {
      setUploadStage("saving");

      const saveRes = await fetch("/api/admin/videos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uploadId,
          title: title.trim(),
          description: description.trim(),
          level: level.trim(),
          category: category.trim(),
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json().catch(() => ({} as { error?: string }));
        setUploadError(data?.error || "Failed to save video.");
        setUploadStage("error");
        return;
      }

      setUploadStage("success");
      await fetchVideos();
      setTimeout(() => {
        closeUpload();
      }, 1500);
    });
  }

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
              <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Library</p>
              <h1
                className="text-white uppercase leading-[0.95] tracking-wide mb-6"
                style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 64px)" }}
              >
                Videos
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
                <p className="text-[#666] text-xs tracking-widest uppercase mb-4">— Library</p>
                <h1
                  className="text-white uppercase leading-[0.95] tracking-wide mb-4"
                  style={{ fontFamily: "var(--font-bebas)", fontSize: "clamp(36px, 5vw, 64px)" }}
                >
                  Videos
                </h1>
                <p className="text-[#777]">Manage the master video library.</p>
              </div>
              {!uploadOpen ? (
                <Button onClick={() => setUploadOpen(true)} size="sm">
                  Upload Video
                </Button>
              ) : null}
            </div>

            {uploadOpen ? (
              <div className="mb-10 md:mb-14 rounded-lg border border-[#1e1e1e] bg-[#111110] p-6 md:p-8">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-[#666] text-xs tracking-widest uppercase">— New Video</p>
                  <button
                    onClick={closeUpload}
                    disabled={uploadStage === "uploading" || uploadStage === "saving"}
                    className="text-[#777] text-xs tracking-widest uppercase hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Video file</label>
                    <input
                      type="file"
                      accept="video/*"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      disabled={uploadStage === "uploading" || uploadStage === "saving"}
                      className="block w-full text-sm text-[#aaa] file:mr-4 file:py-2 file:px-4 file:rounded-[4px] file:border-0 file:bg-[#222] file:text-white file:text-xs file:font-bold file:tracking-widest file:uppercase file:cursor-pointer disabled:opacity-40"
                    />
                  </div>

                  <div>
                    <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={uploadStage === "uploading" || uploadStage === "saving"}
                      className="w-full rounded-lg bg-[#0a0a0a] border border-[#222] text-white px-4 py-3 text-sm placeholder-[#444] focus:outline-none focus:border-[#555] disabled:opacity-40"
                    />
                  </div>

                  <div>
                    <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Description</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      disabled={uploadStage === "uploading" || uploadStage === "saving"}
                      className="w-full rounded-lg bg-[#0a0a0a] border border-[#222] text-white px-4 py-3 text-sm placeholder-[#444] focus:outline-none focus:border-[#555] disabled:opacity-40"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Level</label>
                      <input
                        type="text"
                        value={level}
                        onChange={(e) => setLevel(e.target.value)}
                        placeholder="e.g. beginner"
                        disabled={uploadStage === "uploading" || uploadStage === "saving"}
                        className="w-full rounded-lg bg-[#0a0a0a] border border-[#222] text-white px-4 py-3 text-sm placeholder-[#444] focus:outline-none focus:border-[#555] disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="block text-[#777] text-xs tracking-widest uppercase mb-2">Category</label>
                      <input
                        type="text"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        placeholder="e.g. wall-work"
                        disabled={uploadStage === "uploading" || uploadStage === "saving"}
                        className="w-full rounded-lg bg-[#0a0a0a] border border-[#222] text-white px-4 py-3 text-sm placeholder-[#444] focus:outline-none focus:border-[#555] disabled:opacity-40"
                      />
                    </div>
                  </div>

                  {uploadStage === "uploading" ? (
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[#777] text-xs tracking-widest uppercase">Uploading</p>
                        <p className="text-[#aaa] text-xs">{uploadProgress}%</p>
                      </div>
                      <div className="h-1 bg-[#1e1e1e] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white transition-all duration-200"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {uploadStage === "saving" ? (
                    <p className="text-[#aaa] text-sm">Processing on Mux...</p>
                  ) : null}

                  {uploadStage === "success" ? (
                    <p className="text-sm" style={{ color: "oklch(0.68 0.14 155)" }}>Saved.</p>
                  ) : null}

                  {uploadError ? (
                    <p className="text-sm text-[#dc2626]">{uploadError}</p>
                  ) : null}

                  <div className="pt-2">
                    <Button
                      onClick={handleUpload}
                      disabled={uploadStage === "uploading" || uploadStage === "saving" || uploadStage === "success"}
                    >
                      {uploadStage === "uploading"
                        ? "Uploading..."
                        : uploadStage === "saving"
                        ? "Saving..."
                        : uploadStage === "success"
                        ? "Saved"
                        : "Upload"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-[#1e1e1e]">
              <table className="w-full">
                <thead className="bg-[#111110] border-b border-[#1e1e1e]">
                  <tr>
                    <th className="text-left px-6 py-4 text-xs tracking-widest uppercase text-[#666] font-medium">Title</th>
                    <th className="text-left px-6 py-4 text-xs tracking-widest uppercase text-[#666] font-medium">Level</th>
                    <th className="text-left px-6 py-4 text-xs tracking-widest uppercase text-[#666] font-medium">Category</th>
                    <th className="text-left px-6 py-4 text-xs tracking-widest uppercase text-[#666] font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingVideos ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-6 text-[#777] text-sm">Loading videos...</td>
                    </tr>
                  ) : videos.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-6 text-[#777] text-sm">No videos yet. Upload your first one.</td>
                    </tr>
                  ) : (
                    videos.map((v) => (
                      <tr key={v.id} className="border-b border-[#1e1e1e] last:border-b-0 hover:bg-[#111110] transition-colors">
                        <td className="px-6 py-4 text-white text-sm">{v.title}</td>
                        <td className="px-6 py-4 text-[#aaa] text-sm">{v.level || "—"}</td>
                        <td className="px-6 py-4 text-[#aaa] text-sm">{v.category || "—"}</td>
                        <td className="px-6 py-4 text-[#777] text-sm">{new Date(v.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
