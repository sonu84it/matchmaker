"use client";

import { useEffect, useMemo, useState } from "react";
import {
  UploadCloud,
  Wand2,
  Sparkles,
  Zap,
  Image as ImageIcon,
  Heart,
  Camera,
  ArrowRight,
  Info,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { SceneSelector } from "@/components/SceneSelector";
import { Toast } from "@/components/Toast";
import { makeId } from "@/lib/utils";
import type {
  CoupleScene,
  MatchCard,
  MatchKind,
  StyleProfile,
} from "@/lib/types";

const MAX_CLIENT_GENERATIONS = 5;
const MATCH_ORDER: MatchKind[] = ["similar", "complementary", "dream"];

type AppStep = "upload" | "analyzing" | "results";

type SessionPayload = {
  usageCount: number;
  remainingGenerations: number;
};

type GeneratePayload = {
  match: MatchCard;
  profile: StyleProfile;
  remainingGenerations: number;
};

const MATCH_COPY: Record<
  MatchKind,
  { title: string; subtitle: string; color: "blue" | "fuchsia" | "amber" }
> = {
  similar: {
    title: "Similar Match",
    subtitle: "Closest vibe & style",
    color: "blue",
  },
  complementary: {
    title: "Complementary",
    subtitle: "Balanced contrast",
    color: "fuchsia",
  },
  dream: {
    title: "Dream Match",
    subtitle: "Aspirational & elevated",
    color: "amber",
  },
};

const sceneLabels: CoupleScene[] = [
  "Cafe Date",
  "Travel",
  "Studio Portrait",
  "Festive",
  "Sunset Walk",
  "Weekend Brunch",
];

export default function App() {
  const [step, setStep] = useState<AppStep>("upload");
  const [credits, setCredits] = useState(MAX_CLIENT_GENERATIONS);
  const [sessionId, setSessionId] = useState("");
  const [usageCount, setUsageCount] = useState(0);
  const [sessionReady, setSessionReady] = useState(false);
  const [userImage, setUserImage] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [selectedScene, setSelectedScene] = useState<CoupleScene>("Cafe Date");
  const [coupleImageUrl, setCoupleImageUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [matches, setMatches] = useState<
    Record<MatchKind, { status: "idle" | "generating" | "complete"; url: string | null; card?: MatchCard }>
  >({
    similar: { status: "idle", url: null },
    complementary: { status: "idle", url: null },
    dream: { status: "idle", url: null },
  });
  const [coupleStatus, setCoupleStatus] = useState<"idle" | "generating" | "complete">(
    "idle",
  );

  const rotateSession = (options?: { announce?: boolean }) => {
    const nextSessionId = makeId("session");
    window.localStorage.setItem("pairmuse.sessionId", nextSessionId);
    window.localStorage.setItem("pairmuse.usageCount", "0");
    setSessionReady(false);
    setUsageCount(0);
    clearFlowState();
    setSessionId(nextSessionId);
    if (options?.announce) {
      setToast("Started a fresh demo session with 5 new credits.");
    }
  };

  const clearFlowState = () => {
    if (userImage?.startsWith("blob:")) {
      URL.revokeObjectURL(userImage);
    }
    setStep("upload");
    setUserImage(null);
    setFile(null);
    setUploadId(null);
    setProfile(null);
    setSelectedMatchId(null);
    setCoupleImageUrl(null);
    setCoupleStatus("idle");
    setMatches({
      similar: { status: "idle", url: null },
      complementary: { status: "idle", url: null },
      dream: { status: "idle", url: null },
    });
  };

  useEffect(() => {
    const savedSessionId =
      window.localStorage.getItem("pairmuse.sessionId") ?? makeId("session");
    window.localStorage.setItem("pairmuse.sessionId", savedSessionId);
    setSessionId(savedSessionId);
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    let active = true;

    const syncSession = async () => {
      try {
        const response = await fetch("/api/session", {
          headers: {
            "x-session-id": sessionId,
          },
        });
        const data = (await response.json()) as SessionPayload & { error?: string };
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load session.");
        }

        if (!active) return;
        if (data.usageCount >= MAX_CLIENT_GENERATIONS) {
          rotateSession({ announce: true });
          return;
        }
        setUsageCount(data.usageCount);
      } catch {
        if (!active) return;
        const fallbackUsage = Number(
          window.localStorage.getItem("pairmuse.usageCount") ?? "0",
        );
        if (fallbackUsage >= MAX_CLIENT_GENERATIONS) {
          rotateSession({ announce: true });
          return;
        }
        setUsageCount(fallbackUsage);
      } finally {
        if (active) setSessionReady(true);
      }
    };

    syncSession();

    return () => {
      active = false;
    };
  }, [sessionId]);

  useEffect(() => {
    setCredits(Math.max(0, MAX_CLIENT_GENERATIONS - usageCount));
    window.localStorage.setItem("pairmuse.usageCount", String(usageCount));
  }, [usageCount]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (userImage?.startsWith("blob:")) {
        URL.revokeObjectURL(userImage);
      }
    };
  }, [userImage]);

  const selectedMatch = useMemo(
    () =>
      MATCH_ORDER.map((kind) => matches[kind].card).find(
        (card) => card?.id === selectedMatchId,
      ) ?? null,
    [matches, selectedMatchId],
  );

  const hasBusyState =
    step === "analyzing" ||
    MATCH_ORDER.some((kind) => matches[kind].status === "generating") ||
    coupleStatus === "generating";

  const setUsage = (remainingGenerations: number) => {
    setUsageCount(MAX_CLIENT_GENERATIONS - remainingGenerations);
  };

  const resetApp = () => {
    clearFlowState();
  };

  const startNewSession = () => {
    rotateSession({ announce: true });
  };

  const onFilePicked = (nextFile: File) => {
    if (nextFile.size > 10 * 1024 * 1024) {
      setToast("Please upload an image under 10MB.");
      return;
    }

    if (userImage?.startsWith("blob:")) {
      URL.revokeObjectURL(userImage);
    }

    setFile(nextFile);
    setUserImage(URL.createObjectURL(nextFile));
    setUploadId(null);
    setProfile(null);
    setSelectedMatchId(null);
    setCoupleImageUrl(null);
    setCoupleStatus("idle");
    setMatches({
      similar: { status: "idle", url: null },
      complementary: { status: "idle", url: null },
      dream: { status: "idle", url: null },
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      onFilePicked(droppedFile);
    }
  };

  const ensureAnalyzed = async () => {
    if (!file || !sessionId) {
      throw new Error("Please upload a photo first.");
    }

    if (uploadId && profile) {
      return { uploadId, profile };
    }

    setStep("analyzing");

    const uploadForm = new FormData();
    uploadForm.append("file", file);

    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      headers: {
        "x-session-id": sessionId,
      },
      body: uploadForm,
    });
    const uploadData = await uploadRes.json();
    if (!uploadRes.ok) throw new Error(uploadData.error ?? "Upload failed.");

    setUploadId(uploadData.uploadId);

    const analyzeRes = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-session-id": sessionId,
      },
      body: JSON.stringify({ uploadId: uploadData.uploadId }),
    });
    const analyzeData = await analyzeRes.json();
    if (!analyzeRes.ok) throw new Error(analyzeData.error ?? "Analysis failed.");

    setProfile(analyzeData.profile);
    setStep("results");

    return {
      uploadId: uploadData.uploadId as string,
      profile: analyzeData.profile as StyleProfile,
    };
  };

  const startAnalysis = async () => {
    try {
      await ensureAnalyzed();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setToast(message);
      setStep(userImage ? "upload" : "upload");
    }
  };

  const generateMatch = async (type: MatchKind) => {
    if (credits <= 0) {
      setToast("This session has reached its prototype generation limit.");
      return;
    }

    setMatches((prev) => ({
      ...prev,
      [type]: { ...prev[type], status: "generating", url: prev[type].url },
    }));

    try {
      const analyzed = await ensureAnalyzed();

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          uploadId: analyzed.uploadId,
          kind: type,
        }),
      });

      const data = (await response.json()) as GeneratePayload & { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Match generation failed.");
      }

      setMatches((prev) => ({
        ...prev,
        [type]: {
          status: "complete",
          url: data.match.imageUrl,
          card: data.match,
        },
      }));
      setProfile(data.profile);
      setUsage(data.remainingGenerations);
      setStep("results");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setToast(message);
      setMatches((prev) => ({
        ...prev,
        [type]: { ...prev[type], status: prev[type].url ? "complete" : "idle" },
      }));
      setStep(profile ? "results" : "upload");
    }
  };

  const generateCouple = async () => {
    if (!selectedMatch || !uploadId) {
      setToast("Generate a partner first and choose it for couple mode.");
      return;
    }
    if (credits <= 0) {
      setToast("This session has reached its prototype generation limit.");
      return;
    }

    setCoupleStatus("generating");

    try {
      const response = await fetch("/api/generate-couple", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          uploadId,
          partnerId: selectedMatch.id,
          scene: selectedScene,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Couple generation failed.");
      }

      setCoupleImageUrl(data.imageUrl);
      setCoupleStatus("complete");
      setUsage(data.remainingGenerations);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setToast(message);
      setCoupleStatus("idle");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-fuchsia-500/30 flex flex-col">
      <nav className="border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              PairMuse
            </span>
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-xs text-slate-400 ml-2">
              Prototype
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800">
              <Zap
                className={`w-4 h-4 ${
                  credits > 0 ? "text-yellow-400" : "text-slate-600"
                }`}
              />
              <span className="text-sm font-medium">
                {credits} <span className="text-slate-500">Credits</span>
              </span>
            </div>
            <button
              onClick={startNewSession}
              disabled={hasBusyState}
              className="px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-sm text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              New Session
            </button>
          </div>
        </div>
      </nav>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-12 flex flex-col">
        {step === "upload" && (
          <div className="flex flex-col items-center max-w-3xl mx-auto w-full">
            <div className="text-center space-y-4 mb-12">
              <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white">
                Build your{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-400">
                  AI matchboard
                </span>
              </h1>
              <p className="text-lg text-slate-400 max-w-xl mx-auto leading-relaxed">
                Analyze your style, mood, and lighting. Then generate Similar,
                Complementary, or Dream partners tailored to your vibe.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 w-full">
              <div
                className={`relative group rounded-3xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center p-8 text-center min-h-[320px] overflow-hidden ${
                  isDragging
                    ? "border-fuchsia-500 bg-fuchsia-500/10"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-600 hover:bg-slate-900"
                } ${userImage ? "border-solid border-slate-700 p-2" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                {userImage ? (
                  <div className="relative w-full h-full rounded-2xl overflow-hidden group">
                    <img
                      src={userImage}
                      alt="User upload"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                      <label className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-full text-sm font-medium transition-colors cursor-pointer">
                        Change Photo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(event) => {
                            const nextFile = event.target.files?.[0];
                            if (nextFile) onFilePicked(nextFile);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 mb-4 rounded-full bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <UploadCloud className="w-8 h-8 text-slate-400 group-hover:text-fuchsia-400 transition-colors" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Drop a portrait or browse
                    </h3>
                    <p className="text-sm text-slate-400 mb-6 max-w-[200px]">
                      JPG, PNG, or WEBP up to 10MB.
                    </p>
                    <label className="px-6 py-2.5 rounded-full bg-white text-slate-950 font-semibold hover:bg-slate-200 transition-colors cursor-pointer">
                      Browse Files
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(event) => {
                          const nextFile = event.target.files?.[0];
                          if (nextFile) onFilePicked(nextFile);
                        }}
                      />
                    </label>
                  </>
                )}
              </div>

              <div className="flex flex-col justify-center space-y-8">
                <div className="space-y-6">
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-purple-400" /> Studio Flow
                  </h3>
                  <ul className="space-y-4">
                    {[
                      "Upload one clear, front-facing portrait",
                      "We analyze your style profile once",
                      "Generate matches individually",
                      "Create stunning couple scenes",
                    ].map((text, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-medium text-slate-300">
                            {i + 1}
                          </span>
                        </div>
                        <span className="text-slate-300">{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-900/50">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-sm font-semibold text-indigo-300 mb-1">
                        Best Input for AI
                      </h4>
                      <p className="text-xs text-indigo-200/70">
                        Front-facing portrait, clean lighting, single adult face,
                        and visible outfit details.
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  onClick={startAnalysis}
                  disabled={!userImage || hasBusyState}
                  className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                    userImage && !hasBusyState
                      ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:shadow-lg hover:shadow-fuchsia-500/25 hover:-translate-y-0.5"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  Analyze My Photo <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex-1 flex flex-col items-center justify-center py-10">
            <div className="relative z-0 w-48 h-48 mb-10 shrink-0">
              <div className="absolute inset-0 rounded-full border-2 border-fuchsia-500/20 animate-[spin_3s_linear_infinite]" />
              <div className="absolute inset-2 rounded-full border-2 border-purple-500/40 animate-[spin_2s_linear_infinite_reverse]" />
              {userImage ? (
                <img
                  src={userImage}
                  alt="Analyzing"
                  className="absolute inset-4 rounded-full object-cover shadow-2xl shadow-purple-500/20"
                />
              ) : null}
              <div className="absolute inset-4 overflow-hidden rounded-full">
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_15px_rgba(255,255,255,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
              </div>
            </div>
            <div className="relative z-10 max-w-lg rounded-3xl border border-slate-800 bg-slate-900/80 px-6 py-5 text-center backdrop-blur-xl shadow-2xl shadow-fuchsia-950/20">
              <h2 className="text-2xl font-bold text-white mb-2">
                {MATCH_ORDER.some((kind) => matches[kind].status === "generating")
                  ? "Creating Match"
                  : coupleStatus === "generating"
                    ? "Creating Couple Scene"
                    : "Analyzing Profile"}
              </h2>
              <p className="text-slate-300 animate-pulse text-center">
                {MATCH_ORDER.some((kind) => matches[kind].status === "generating")
                  ? "Generating one match direction based on your saved style profile..."
                  : coupleStatus === "generating"
                    ? "Blending your uploaded portrait and selected partner into one shared scene..."
                    : "Extracting style, mood, palette, and lighting..."}
              </p>
            </div>

            <style jsx>{`
              @keyframes scan {
                0% {
                  transform: translateY(-100%);
                }
                100% {
                  transform: translateY(400%);
                }
              }
            `}</style>
          </div>
        )}

        {step === "results" && (
          <div className="w-full space-y-8">
            <div className="flex flex-col gap-6 bg-slate-900/50 border border-slate-800 p-6 rounded-3xl backdrop-blur-sm">
              <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
                <div className="flex items-center gap-6">
                  <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 border border-slate-700">
                    {userImage ? (
                      <img
                        src={userImage}
                        alt="Your Photo"
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                    <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                          Analyzed
                        </span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      Your Matchboard
                    </h2>
                    <p className="text-slate-400 text-sm">
                      Base profile saved. Generate directions below using your
                      credits.
                    </p>
                  </div>
                </div>

                <button
                  onClick={credits <= 0 ? startNewSession : resetApp}
                  className="px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-sm font-medium transition-colors"
                >
                  {credits <= 0 ? "Start New Session" : "Start Over"}
                </button>
              </div>

              {profile ? (
                <div className="grid md:grid-cols-4 gap-3">
                  <SignalChip label="Style" value={profile.style} />
                  <SignalChip label="Mood" value={profile.mood} />
                  <SignalChip label="Lighting" value={profile.lighting} />
                  <SignalChip
                    label="Palette"
                    value={profile.color_palette.join(", ")}
                  />
                </div>
              ) : null}

              {credits <= 0 ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <p className="text-sm font-medium text-amber-300">
                    This demo session is out of credits.
                  </p>
                  <p className="mt-1 text-xs text-amber-200/80">
                    Use <span className="font-semibold">New Session</span> to reset
                    credits and keep testing.
                  </p>
                </div>
              ) : null}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <MatchCardView
                title={MATCH_COPY.similar.title}
                subtitle={MATCH_COPY.similar.subtitle}
                type="similar"
                icon={<ImageIcon className="w-5 h-5" />}
                color="blue"
                data={matches.similar}
                selected={selectedMatchId === matches.similar.card?.id}
                onGenerate={() => generateMatch("similar")}
                onSelect={() => setSelectedMatchId(matches.similar.card?.id ?? null)}
                credits={credits}
                disabled={hasBusyState}
              />

              <MatchCardView
                title={MATCH_COPY.complementary.title}
                subtitle={MATCH_COPY.complementary.subtitle}
                type="complementary"
                icon={<Zap className="w-5 h-5" />}
                color="fuchsia"
                data={matches.complementary}
                selected={selectedMatchId === matches.complementary.card?.id}
                onGenerate={() => generateMatch("complementary")}
                onSelect={() =>
                  setSelectedMatchId(matches.complementary.card?.id ?? null)
                }
                credits={credits}
                disabled={hasBusyState}
              />

              <MatchCardView
                title={MATCH_COPY.dream.title}
                subtitle={MATCH_COPY.dream.subtitle}
                type="dream"
                icon={<Heart className="w-5 h-5" />}
                color="amber"
                data={matches.dream}
                selected={selectedMatchId === matches.dream.card?.id}
                onGenerate={() => generateMatch("dream")}
                onSelect={() => setSelectedMatchId(matches.dream.card?.id ?? null)}
                credits={credits}
                disabled={hasBusyState}
              />
            </div>

            <div className="grid lg:grid-cols-[0.9fr_1.1fr] gap-6">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
                <div>
                  <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Camera className="w-5 h-5 text-fuchsia-400" />
                    Couple Scene
                  </h3>
                  <p className="text-sm text-slate-400 mt-2">
                    {selectedMatch
                      ? `Selected partner: ${selectedMatch.tag}`
                      : "Generate a partner and select it to create a couple photo."}
                  </p>
                </div>

                {selectedMatch ? (
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                    <div className="h-14 w-14 overflow-hidden rounded-xl border border-slate-700 shrink-0">
                      <img
                        src={selectedMatch.imageUrl}
                        alt={selectedMatch.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white">
                        Using selected partner
                      </p>
                      <p className="truncate text-xs text-slate-400">
                        {selectedMatch.title} · {selectedMatch.tag}
                      </p>
                    </div>
                  </div>
                ) : null}

                <SceneSelector
                  selected={selectedScene}
                  onSelect={(scene) => setSelectedScene(scene)}
                />

                <div className="text-xs text-slate-500">
                  Available scenes: {sceneLabels.join(", ")}
                </div>

                <button
                  onClick={generateCouple}
                  disabled={!selectedMatch || hasBusyState || credits <= 0}
                  className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all duration-300 ${
                    selectedMatch && !hasBusyState && credits > 0
                      ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white hover:shadow-lg hover:shadow-fuchsia-500/25 hover:-translate-y-0.5"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  Create Couple Photo <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className="rounded-3xl border border-slate-800 bg-slate-900/60 overflow-hidden min-h-[420px]">
                {coupleImageUrl ? (
                  <div className="relative h-full min-h-[420px]">
                    <img
                      src={coupleImageUrl}
                      alt="Generated couple scene"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          Couple Scene Ready
                        </p>
                        <p className="text-xs text-slate-300 mt-1">
                          Scene: {selectedScene}
                        </p>
                      </div>
                      <a
                        href={coupleImageUrl}
                        download="pairmuse-couple.png"
                        className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white transition-colors border border-white/10 text-sm font-medium"
                      >
                        Download
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="h-full min-h-[420px] flex items-center justify-center p-8 text-center">
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-slate-800 flex items-center justify-center">
                        <Camera className="w-8 h-8 text-slate-500" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-white">
                          Couple preview area
                        </h4>
                        <p className="text-sm text-slate-400 mt-2 max-w-sm">
                          Select any generated partner card and create a shared
                          scene that uses both faces as visual references.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <Toast message={toast} />
    </div>
  );
}

function SignalChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-950/60 border border-slate-800 px-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="text-sm text-slate-200 mt-2">{value}</p>
    </div>
  );
}

function MatchCardView({
  title,
  subtitle,
  type,
  icon,
  color,
  data,
  selected,
  onGenerate,
  onSelect,
  credits,
  disabled,
}: {
  title: string;
  subtitle: string;
  type: MatchKind;
  icon: React.ReactNode;
  color: "blue" | "fuchsia" | "amber";
  data: {
    status: "idle" | "generating" | "complete";
    url: string | null;
    card?: MatchCard;
  };
  selected: boolean;
  onGenerate: () => void;
  onSelect: () => void;
  credits: number;
  disabled: boolean;
}) {
  const isGenerating = data.status === "generating";
  const isComplete = data.status === "complete";
  const isIdle = data.status === "idle";

  const colorMap = {
    blue: "from-blue-500/20 to-cyan-500/20 border-blue-500/30 text-blue-400 hover:border-blue-500/50",
    fuchsia:
      "from-fuchsia-500/20 to-purple-500/20 border-fuchsia-500/30 text-fuchsia-400 hover:border-fuchsia-500/50",
    amber:
      "from-amber-500/20 to-orange-500/20 border-amber-500/30 text-amber-400 hover:border-amber-500/50",
  };

  const btnColorMap = {
    blue: "bg-blue-500 hover:bg-blue-600",
    fuchsia: "bg-fuchsia-500 hover:bg-fuchsia-600",
    amber: "bg-amber-500 hover:bg-amber-600",
  };

  return (
    <div
      className={`relative rounded-3xl border bg-slate-900/60 overflow-hidden flex flex-col h-[420px] transition-all duration-300 ${
        isIdle ? "hover:-translate-y-1" : ""
      } ${isComplete ? "border-slate-700" : "border-slate-800"}`}
    >
      <div className="p-5 z-10 flex justify-between items-start bg-gradient-to-b from-slate-900/90 to-transparent">
        <div>
          <div
            className={`flex items-center gap-2 font-semibold mb-1 ${
              colorMap[color].split(" ")[3]
            }`}
          >
            {icon} {title}
          </div>
          <p className="text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
        {isIdle && (
          <div
            className={`w-full h-full rounded-2xl border-2 border-dashed bg-gradient-to-b ${
              colorMap[color]
            } flex flex-col items-center justify-center text-center p-6 transition-all`}
          >
            <Lock className="w-8 h-8 opacity-50 mb-4" />
            <p className="text-sm text-slate-300 mb-3">
              Generates one unique partner based on this direction.
            </p>
            <p className="text-xs text-slate-500 mb-6">
              One image per request keeps the live quota stable.
            </p>
            <button
              onClick={onGenerate}
              disabled={credits <= 0 || disabled}
              className={`px-6 py-2.5 rounded-full text-white font-medium flex items-center gap-2 transition-all ${
                credits > 0 && !disabled
                  ? btnColorMap[color]
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              <Zap className="w-4 h-4" /> Generate (1 Credit)
            </button>
          </div>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center justify-center animate-pulse">
            <div
              className={`w-16 h-16 rounded-full bg-gradient-to-tr ${
                colorMap[color].split(" ").slice(0, 2).join(" ")
              } flex items-center justify-center mb-4 animate-spin`}
            >
              <Wand2 className="w-6 h-6 text-white" />
            </div>
            <p className="text-sm font-medium text-slate-300">Creating match...</p>
          </div>
        )}

        {isComplete && data.url && data.card && (
          <div className="absolute inset-0">
            <img
              src={data.url}
              alt={title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-0 right-0 px-4 flex justify-between items-end gap-3">
              <div className="flex gap-2">
                <button
                  onClick={onGenerate}
                  disabled={disabled}
                  className="p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-colors border border-white/10 disabled:opacity-50"
                >
                  <Wand2 className="w-5 h-5" />
                </button>
                <button
                  onClick={onSelect}
                  className={`p-3 backdrop-blur-md rounded-full text-white transition-colors border ${
                    selected
                      ? "bg-fuchsia-500/70 border-fuchsia-300/50"
                      : "bg-white/10 hover:bg-white/20 border-white/10"
                  }`}
                >
                  <Camera className="w-5 h-5" />
                </button>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-xs font-medium bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full text-white border border-white/10">
                  Generated
                </span>
                <span className="text-[11px] text-slate-200 bg-black/40 px-3 py-1 rounded-full border border-white/10">
                  {selected ? "Selected for couple" : "Tap camera to use"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
