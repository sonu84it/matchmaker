import { NextRequest } from "next/server";

export function getSessionIdFromHeaders(request: NextRequest) {
  return request.headers.get("x-session-id")?.trim();
}
