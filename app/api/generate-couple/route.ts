import { NextRequest, NextResponse } from "next/server";
import { generateCoupleImage } from "@/lib/ai/generate";
import { getSessionIdFromHeaders } from "@/lib/session";
import {
  findPartnerMatch,
  getUpload,
  getUsageCount,
  incrementUsage,
  MAX_GENERATIONS,
  saveGeneration,
} from "@/lib/data-store";
import type { CoupleScene, StyleProfile } from "@/lib/types";
import { makeId } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromHeaders(request);
    const body = await request.json();
    const uploadId = body?.uploadId as string | undefined;
    const partnerId = body?.partnerId as string | undefined;
    const scene = body?.scene as CoupleScene | undefined;

    if (!sessionId || !uploadId || !partnerId || !scene) {
      return NextResponse.json(
        { error: "Missing session, upload, partner, or scene." },
        { status: 400 },
      );
    }

    if ((await getUsageCount(sessionId)) >= MAX_GENERATIONS) {
      return NextResponse.json(
        { error: "This session has reached the prototype limit." },
        { status: 429 },
      );
    }

    const partnerRecord = await findPartnerMatch({
      sessionId,
      uploadId,
      partnerId,
    });
    const match = partnerRecord?.match;
    const profile = partnerRecord?.profile as StyleProfile | undefined;
    const upload = uploadId ? await getUpload(uploadId) : null;

    if (!partnerRecord || !match || !profile || !upload) {
      return NextResponse.json(
        { error: "Match results not found. Please generate partners first." },
        { status: 404 },
      );
    }

    const couple = await generateCoupleImage({
      sessionId,
      partnerTag: match.tag,
      scene,
      profile,
      originalImage: {
        storagePath: upload.storagePath,
        mimeType: upload.mimeType,
      },
      partnerImage: {
        storagePath: match.storagePath,
        mimeType: "image/png",
      },
    });
    const usage = await incrementUsage(sessionId);
    const generationId = makeId("couple");

    await saveGeneration({
      id: generationId,
      sessionId,
      uploadId,
      type: "couple",
      imageUrl: couple.imageUrl,
      storagePath: couple.storagePath,
      createdAt: Date.now(),
    });

    return NextResponse.json({
      ...couple,
      remainingGenerations: Math.max(0, MAX_GENERATIONS - usage),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to generate couple image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
