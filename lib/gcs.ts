import { Storage } from "@google-cloud/storage";
import { env, requireEnv } from "@/lib/config";

const storage = new Storage({
  projectId: env.projectId,
});

function getBucket() {
  return storage.bucket(requireEnv("bucketName"));
}

export async function uploadBufferToGcs(params: {
  destination: string;
  buffer: Buffer;
  contentType: string;
}) {
  const file = getBucket().file(params.destination);

  await file.save(params.buffer, {
    resumable: false,
    metadata: {
      contentType: params.contentType,
      cacheControl: "public, max-age=3600",
    },
  });

  return file;
}

export async function createSignedReadUrl(path: string) {
  const [url] = await getBucket().file(path).getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 6,
  });

  return url;
}

export async function readFileAsBase64(path: string) {
  const [buffer] = await getBucket().file(path).download();
  return buffer.toString("base64");
}
