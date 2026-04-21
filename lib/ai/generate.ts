import { env } from "@/lib/config";
import { uploadBufferToGcs, createSignedReadUrl, readFileAsBase64 } from "@/lib/gcs";
import { buildComplementaryPrompt, buildCouplePrompt, buildDreamPrompt, buildSimilarPrompt } from "@/lib/ai/prompt-builder";
import { vertexRequest } from "@/lib/ai/vertex";
import { makeId } from "@/lib/utils";
import type { CoupleScene, MatchCard, StyleProfile } from "@/lib/types";

type ImagenPredictResponse = {
  predictions?: Array<{
    bytesBase64Encoded?: string;
    mimeType?: string;
    images?: Array<{
      bytesBase64Encoded?: string;
      mimeType?: string;
    }>;
  }>;
};

type GeminiImageResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
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
  const imagePayload = prediction?.bytesBase64Encoded
    ? {
        bytesBase64Encoded: prediction.bytesBase64Encoded,
        mimeType: prediction.mimeType,
      }
    : prediction?.images?.[0];

  if (!imagePayload?.bytesBase64Encoded) {
    throw new Error("Vertex AI image generation returned no image.");
  }

  return {
    buffer: Buffer.from(imagePayload.bytesBase64Encoded, "base64"),
    mimeType: imagePayload.mimeType ?? "image/png",
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
  originalImage: {
    storagePath: string;
    mimeType: string;
  };
  partnerImage: {
    storagePath: string;
    mimeType: string;
  };
}) {
  const prompt = buildCouplePrompt({
    profile: params.profile,
    partnerTag: params.partnerTag,
    scene: params.scene,
  });
  const generationId = makeId("couple");
  const originalBase64 = await readFileAsBase64(params.originalImage.storagePath);
  const partnerBase64 = await readFileAsBase64(params.partnerImage.storagePath);
  const response = await vertexRequest<GeminiImageResponse>(
    `/publishers/google/models/${env.coupleImageModel}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Create one photorealistic couple portrait.",
                "Use the first image as the exact face and styling anchor for person one.",
                "Use the second image as the exact face and styling anchor for person two.",
                "Preserve each person's identity as closely as possible.",
                "Match person two closely to the selected partner reference image.",
                "Do not invent new faces if the source faces are visible.",
                "Do not swap, merge, or replace either person with a different-looking adult.",
                "Show both adults together in a single coherent scene.",
                prompt,
              ].join(" "),
            },
            {
              inlineData: {
                mimeType: params.originalImage.mimeType,
                data: originalBase64,
              },
            },
            {
              inlineData: {
                mimeType: params.partnerImage.mimeType,
                data: partnerBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        responseModalities: ["IMAGE"],
        candidateCount: 1,
      },
    },
  );

  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((part) => part.inlineData?.data);

  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini couple generation returned no image.");
  }

  const image = {
    buffer: Buffer.from(imagePart.inlineData.data, "base64"),
    mimeType: imagePart.inlineData.mimeType ?? "image/png",
  };
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
