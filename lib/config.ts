const valueOrUndefined = (name: string, fallback?: string) =>
  process.env[name] ?? fallback;

export const env = {
  projectId: valueOrUndefined("GCP_PROJECT_ID", process.env.GOOGLE_CLOUD_PROJECT),
  bucketName: valueOrUndefined("GCS_BUCKET"),
  vertexLocation: valueOrUndefined("VERTEX_LOCATION", "us-central1"),
  analysisModel: valueOrUndefined("VERTEX_MODEL_ANALYSIS", "gemini-2.5-flash"),
  imageModel: valueOrUndefined("VERTEX_MODEL_IMAGE", "imagen-3.0-generate-002"),
  coupleImageModel: valueOrUndefined(
    "VERTEX_MODEL_COUPLE_IMAGE",
    "gemini-2.5-flash-image",
  ),
  firestoreEnabled: valueOrUndefined("FIRESTORE_ENABLED", "false"),
  firestoreCollectionPrefix: valueOrUndefined(
    "FIRESTORE_COLLECTION_PREFIX",
    "pairmuse",
  ),
  bigQueryAnalyticsEnabled: valueOrUndefined(
    "BIGQUERY_ANALYTICS_ENABLED",
    "false",
  ),
  bigQueryDataset: valueOrUndefined("BIGQUERY_DATASET"),
  bigQueryTable: valueOrUndefined("BIGQUERY_TABLE"),
  appBaseUrl: process.env.NEXT_PUBLIC_APP_URL,
};

export function requireEnv(name: keyof typeof env) {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}
