import { env } from "@/lib/config";
import { uploadBufferToGcs, createSignedReadUrl } from "@/lib/gcs";
import { buildComplementaryPrompt, buildCouplePrompt, buildDreamPrompt, buildSimilarPrompt } from "@/lib/ai/prompt-builder";
import { vertexRequest } from "@/lib/ai/vertex";
import { makeId } from "@/lib/utils";
import type { CoupleScene, MatchCard, StyleProfile } from "@/lib/types";

type ImagenPredictResponse = {
  predictions?: Array<{
    bytesBase64Encoded?: string;
    mimeType?: string;
  }>;
};

async function generateImage(prompt: string) {
  const response = await vertexRequest<ImagenPredictResponse>(
    `/publishers/google/models/${env.imageModel}:predict`,
    {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1",
        personGeneration: "allow_adult",
        safetyFilterLevel: "block_some",
      },
    },
  );

  const prediction = response.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) {
    throw new Error("Vertex AI image generation returned no image.");
  }

  return {
    buffer: Buffer.from(prediction.bytesBase64Encoded, "base64"),
    mimeType: prediction.mimeType ?? "image/png",
  };
}

async function persistGeneratedImage(params: {
  sessionId: string;
  generationId: string;
  buffer: Buffer;
  mimeType: string;
}) {
  const storagePath = `generated/${params.sessionId}/${params.generationId}.png`;
  await uploadBufferToGcs({
    destination: storagePath,
    buffer: params.buffer,
    contentType: params.mimeType,
  });
  const imageUrl = await createSignedReadUrl(storagePath);
  return { imageUrl, storagePath };
}

export const PARTNER_VARIANTS = {
  similar: {
    kind: "similar",
    title: "Similar Match",
    buildTag: (profile: StyleProfile) => `${profile.style} Match`,
    buildPrompt: buildSimilarPrompt,
  },
  complementary: {
    kind: "complementary",
    title: "Complementary Match",
    buildTag: (profile: StyleProfile) => `Balanced ${profile.mood} Energy`,
    buildPrompt: buildComplementaryPrompt,
  },
  dream: {
    kind: "dream",
    title: "Dream Match",
    buildTag: (profile: StyleProfile) => `Cinematic ${profile.style}`,
    buildPrompt: buildDreamPrompt,
  },
} as const;

export async function generatePartnerMatch(params: {
  sessionId: string;
  profile: StyleProfile;
  kind: keyof typeof PARTNER_VARIANTS;
}) {
  const variant = PARTNER_VARIANTS[params.kind];
  const prompt = variant.buildPrompt(params.profile);
  const generationId = makeId(params.kind);
  const image = await generateImage(prompt);
  const stored = await persistGeneratedImage({
    sessionId: params.sessionId,
    generationId,
    buffer: image.buffer,
    mimeType: image.mimeType,
  });

  return {
    id: generationId,
    kind: variant.kind,
    title: variant.title,
    tag: variant.buildTag(params.profile),
    prompt,
    imageUrl: stored.imageUrl,
    storagePath: stored.storagePath,
  } satisfies MatchCard;
}

export async function generateCoupleImage(params: {
  sessionId: string;
  partnerTag: string;
  scene: CoupleScene;
  profile: StyleProfile;
}) {
  const prompt = buildCouplePrompt({
    profile: params.profile,
    partnerTag: params.partnerTag,
    scene: params.scene,
  });
  const generationId = makeId("couple");
  const image = await generateImage(prompt);
  const stored = await persistGeneratedImage({
    sessionId: params.sessionId,
    generationId,
    buffer: image.buffer,
    mimeType: image.mimeType,
  });

  return {
    id: generationId,
    prompt,
    scene: params.scene,
    imageUrl: stored.imageUrl,
    storagePath: stored.storagePath,
  };
}
