"use client";

import { useEffect, useMemo, useState } from "react";
import { ProgressLoader } from "@/components/ProgressLoader";
import { SceneSelector } from "@/components/SceneSelector";
import { Toast } from "@/components/Toast";
import { UploadDropzone } from "@/components/UploadDropzone";
import { makeId } from "@/lib/utils";
import type { CoupleScene, MatchCard, MatchKind, StyleProfile } from "@/lib/types";

const MAX_CLIENT_GENERATIONS = 5;

type AppStage = "idle" | "ready" | "processing" | "results" | "couple";

type SessionPayload = {
  usageCount: number;
  remainingGenerations: number;
};

type GeneratePayload = {
  match: MatchCard;
  profile: StyleProfile;
  remainingGenerations: number;
};

const MATCH_ORDER: MatchKind[] = ["similar", "complementary", "dream"];

const MATCH_COPY: Record<
  MatchKind,
  { title: string; description: string; badge: string }
> = {
  similar: {
    title: "Similar Match",
    description: "Closest to your existing aesthetic, styling pace, and visual mood.",
    badge: "Closest vibe",
  },
  complementary: {
    title: "Complementary Match",
    description: "Same overall compatibility, but with a little more contrast and spark.",
    badge: "Balanced contrast",
  },
  dream: {
    title: "Dream Match",
    description: "A more cinematic, elevated take on your best visual pairing.",
    badge: "Aspirational",
  },
};

const featurePills = [
  "No login",
  "One portrait",
  "Analyze once",
  "Generate matches one at a time",
];

const signalRows = [
  { label: "Reads", value: "Style, mood, palette, lighting" },
  { label: "Creates", value: "One match direction per request" },
  { label: "Quota-aware", value: "Designed for current Vertex image limits" },
];

