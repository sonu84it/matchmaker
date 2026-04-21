import { NextRequest, NextResponse } from "next/server";
import { getSessionIdFromHeaders } from "@/lib/session";
import { touchSession } from "@/lib/data-store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromHeaders(request);
    if (!sessionId) {
      return NextResponse.json({ error: "Missing session ID." }, { status: 400 });
    }

    const session = await touchSession(sessionId);
    return NextResponse.json(session);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load session.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
