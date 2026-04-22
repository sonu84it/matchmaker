import { NextRequest, NextResponse } from "next/server";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { createSignedReadUrl, uploadBufferToGcs } from "@/lib/gcs";
import { saveUpload } from "@/lib/data-store";
import { getSessionIdFromHeaders } from "@/lib/session";
import { makeId } from "@/lib/utils";

export const runtime = "nodejs";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromHeaders(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session ID." }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing image file." }, { status: 400 });
    }

    if (!allowedTypes.has(file.type)) {
      return NextResponse.json(
        { error: "Please upload a JPG, PNG, or WEBP image." },
        { status: 400 },
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Please upload an image under 10MB." },
        { status: 400 },
      );
    }

    const extension = file.type.split("/")[1] ?? "jpg";
    const uploadId = makeId("upload");
    const storagePath = `uploads/${sessionId}/${uploadId}.${extension}`;
    const arrayBuffer = await file.arrayBuffer();

    await uploadBufferToGcs({
      destination: storagePath,
      buffer: Buffer.from(arrayBuffer),
      contentType: file.type,
    });

    const signedUrl = await createSignedReadUrl(storagePath);

    await saveUpload({
      uploadId,
      sessionId,
      storagePath,
      mimeType: file.type,
      signedUrl,
      createdAt: Date.now(),
    });

    await trackAnalyticsEvent({
      eventName: "image_uploaded",
      sessionId,
      uploadId,
      route: "/api/upload",
      status: "success",
      metadata: {
        mimeType: file.type,
        fileSize: file.size,
      },
    });

    return NextResponse.json({
      uploadId,
      storagePath,
      imageUrl: signedUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to upload image.";
    await trackAnalyticsEvent({
      eventName: "api_error",
      route: "/api/upload",
      status: "error",
      errorMessage: message,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
