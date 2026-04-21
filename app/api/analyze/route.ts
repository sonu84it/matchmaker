import { NextRequest, NextResponse } from "next/server";
import { analyzeImageFromStorage } from "@/lib/ai/analyze";
import { getUpload } from "@/lib/data-store";
import { getSessionIdFromHeaders } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromHeaders(request);
    const body = await request.json();
    const uploadId = body?.uploadId as string | undefined;

    if (!sessionId || !uploadId) {
      return NextResponse.json(
        { error: "Missing session or upload ID." },
        { status: 400 },
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

    return NextResponse.json({ profile });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to analyze image.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