export default function HomePage() {
  const [sessionId, setSessionId] = useState("");
  const [usageCount, setUsageCount] = useState(0);
  const [stage, setStage] = useState<AppStage>("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadId, setUploadId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StyleProfile | null>(null);
  const [matches, setMatches] = useState<Partial<Record<MatchKind, MatchCard>>>({});
  const [selectedMatch, setSelectedMatch] = useState<MatchCard | null>(null);
  const [selectedScene, setSelectedScene] = useState<CoupleScene>("Cafe Date");
  const [coupleImageUrl, setCoupleImageUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<MatchKind | "analyze" | "couple" | null>(
    null,
  );
  const [sessionReady, setSessionReady] = useState(false);

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
        setUsageCount(data.usageCount);
        window.localStorage.setItem("pairmuse.usageCount", String(data.usageCount));
      } catch {
        const fallbackUsage = Number(
          window.localStorage.getItem("pairmuse.usageCount") ?? "0",
        );
        if (!active) return;
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
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const remaining = useMemo(
    () => Math.max(0, MAX_CLIENT_GENERATIONS - usageCount),
    [usageCount],
  );

  const generatedMatches = useMemo(
    () =>
      MATCH_ORDER.map((kind) => matches[kind]).filter(Boolean) as MatchCard[],
    [matches],
  );

  const setUsage = (value: number) => {
    setUsageCount(value);
    window.localStorage.setItem("pairmuse.usageCount", String(value));
  };

  const onFileSelect = (nextFile: File) => {
    if (nextFile.size > 10 * 1024 * 1024) {
      setToast("Please upload an image under 10MB.");
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setStage("ready");
    setUploadId(null);
    setProfile(null);
    setMatches({});
    setSelectedMatch(null);
    setCoupleImageUrl(null);
  };

  const ensureAnalyzed = async (showAnalyzeBusy = true) => {
    if (!file || !sessionId) {
      throw new Error("Please upload a photo first.");
    }

    if (uploadId && profile) {
      return { uploadId, profile };
    }

    if (showAnalyzeBusy) {
      setBusyKind("analyze");
    }
    setStage("processing");
    setCurrentStep(0);

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

    setCurrentStep(1);
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

    setCurrentStep(2);
    setProfile(analyzeData.profile);
    setStage("results");

    return {
      uploadId: uploadData.uploadId as string,
      profile: analyzeData.profile as StyleProfile,
    };
  };

  const runAnalyzeFlow = async () => {
    try {
      await ensureAnalyzed(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setToast(message);
      setStage(file ? "ready" : "idle");
    } finally {
      setBusyKind(null);
    }
  };

  const generateMatch = async (kind: MatchKind) => {
    if (!sessionId) return;
    if (remaining <= 0) {
      setToast("This session has reached its prototype generation limit.");
      return;
    }

    setBusyKind(kind);

    try {
      const analyzed = await ensureAnalyzed(false);
      setStage("processing");
      setCurrentStep(3);

      const generateRes = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": sessionId,
        },
        body: JSON.stringify({
          uploadId: analyzed.uploadId,
          kind,
        }),
      });
      const generateData = (await generateRes.json()) as GeneratePayload & {
        error?: string;
      };
      if (!generateRes.ok) {
        throw new Error(generateData.error ?? "Generation failed.");
      }

      setMatches((current) => ({
        ...current,
        [kind]: generateData.match,
      }));
      setProfile(generateData.profile);
      setUsage(MAX_CLIENT_GENERATIONS - generateData.remainingGenerations);
      setStage("results");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setToast(message);
      setStage(profile ? "results" : file ? "ready" : "idle");
    } finally {
      setBusyKind(null);
    }
  };

  const runCoupleFlow = async () => {
    if (!selectedMatch || !profile || !uploadId) {
      setToast("Generate a partner card first.");
      return;
    }
    if (remaining <= 0) {
      setToast("This session has reached its prototype generation limit.");
      return;
    }

    setBusyKind("couple");
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
      if (!response.ok) throw new Error(data.error ?? "Couple generation failed.");

      setCoupleImageUrl(data.imageUrl);
      setUsage(MAX_CLIENT_GENERATIONS - data.remainingGenerations);
      setStage("couple");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";
      setToast(message);
    } finally {
      setBusyKind(null);
    }
  };

  const startOver = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setStage("idle");
    setFile(null);
    setPreviewUrl(null);
    setUploadId(null);
    setProfile(null);
    setMatches({});
    setSelectedMatch(null);
    setCoupleImageUrl(null);
  };

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[12%] top-10 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute right-[8%] top-44 h-72 w-72 rounded-full bg-mist/10 blur-3xl" />
        <div className="absolute bottom-16 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-white/[0.04] blur-3xl" />
      </div>

      <section className="relative overflow-hidden rounded-[36px] border border-white/10 bg-black/25 px-6 py-8 shadow-glow sm:px-8 sm:py-10 lg:px-10">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:42px_42px] opacity-[0.08]" />
        <div className="relative z-10 grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="space-y-7">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.32em] text-mist">
                PairMuse AI (Prototype)
              </span>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-accent">
                Quota-aware mode
              </span>
            </div>

            <div className="max-w-3xl space-y-4">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
                Upload your photo.
                <br />
                Build your AI matchboard.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted sm:text-lg">
                Analyze once, then generate Similar, Complementary, and Dream
                partner directions one at a time. The prototype now follows the
                live Vertex image quota so the experience stays usable in
                production.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {featurePills.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-ink"
                >
                  {pill}
                </span>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {signalRows.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4"
                >
                  <p className="text-xs uppercase tracking-[0.28em] text-mist/70">
                    {item.label}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-ink">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="glass rounded-[28px] p-5 shadow-glow">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-mist/70">
                      Session Status
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      {sessionReady ? remaining : "..."}/5 left
                    </h2>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted">
                    Anonymous
                  </div>
                </div>
                <p className="mt-3 text-sm leading-6 text-muted">
                  One partner image equals one generation. Couple photos count as
                  one more generation.
                </p>
              </div>

              <div className="glass rounded-[28px] p-5 shadow-glow">
                <p className="text-xs uppercase tracking-[0.28em] text-mist/70">
                  Production Constraint
                </p>
                <div className="mt-4 space-y-3 text-sm leading-6 text-muted">
                  <p>Current live image quota is limited.</p>
                  <p>So PairMuse now creates one partner card per request.</p>
                  <p>You still keep the same three visual directions.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {MATCH_ORDER.map((kind) => (
                <div
                  key={kind}
                  className="glass rounded-[24px] p-3 text-center shadow-glow"
                >
                  <div className="mb-3 h-24 rounded-[18px] bg-gradient-to-br from-white/10 via-white/[0.04] to-transparent" />
                  <p className="text-xs uppercase tracking-[0.24em] text-mist/70">
                    {MATCH_COPY[kind].badge}
                  </p>
                  <p className="mt-2 text-sm text-ink">{MATCH_COPY[kind].title}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="relative mt-8 grid gap-6 lg:grid-cols-[1.02fr_0.98fr]">
        <div>
          <UploadDropzone
            previewUrl={previewUrl}
            isBusy={busyKind !== null}
            onFileSelect={onFileSelect}
          />
        </div>

        <div className="space-y-5">
          <div className="glass rounded-[30px] p-6 shadow-glow">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-mist/70">
                  Studio Flow
                </p>
                <h2 className="mt-2 text-2xl font-semibold">
                  Analyze first, generate next
                </h2>
              </div>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-muted">
                Quota-safe
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {[
                "Upload one clear portrait",
                "Analyze the style profile once",
                "Generate Similar, Complementary, or Dream individually",
                "Use any generated partner for a couple scene",
              ].map((step, index) => (
                <div
                  key={step}
                  className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-sm text-ink">
                    {index + 1}
                  </div>
                  <span className="text-sm text-muted">{step}</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              disabled={!file || busyKind !== null || !sessionReady}
              onClick={runAnalyzeFlow}
              className="mt-6 w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-background transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busyKind === "analyze" ? "Reading your style..." : "Analyze My Photo"}
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="glass rounded-[26px] p-5 shadow-glow">
              <p className="text-xs uppercase tracking-[0.28em] text-mist/70">
                Best Input
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">
                Front-facing portrait, clean lighting, one adult face, visible
                outfit details.
              </p>
            </div>
            <div className="glass rounded-[26px] p-5 shadow-glow">
              <p className="text-xs uppercase tracking-[0.28em] text-mist/70">
                Prototype Scope
              </p>
              <p className="mt-3 text-sm leading-6 text-muted">
                Optimized for real quota limits, minimal friction, and live demo
                reliability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {stage === "processing" ? (
        <section className="mt-8">
          <ProgressLoader currentStep={currentStep} />
        </section>
      ) : null}

      {profile ? (
        <section className="mt-8 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-mist/70">
                Matchboard
              </p>
              <h2 className="mt-2 text-3xl font-semibold">
                Generate each direction when you want it
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Your visual profile is cached for this session, so each partner
                card now generates one at a time instead of in a single batch.
              </p>
            </div>
            <button
              type="button"
              onClick={startOver}
              className="rounded-full border border-white/10 px-4 py-2 text-sm text-ink hover:bg-white/5"
            >
              Start over
            </button>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {MATCH_ORDER.map((kind) => {
              const card = matches[kind];
              const isBusy = busyKind === kind;
              const isSelected = selectedMatch?.id === card?.id;

              return (
                <div key={kind} className="glass rounded-[28px] p-4 shadow-glow">
                  {card ? (
                    <img
                      src={card.imageUrl}
                      alt={card.title}
                      className="h-80 w-full rounded-[22px] object-cover"
                    />
                  ) : (
                    <div className="flex h-80 w-full items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-white/[0.03] px-6 text-center">
                      <div>
                        <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-accent/15 to-mist/15" />
                        <p className="mt-5 text-lg font-medium text-ink">
                          {MATCH_COPY[kind].title}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-muted">
                          {MATCH_COPY[kind].description}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 px-1 pb-1 pt-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-mist/70">
                        {MATCH_COPY[kind].badge}
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-ink">
                        {card?.tag ?? MATCH_COPY[kind].title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        {MATCH_COPY[kind].description}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => generateMatch(kind)}
                        disabled={busyKind !== null || remaining <= 0}
                        className="flex-1 rounded-full bg-ink px-4 py-3 text-sm font-medium text-background transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isBusy
                          ? "Generating..."
                          : card
                            ? "Regenerate"
                            : `Generate ${MATCH_COPY[kind].title}`}
                      </button>

                      {card ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMatch(card);
                            setCoupleImageUrl(null);
                            setStage("results");
                          }}
                          disabled={busyKind !== null}
                          className={`rounded-full border px-4 py-3 text-sm transition ${
                            isSelected
                              ? "border-accent/40 bg-accent/10 text-accent"
                              : "border-white/10 text-ink hover:bg-white/5"
                          }`}
                        >
                          {isSelected ? "Selected" : "Use for Couple"}
                        </button>
                      ) : null}

                      {card ? (
                        <a
                          href={card.imageUrl}
                          download={`${card.kind}.png`}
                          className="rounded-full border border-white/10 px-4 py-3 text-sm text-ink transition hover:bg-white/5"
                        >
                          Download
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {profile ? (
        <section className="mt-8 grid gap-6 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="space-y-5">
            <div className="glass rounded-[30px] p-6 shadow-glow">
              <p className="text-xs uppercase tracking-[0.28em] text-mist/70">
                Couple Mode
              </p>
              <h2 className="mt-2 text-2xl font-semibold">
                Turn a generated partner into a shared scene
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                {selectedMatch
                  ? `Selected partner: ${selectedMatch.tag}`
                  : "Generate at least one partner card above, then choose one for couple mode."}
              </p>

              <div className="mt-5">
                <SceneSelector
                  selected={selectedScene}
                  onSelect={(scene) => setSelectedScene(scene)}
                />
              </div>

              <button
                type="button"
                onClick={runCoupleFlow}
                disabled={!selectedMatch || busyKind !== null}
                className="mt-6 w-full rounded-full bg-ink px-5 py-3 text-sm font-medium text-background transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyKind === "couple"
                  ? "Generating couple image..."
                  : "Generate Couple Image"}
              </button>
            </div>

            <div className="glass rounded-[30px] p-6 shadow-glow">
              <p className="text-xs uppercase tracking-[0.28em] text-mist/70">
                Extracted Style Signals
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-muted">
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/60">
                    Style
                  </p>
                  <p className="mt-2 text-ink">{profile.style}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/60">
                    Mood
                  </p>
                  <p className="mt-2 text-ink">{profile.mood}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/60">
                    Lighting
                  </p>
                  <p className="mt-2 text-ink">{profile.lighting}</p>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-mist/60">
                    Palette
                  </p>
                  <p className="mt-2 text-ink">
                    {profile.color_palette.join(", ")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-[30px] p-4 shadow-glow">
            {coupleImageUrl ? (
              <div className="space-y-4">
                <img
                  src={coupleImageUrl}
                  alt="Generated couple portrait"
                  className="h-[460px] w-full rounded-[24px] object-cover"
                />
                <div className="flex flex-wrap gap-3">
                  <a
                    href={coupleImageUrl}
                    download="pairmuse-couple.png"
                    className="rounded-full bg-ink px-4 py-3 text-sm font-medium text-background"
                  >
                    Download Image
                  </a>
                  <button
                    type="button"
                    onClick={runCoupleFlow}
                    disabled={!selectedMatch || busyKind !== null}
                    className="rounded-full border border-white/10 px-4 py-3 text-sm text-ink hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Regenerate
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex h-[460px] flex-col items-center justify-center rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] px-6 text-center">
                <div className="h-24 w-24 rounded-full bg-gradient-to-br from-accent/20 to-mist/15 blur-sm" />
                <p className="mt-6 text-lg font-medium text-ink">
                  Couple portrait preview
                </p>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted">
                  Generate any one partner card, select it, then render a couple
                  scene without batching multiple image requests at once.
                </p>
              </div>
            )}
          </div>
        </section>
      ) : null}

      <Toast message={toast} />
    </main>
  );
}
