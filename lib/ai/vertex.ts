import { GoogleAuth } from "google-auth-library";
import { env, requireEnv } from "@/lib/config";

const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"],
});

export async function vertexRequest<T>(path: string, body: unknown): Promise<T> {
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  const projectId = requireEnv("projectId");
  const vertexLocation = requireEnv("vertexLocation");

  const response = await fetch(
    `https://${vertexLocation}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${vertexLocation}${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.token ?? token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vertex AI request failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}
