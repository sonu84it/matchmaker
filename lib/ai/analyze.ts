import { readFileAsBase64 } from "@/lib/gcs";
import { vertexRequest } from "@/lib/ai/vertex";
import type { StyleProfile } from "@/lib/types";
import { env } from "@/lib/config";

const analysisSchema = {
  type: "OBJECT",
  properties: {
    age_range: { type: "STRING" },
    presentation: { type: "STRING" },
    style: { type: "STRING" },
    clothing_type: { type: "STRING" },
    color_palette: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    mood: { type: "STRING" },
    lighting: { type: "STRING" },
    scene_type: { type: "STRING" },
    face_count: { type: "NUMBER" },
    safety: {
      type: "OBJECT",
      properties: {
        is_minor_suspected: { type: "BOOLEAN" },
        is_explicit_suspected: { type: "BOOLEAN" },
      },
      required: ["is_minor_suspected", "is_explicit_suspected"],
    },
  },
  required: [
    "age_range",
    "presentation",
    "style",
    "clothing_type",
    "color_palette",
    "mood",
    "lighting",
    "scene_type",
    "face_count",
    "safety",
  ],
};

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

export async function analyzeImageFromStorage(params: {
  storagePath: string;
  mimeType: string;
}) {
  const imageBase64 = await readFileAsBase64(params.storagePath);

  const response = await vertexRequest<GeminiResponse>(
    `/publishers/google/models/${env.analysisModel}:generateContent`,
    {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: [
                "Analyze this portrait for AI matchmaking.",
                "Return strict JSON only.",
                "If face_count is not exactly 1, explain in the JSON fields as best you can and set safety flags accurately.",
                "Do not identify a real person or infer sensitive personal identity.",
                "Estimate only visible creative attributes for generating a compatible fictional adult partner.",
                "For presentation, describe only visible presentation cues using labels such as masculine-presenting, feminine-presenting, androgynous, or neutral.",
              ].join(" "),
            },
            {
              inlineData: {
                mimeType: params.mimeType,
                data: imageBase64,
              },
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
      safetySettings: [
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_LOW_AND_ABOVE",
        },
      ],
    },
  );

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Vertex AI analysis returned an empty response.");
  }

  const profile = JSON.parse(text) as StyleProfile;

  if (profile.face_count !== 1) {
    throw new Error("Please upload a photo with exactly one clearly visible face.");
  }

  if (profile.safety?.is_minor_suspected) {
    throw new Error("This prototype only supports adults. Please use an adult photo.");
  }

  if (profile.safety?.is_explicit_suspected) {
    throw new Error("Please use a non-explicit image.");
  }

  return profile;
}
