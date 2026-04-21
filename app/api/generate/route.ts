import { NextRequest, NextResponse } from "next/server";
import { analyzeImageFromStorage } from "@/lib/ai/analyze";
import { generatePartnerMatch, PARTNER_VARIANTS } from "@/lib/ai/generate";
import { getSessionIdFromHeaders } from "@/lib/session";
import {
  getUpload,
  getUsageCount,
  incrementUsage,
  MAX_GENERATIONS,
  saveGeneration,
} from "@/lib/data-store";
import { makeId } from "@/lib/utils";
import type { MatchKind } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromHeaders(request);
    const body = await request.json();
    const uploadId = body?.uploadId as string | undefined;
    const kind = body?.kind as MatchKind | undefined;

    if (!sessionId || !uploadId || !kind) {
      return NextResponse.json(
        { error: "Missing session, upload ID, or match kind." },
        { status: 400 },
      );
    }

    if (!(kind in PARTNER_VARIANTS)) {
      return NextResponse.json({ error: "Invalid match kind." }, { status: 400 });
    }

    if ((await getUsageCount(sessionId)) >= MAX_GENERATIONS) {
      return NextResponse.json(
        { error: "This session has reached the prototype limit." },
        { status: 429 },
      );
    }

    const upload = await getUpload(uploadId);
    if (!upload || upload.sessionId !== sessionId) {
      return NextResponse.json({ error: "Upload not found." }, { status: 404 });
    }

    const profile = await analyzeImageFromStorage({
      storagePath: upload.storagePath,
      mimeType: upload.mimeType,
    });
    const match = await generatePartnerMatch({
      sessionId,
      profile,
      kind,
    });
    const usage = await incrementUsage(sessionId);
    const generationId = makeId("partners");

    await saveGeneration({
      id: generationId,
      sessionId,
      uploadId,
      type: "partners",
      matches: [match],
      profile,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      generationId,
      match,
      profile,
      remainingGenerations: Math.max(0, MAX_GENERATIONS - usage),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate matches.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
