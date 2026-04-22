import { BigQuery } from "@google-cloud/bigquery";
import { env } from "@/lib/config";
import { makeId } from "@/lib/utils";

export type AnalyticsEvent = {
  eventName:
    | "session_touched"
    | "image_uploaded"
    | "image_analyzed"
    | "partner_generated"
    | "couple_generated"
    | "api_error";
  sessionId?: string;
  uploadId?: string;
  generationId?: string;
  partnerId?: string;
  matchKind?: string;
  scene?: string;
  route: string;
  status: "success" | "error";
  usageCount?: number;
  remainingGenerations?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
};

const analyticsEnabled = env.bigQueryAnalyticsEnabled === "true";
const bigQuery =
  analyticsEnabled && env.projectId
    ? new BigQuery({ projectId: env.projectId })
    : null;

export async function trackAnalyticsEvent(event: AnalyticsEvent) {
  if (
    !bigQuery ||
    !env.bigQueryDataset ||
    !env.bigQueryTable
  ) {
    return;
  }

  try {
    await bigQuery
      .dataset(env.bigQueryDataset)
      .table(env.bigQueryTable)
      .insert([
        {
          eventId: makeId("evt"),
          eventTimestamp: new Date().toISOString(),
          projectId: env.projectId,
          eventName: event.eventName,
          sessionId: event.sessionId ?? null,
          uploadId: event.uploadId ?? null,
          generationId: event.generationId ?? null,
          partnerId: event.partnerId ?? null,
          matchKind: event.matchKind ?? null,
          scene: event.scene ?? null,
          route: event.route,
          status: event.status,
          usageCount: event.usageCount ?? null,
          remainingGenerations: event.remainingGenerations ?? null,
          errorMessage: event.errorMessage ?? null,
          metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        },
      ]);
  } catch (error) {
    console.error("BigQuery analytics insert failed", error);
  }
}
